import React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, Html } from "@react-three/drei";
import { geoEquirectangular, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import land110 from "world-atlas/land-110m.json";

const R = 2;
const COLORS = {
  ocean: "#ddd5c6",
  land: "#3a342d",
  grid: "#b8ad9b",
  pin: "#c4532d",
};

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function latLonToVector(lat, lon, radius = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

/* ---------- land as dots ---------- */

function useLandMask() {
  return React.useMemo(() => {
    const w = 720;
    const h = 360;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    const projection = geoEquirectangular().fitSize([w, h], { type: "Sphere" });
    ctx.fillStyle = "#000";
    ctx.beginPath();
    geoPath(projection, ctx)(feature(land110, land110.objects.land));
    ctx.fill();
    const pixels = ctx.getImageData(0, 0, w, h).data;
    return (lat, lon) => {
      const x = Math.min(w - 1, Math.floor(((lon + 180) / 360) * w));
      const y = Math.min(h - 1, Math.floor(((90 - lat) / 180) * h));
      return pixels[(y * w + x) * 4 + 3] > 128;
    };
  }, []);
}

function LandDots() {
  const isLand = useLandMask();
  const ref = React.useRef();
  const points = React.useMemo(() => {
    // Fibonacci sphere gives an even dot spacing everywhere.
    const n = 26000;
    const out = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i += 1) {
      const y = 1 - (i / (n - 1)) * 2;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y));
      const lon = THREE.MathUtils.radToDeg(((golden * i) % (Math.PI * 2)) - Math.PI);
      if (isLand(lat, lon)) out.push(latLonToVector(lat, lon, R + 0.004));
    }
    return out;
  }, [isLand]);

  React.useLayoutEffect(() => {
    const m = new THREE.Object3D();
    points.forEach((p, i) => {
      m.position.copy(p);
      m.lookAt(p.clone().multiplyScalar(2));
      m.updateMatrix();
      ref.current.setMatrixAt(i, m.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [points]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, points.length]} raycast={() => null}>
      <circleGeometry args={[0.0105, 6]} />
      <meshBasicMaterial color={COLORS.land} />
    </instancedMesh>
  );
}

function Graticule() {
  const lines = React.useMemo(() => {
    const out = [];
    for (let lat = -60; lat <= 60; lat += 30) {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 4) pts.push(latLonToVector(lat, lon, R + 0.002));
      out.push(pts);
    }
    for (let lon = -180; lon < 180; lon += 30) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 4) pts.push(latLonToVector(lat, lon, R + 0.002));
      out.push(pts);
    }
    return out.map((pts) => new THREE.BufferGeometry().setFromPoints(pts));
  }, []);
  return lines.map((g, i) => (
    <line key={i} geometry={g} raycast={() => null}>
      <lineBasicMaterial color={COLORS.grid} transparent opacity={0.55} />
    </line>
  ));
}

/* ---------- pins ---------- */

function Pin({ place, active, onHover, onSelect }) {
  const group = React.useRef();
  const label = React.useRef();
  const { camera } = useThree();
  const normal = React.useMemo(() => latLonToVector(place.lat, place.lon, 1), [place]);
  const height = 0.1 + Math.min(place.photos.length, 5) * 0.035;
  const lift = React.useRef(0);

  React.useLayoutEffect(() => {
    group.current.position.copy(normal).multiplyScalar(R);
    group.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [normal]);

  useFrame((_, dt) => {
    lift.current = THREE.MathUtils.damp(lift.current, active ? 1 : 0, 10, dt);
    group.current.scale.setScalar(1 + lift.current * 0.5);
    // Hide labels for pins on the far side of the globe.
    if (label.current) {
      const facing = normal.dot(camera.position.clone().normalize());
      label.current.style.opacity = facing > 0.25 ? "1" : "0";
    }
  });

  return (
    <group
      ref={group}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(place.key);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(place);
      }}
    >
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, height, 6]} />
        <meshBasicMaterial color={COLORS.land} />
      </mesh>
      <mesh position={[0, height, 0]}>
        <sphereGeometry args={[0.034, 16, 16]} />
        <meshStandardMaterial color={COLORS.pin} roughness={0.5} emissive={COLORS.pin} emissiveIntensity={0.25} />
      </mesh>
      {/* generous invisible hit area */}
      <mesh position={[0, height, 0]} visible={false}>
        <sphereGeometry args={[0.09, 8, 8]} />
      </mesh>
      <Html position={[0, height + 0.08, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span ref={label} className={`globe-tag${active ? " is-on" : ""}${place.photos.length > 1 ? "" : " is-single"}`}>
          <b>{place.photos.length}</b>
          <span>{place.name}</span>
        </span>
      </Html>
    </group>
  );
}

/* ---------- camera ---------- */

function sphericalFor(lat, lon) {
  const v = latLonToVector(lat, lon, 1);
  return { azimuth: Math.atan2(v.x, v.z), polar: Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)) };
}

function Director({ focusPoint, previewPoint, paused }) {
  const controls = React.useRef();
  const idle = React.useRef(0);
  const { size } = useThree();
  const far = size.width < 700 ? 10.4 : 9;

  React.useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const point = focusPoint || previewPoint;
    if (point) {
      const { azimuth, polar } = sphericalFor(point.lat, point.lon);
      // Aim slightly above the point so the cards have room below it.
      c.rotateTo(azimuth, Math.max(0.35, polar - (focusPoint ? 0.12 : 0)), true);
      c.dollyTo(focusPoint ? far * 0.8 : far, true);
    } else {
      c.dollyTo(far, true);
    }
  }, [focusPoint, previewPoint, far]);

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || reducedMotion || focusPoint || previewPoint) return;
    if (paused) {
      idle.current = 0;
      return;
    }
    idle.current += dt;
    if (idle.current > 2.5) c.azimuthAngle += dt * 0.06;
  });

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={4}
      maxDistance={12}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI - 0.25}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      mouseButtons={{ left: 1, middle: 0, right: 0, wheel: 0 }}
      touches={{ one: 32, two: 0, three: 0 }}
      onStart={() => {
        idle.current = 0;
      }}
    />
  );
}

/* ---------- scene ---------- */

export default function Globe({
  places,
  focusPoint,
  previewPoint,
  activeGroup,
  activePlace,
  initial,
  onBackground,
  onPinSelect,
}) {
  // Hovering a pin only labels it; the camera follows the country list, not the pins.
  const [hoveredPin, setHoveredPin] = React.useState(null);
  // Hold still while the pointer is over the globe so pins are easy to hit.
  const [pointerInside, setPointerInside] = React.useState(false);

  React.useEffect(() => {
    document.body.style.cursor = hoveredPin ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hoveredPin]);

  const start = React.useMemo(() => {
    const { azimuth, polar } = sphericalFor(initial?.lat ?? 30, initial?.lon ?? 0);
    const d = 9;
    return [d * Math.sin(polar) * Math.sin(azimuth), d * Math.cos(polar), d * Math.sin(polar) * Math.cos(azimuth)];
  }, [initial]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: start, fov: 32, near: 0.1, far: 50 }}
      onPointerMissed={onBackground}
      onPointerEnter={() => setPointerInside(true)}
      onPointerMove={() => setPointerInside(true)}
      onPointerLeave={() => setPointerInside(false)}
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 5, 6]} intensity={1.6} color="#fff3e2" />
      <mesh
        onPointerOver={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <sphereGeometry args={[R, 96, 96]} />
        <meshStandardMaterial color={COLORS.ocean} roughness={0.95} />
      </mesh>
      <Graticule />
      <LandDots />
      {places.map((place) => (
        <Pin
          key={place.key}
          place={place}
          active={activeGroup === place.group || activePlace === place.key || hoveredPin === place.key}
          onHover={setHoveredPin}
          onSelect={onPinSelect}
        />
      ))}
      <Director focusPoint={focusPoint} previewPoint={previewPoint} paused={pointerInside} />
    </Canvas>
  );
}
