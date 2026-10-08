import React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  Lightformer,
  OrthographicCamera,
  RoundedBox,
  SoftShadows,
  useTexture,
} from "@react-three/drei";
import { EffectComposer, N8AO } from "@react-three/postprocessing";

// Clay palette. Kept in sync with the page tokens in style.css.
const C = {
  wall: "#efe7da",
  wallLeft: "#e8dccb",
  trim: "#d9c9b1",
  floorA: "#c7a07a",
  floorB: "#bf9670",
  wood: "#a27a58",
  woodDark: "#7d5a40",
  ink: "#2d2925",
  accent: "#c4532d",
  mustard: "#ddb04c",
  sage: "#8d9d76",
  navy: "#3e4a5b",
  cream: "#f5eee2",
  rose: "#d9a491",
  plant: "#6f8d58",
  plantDark: "#577448",
  pot: "#c97a55",
  metal: "#a29d97",
  rug: "#ddd0b9",
};

const reducedMotion =
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Mat({ color, rough = 0.82, metal = 0 }) {
  return <meshStandardMaterial color={color} roughness={rough} metalness={metal} />;
}

function Block({ args, color, radius = 0.03, rough, ...props }) {
  return (
    <RoundedBox args={args} radius={Math.min(radius, ...args.map((v) => v / 2 - 0.001))} smoothness={4} castShadow receiveShadow {...props}>
      <Mat color={color} rough={rough} />
    </RoundedBox>
  );
}

function Cyl({ r = 0.1, r2, h = 1, color, seg = 28, ...props }) {
  return (
    <mesh castShadow receiveShadow {...props}>
      <cylinderGeometry args={[r, r2 ?? r, h, seg]} />
      <Mat color={color} />
    </mesh>
  );
}

/* ---------- Interaction ---------- */

const HoverContext = React.createContext(null);

function Hotspot({ id, index, label, href, position, rotation, tagAt = [0, 1, 0], children }) {
  const { hovered, setHovered, highlight } = React.useContext(HoverContext);
  const ref = React.useRef();
  const on = hovered === id || (!hovered && highlight === id);

  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.y = THREE.MathUtils.damp(ref.current.position.y, position[1] + (on ? 0.1 : 0), 12, dt);
  });

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(id);
      }}
      onPointerOut={() => setHovered((h) => (h === id ? null : h))}
      onClick={(e) => {
        e.stopPropagation();
        window.location.hash = href;
      }}
    >
      {children}
      <Html position={tagAt} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <span className={`scene-tag${on ? " is-on" : ""}`}>
          <b>{index}</b>
          <span>{label}</span>
        </span>
      </Html>
    </group>
  );
}

/* ---------- Room shell ---------- */

function Shell() {
  const planks = [];
  for (let i = 0; i < 8; i += 1) {
    planks.push(
      <Block key={i} args={[0.74, 0.3, 6]} radius={0.02} color={i % 2 ? C.floorA : C.floorB} position={[-3 + 0.375 + i * 0.75, -0.15, 0]} />,
    );
  }
  return (
    <group>
      {planks}
      {/* walls */}
      <Block args={[6.2, 4.2, 0.2]} color={C.wall} radius={0.05} position={[0, 1.95, -3.1]} />
      <Block args={[0.2, 4.2, 6.2]} color={C.wallLeft} radius={0.05} position={[-3.1, 1.95, 0]} />
      {/* baseboards */}
      <Block args={[6, 0.16, 0.06]} color={C.trim} position={[0, 0.08, -2.97]} />
      <Block args={[0.06, 0.16, 6]} color={C.trim} position={[-2.97, 0.08, 0]} />
      {/* rug */}
      <Cyl r={1.45} h={0.025} color={C.rug} seg={64} position={[0.55, 0.013, 0.35]} />
      <mesh position={[0.55, 0.027, 0.35]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[1.12, 1.2, 64]} />
        <Mat color={C.accent} />
      </mesh>
    </group>
  );
}

function Window({ photo }) {
  const tex = useTexture(photo);
  tex.colorSpace = THREE.SRGBColorSpace;
  const w = 2.1;
  const h = 1.4;
  const z = -1.15;
  const y = 2.25;
  const x = -2.99;
  return (
    <group>
      <mesh position={[x, y, z]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* frame */}
      <Block args={[0.1, 0.09, w + 0.18]} color={C.cream} position={[x + 0.04, y + h / 2 + 0.045, z]} />
      <Block args={[0.1, 0.09, w + 0.18]} color={C.cream} position={[x + 0.04, y - h / 2 - 0.045, z]} />
      <Block args={[0.1, h, 0.09]} color={C.cream} position={[x + 0.04, y, z - w / 2 - 0.045]} />
      <Block args={[0.1, h, 0.09]} color={C.cream} position={[x + 0.04, y, z + w / 2 + 0.045]} />
      <Block args={[0.06, h, 0.04]} color={C.cream} position={[x + 0.03, y, z]} />
      {/* sill */}
      <Block args={[0.28, 0.06, w + 0.4]} color={C.cream} position={[x + 0.12, y - h / 2 - 0.1, z]} />
      {/* small cactus on the sill */}
      <Cyl r={0.07} r2={0.06} h={0.12} color={C.pot} position={[x + 0.14, y - h / 2 - 0.01, z + 0.75]} />
      <mesh castShadow position={[x + 0.14, y - h / 2 + 0.1, z + 0.75]} scale={[0.05, 0.11, 0.05]}>
        <sphereGeometry args={[1, 16, 16]} />
        <Mat color={C.plant} />
      </mesh>
    </group>
  );
}

function Artwork() {
  // A framed landscape print above the desk.
  return (
    <group position={[-1.5, 2.65, -2.98]}>
      <Block args={[1.36, 0.98, 0.05]} color={C.ink} radius={0.015} />
      <mesh position={[0, 0, 0.027]}>
        <planeGeometry args={[1.24, 0.86]} />
        <Mat color={C.cream} rough={0.95} />
      </mesh>
      <mesh position={[0.24, 0.13, 0.029]}>
        <circleGeometry args={[0.09, 40]} />
        <Mat color={C.accent} rough={0.95} />
      </mesh>
      <mesh position={[0, -0.12, 0.03]}>
        <shapeGeometry args={[ridge([[-0.46, 0.02], [-0.28, 0.16], [-0.12, 0.05], [0.06, 0.2], [0.26, 0.04], [0.46, 0.12]])]} />
        <Mat color={C.sage} rough={0.95} />
      </mesh>
      <mesh position={[0, -0.12, 0.031]}>
        <shapeGeometry args={[ridge([[-0.46, -0.06], [-0.2, 0.08], [0.0, -0.04], [0.2, 0.06], [0.46, -0.08]])]} />
        <Mat color={C.navy} rough={0.95} />
      </mesh>
    </group>
  );
}

function ridge(points) {
  const s = new THREE.Shape();
  s.moveTo(-0.46, -0.2);
  points.forEach(([x, y]) => s.lineTo(x, y));
  s.lineTo(0.46, -0.2);
  return s;
}

/* ---------- Furniture ---------- */

function useScreenTexture() {
  return React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 400;
    const g = c.getContext("2d");
    g.fillStyle = "#24211e";
    g.fillRect(0, 0, 640, 400);
    g.fillStyle = "#2f2b27";
    g.fillRect(0, 0, 640, 34);
    ["#c4532d", "#ddb04c", "#8d9d76"].forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(22 + i * 22, 17, 6, 0, Math.PI * 2);
      g.fill();
    });
    const palette = ["#e9dfcf", "#c4532d", "#ddb04c", "#8d9d76", "#9fb2c7", "#6b645c"];
    let seed = 7;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let row = 0; row < 15; row += 1) {
      const y = 56 + row * 22;
      let x = 30 + Math.floor(rnd() * 4) * 24;
      g.fillStyle = "#4a443d";
      g.fillRect(8, y, 12, 8);
      const n = 1 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k += 1) {
        const w = 30 + rnd() * 120;
        g.fillStyle = palette[Math.floor(rnd() * palette.length)];
        g.fillRect(x, y, w, 9);
        x += w + 10;
        if (x > 590) break;
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }, []);
}

function Desk() {
  const top = 1.3;
  return (
    <group>
      <Block args={[2.9, 0.09, 1.1]} color={C.wood} radius={0.03} position={[0.85, top, -2.42]} />
      {[-2.9, -1.95].map((z) => (
        <Block key={z} args={[0.07, top - 0.05, 0.07]} color={C.woodDark} position={[-0.52, (top - 0.05) / 2, z]} />
      ))}
      {/* drawer cabinet */}
      <Block args={[0.8, top - 0.05, 1.0]} color={C.cream} radius={0.03} position={[1.86, (top - 0.05) / 2, -2.42]} />
      {[0.25, 0.65, 1.02].map((y) => (
        <Block key={y} args={[0.18, 0.035, 0.04]} color={C.ink} position={[1.86, y, -1.9]} />
      ))}
    </group>
  );
}

function Workstation() {
  const screen = useScreenTexture();
  const y = 1.345;
  return (
    <group>
      {/* monitor */}
      <Block args={[0.5, 0.03, 0.3]} color={C.ink} position={[0.75, y + 0.015, -2.65]} />
      <Block args={[0.07, 0.4, 0.05]} color={C.ink} position={[0.75, y + 0.2, -2.72]} />
      <Block args={[1.42, 0.86, 0.06]} color={C.ink} radius={0.03} position={[0.75, y + 0.78, -2.68]} />
      <mesh position={[0.75, y + 0.795, -2.648]}>
        <planeGeometry args={[1.32, 0.78]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* keyboard + trackpad */}
      <Block args={[0.92, 0.035, 0.3]} color={C.cream} radius={0.012} position={[0.72, y + 0.018, -2.12]} />
      <Block args={[0.26, 0.02, 0.2]} color={C.cream} radius={0.01} position={[1.32, y + 0.01, -2.1]} />
    </group>
  );
}

function Notebook() {
  return (
    <group rotation={[0, 0.25, 0]}>
      <Block args={[0.62, 0.03, 0.44]} color={C.navy} radius={0.01} position={[0, 0.015, 0]} />
      <Block args={[0.28, 0.025, 0.4]} color={C.cream} radius={0.006} position={[-0.15, 0.04, 0]} rotation={[0, 0, 0.05]} />
      <Block args={[0.28, 0.025, 0.4]} color={C.cream} radius={0.006} position={[0.15, 0.04, 0]} rotation={[0, 0, -0.05]} />
      {[-0.1, -0.03, 0.04, 0.11].map((z) => (
        <mesh key={z} position={[0.15, 0.06, z]} rotation={[-Math.PI / 2, 0, -0.05]}>
          <planeGeometry args={[0.2, 0.012]} />
          <Mat color="#b9ad9b" />
        </mesh>
      ))}
      <Cyl r={0.012} h={0.36} color={C.accent} position={[0.36, 0.03, 0.02]} rotation={[Math.PI / 2, 0, 0.2]} />
    </group>
  );
}

function Lamp() {
  return (
    <group position={[1.95, 1.345, -2.7]}>
      <Cyl r={0.14} h={0.04} color={C.ink} position={[0, 0.02, 0]} />
      <Cyl r={0.018} h={0.7} color={C.ink} position={[0, 0.38, 0]} rotation={[0, 0, 0.25]} />
      <Cyl r={0.018} h={0.45} color={C.ink} position={[-0.17, 0.82, 0.1]} rotation={[0.9, 0, 0.6]} />
      <mesh castShadow position={[-0.3, 0.86, 0.3]} rotation={[0.9, 0, 0.3]}>
        <coneGeometry args={[0.16, 0.24, 28, 1, true]} />
        <meshStandardMaterial color={C.mustard} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-0.33, 0.8, 0.36]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color="#fff2cf" toneMapped={false} />
      </mesh>
      <pointLight position={[-0.36, 0.7, 0.45]} color="#ffbe73" intensity={2.2} distance={3.2} decay={2} />
    </group>
  );
}

function Mug() {
  return (
    <group position={[1.6, 1.345, -1.98]}>
      <Cyl r={0.075} h={0.17} color={C.accent} position={[0, 0.085, 0]} />
      <mesh position={[0.085, 0.09, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <torusGeometry args={[0.045, 0.014, 10, 20]} />
        <Mat color={C.accent} />
      </mesh>
    </group>
  );
}

function Chair() {
  return (
    <group position={[0.85, 0, -1.25]} rotation={[0, -0.35, 0]}>
      <Block args={[0.78, 0.12, 0.74]} color={C.accent} radius={0.06} position={[0, 0.78, 0]} />
      <Block args={[0.78, 0.82, 0.12]} color={C.accent} radius={0.06} position={[0, 1.24, 0.36]} rotation={[-0.1, 0, 0]} />
      <Cyl r={0.04} h={0.6} color={C.ink} position={[0, 0.42, 0]} />
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <group key={i} rotation={[0, a, 0]}>
            <Block args={[0.05, 0.05, 0.36]} color={C.ink} position={[0, 0.1, 0.18]} />
            <mesh position={[0, 0.04, 0.34]} castShadow>
              <sphereGeometry args={[0.04, 12, 12]} />
              <Mat color={C.ink} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Bookshelf({ count }) {
  // One book per course on the course page.
  const shelves = [0.07, 0.86, 1.65];
  const colors = [C.navy, C.accent, C.mustard, C.sage, C.cream, C.rose, C.ink, C.wood];
  const perShelf = Math.ceil(count / shelves.length);
  const books = [];
  let seed = 3;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  shelves.forEach((sy, s) => {
    let z = -0.9 + rnd() * 0.15;
    const n = Math.min(perShelf, count - s * perShelf);
    for (let i = 0; i < n; i += 1) {
      const w = 0.09 + rnd() * 0.07;
      const h = 0.48 + rnd() * 0.2;
      const lean = i === n - 1 ? -0.28 : 0;
      books.push(
        <Block
          key={`${s}-${i}`}
          args={[0.36 - rnd() * 0.06, h, w]}
          color={colors[(i * 3 + s * 5) % colors.length]}
          radius={0.012}
          position={[0, sy + 0.03 + h / 2 - (lean ? 0.02 : 0), z + w / 2 + (lean ? 0.06 : 0)]}
          rotation={[lean, 0, 0]}
        />,
      );
      z += w + 0.012;
    }
    // something that is not a book
    if (s === 1) {
      books.push(<Cyl key="jar" r={0.09} h={0.22} color={C.sage} position={[0, sy + 0.14, 0.72]} />);
    }
    if (s === 0) {
      books.push(<Block key="box" args={[0.32, 0.22, 0.42]} color={C.mustard} radius={0.02} position={[0, sy + 0.14, 0.62]} />);
    }
  });

  return (
    <group>
      <Block args={[0.46, 0.05, 2.0]} color={C.wood} position={[0, 0.04, 0]} />
      {shelves.slice(1).map((y) => (
        <Block key={y} args={[0.46, 0.05, 2.0]} color={C.wood} position={[0, y, 0]} />
      ))}
      <Block args={[0.46, 0.05, 2.0]} color={C.wood} position={[0, 2.42, 0]} />
      <Block args={[0.46, 2.44, 0.05]} color={C.woodDark} position={[0, 1.22, -1.0]} />
      <Block args={[0.46, 2.44, 0.05]} color={C.woodDark} position={[0, 1.22, 1.0]} />
      {books}
      {/* plant on top */}
      <Cyl r={0.12} r2={0.09} h={0.2} color={C.pot} position={[0, 2.55, 0.55]} />
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} castShadow position={[Math.sin(i * 1.3) * 0.06, 2.62, 0.55 + Math.cos(i * 1.3) * 0.06]} rotation={[Math.cos(i * 2.1) * 1.4, i, Math.sin(i * 1.7) * 1.4]} scale={[0.05, 0.3, 0.02]}>
          <sphereGeometry args={[1, 10, 10]} />
          <Mat color={i % 2 ? C.plant : C.plantDark} />
        </mesh>
      ))}
    </group>
  );
}

function CameraRig() {
  const legs = [0, 1, 2].map((i) => {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    return (
      <group key={i} rotation={[0, a, 0]}>
        <Cyl r={0.026} r2={0.02} h={1.38} color={C.ink} seg={12} position={[0, 0.67, 0.2]} rotation={[-0.3, 0, 0]} />
      </group>
    );
  });
  return (
    <group>
      {legs}
      <Cyl r={0.05} h={0.12} color={C.ink} position={[0, 1.34, 0]} />
      <group position={[0, 1.55, 0]}>
        <Block args={[0.46, 0.3, 0.24]} color={C.ink} radius={0.04} />
        <Block args={[0.16, 0.1, 0.14]} color={C.ink} radius={0.03} position={[-0.09, 0.19, -0.02]} />
        <Block args={[0.1, 0.04, 0.1]} color={C.metal} radius={0.015} position={[0.15, 0.17, 0]} />
        <Cyl r={0.03} h={0.03} color={C.accent} position={[0.14, 0.2, -0.02]} />
        <Cyl r={0.1} h={0.2} color={C.metal} position={[0, 0, 0.22]} rotation={[Math.PI / 2, 0, 0]} />
        <Cyl r={0.105} h={0.06} color={C.ink} position={[0, 0, 0.34]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh position={[0, 0, 0.371]}>
          <circleGeometry args={[0.075, 28]} />
          <meshStandardMaterial color="#1a2430" roughness={0.1} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

function FloorPlant() {
  const leaves = Array.from({ length: 9 }, (_, i) => i);
  return (
    <group position={[2.55, 0, -0.95]}>
      <Cyl r={0.24} r2={0.19} h={0.48} color={C.pot} position={[0, 0.24, 0]} />
      <Cyl r={0.22} h={0.02} color="#6b4f3a" position={[0, 0.48, 0]} />
      {leaves.map((i) => {
        const a = i * 2.4;
        const tilt = 0.5 + (i % 3) * 0.22;
        return (
          <group key={i} position={[0, 0.5, 0]} rotation={[0, a, 0]}>
            <mesh castShadow position={[0, 0.42 + (i % 3) * 0.08, 0.2]} rotation={[tilt, 0, 0]} scale={[0.13, 0.4, 0.035]}>
              <sphereGeometry args={[1, 14, 14]} />
              <Mat color={i % 2 ? C.plant : C.plantDark} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/* ---------- Scene ---------- */

function GroundShadow() {
  // Soft blob under the slab. A plain texture instead of ContactShadows,
  // which the AO pass turns into a grey slab at some angles.
  const tex = React.useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    grad.addColorStop(0, "rgba(70,52,38,0.42)");
    grad.addColorStop(0.55, "rgba(70,52,38,0.16)");
    grad.addColorStop(1, "rgba(70,52,38,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <mesh position={[0.4, -0.7, 0.4]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
      <planeGeometry args={[11, 11]} />
      <meshBasicMaterial map={tex} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function Rig({ children }) {
  const ref = React.useRef();
  const intro = React.useRef(0);
  useFrame((state, dt) => {
    const g = ref.current;
    if (!g) return;
    intro.current = Math.min(1, intro.current + dt * 0.9);
    const e = 1 - Math.pow(1 - intro.current, 3);
    const px = reducedMotion ? 0 : state.pointer.x;
    const py = reducedMotion ? 0 : state.pointer.y;
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, px * 0.12 - (1 - e) * 0.5, 4, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, -py * 0.04, 4, dt);
    g.position.y = -0.6 * (1 - e) + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.03);
  });
  return <group ref={ref}>{children}</group>;
}

function Lens() {
  const { camera, size } = useThree();
  React.useLayoutEffect(() => {
    const fit = Math.min(size.width / 9.4, size.height / 8.4);
    camera.zoom = fit;
    camera.lookAt(0, 1.35, 0);
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

function Cursor() {
  const { hovered } = React.useContext(HoverContext);
  React.useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);
  return null;
}

export default function Room({ photo, courseCount = 12, highlight = null, onHover }) {
  const [hovered, setHovered] = React.useState(null);
  const value = React.useMemo(() => ({ hovered, setHovered, highlight }), [hovered, highlight]);

  React.useEffect(() => {
    onHover?.(hovered);
  }, [hovered, onHover]);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.AgXToneMapping, toneMappingExposure: 1.15 }}
      onPointerMissed={() => setHovered(null)}
    >
      <HoverContext.Provider value={value}>
        <Cursor />
        <OrthographicCamera makeDefault position={[10, 8.2, 10]} near={0.1} far={60} />
        <Lens />
        <SoftShadows size={22} samples={14} focus={0.5} />

        <hemisphereLight args={["#fff6ea", "#b49274", 0.9]} />
        <directionalLight
          castShadow
          position={[5, 9, 6]}
          intensity={2.4}
          color="#fff1dc"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-normalBias={0.025}
          shadow-camera-left={-6}
          shadow-camera-right={6}
          shadow-camera-top={6}
          shadow-camera-bottom={-6}
        />
        {/* cool daylight spilling in from the window */}
        <directionalLight position={[-1, 4, 6]} intensity={0.35} color="#dce8ff" />
        <Environment resolution={128}>
          <Lightformer intensity={1.4} position={[5, 5, 5]} scale={[8, 8, 1]} color="#fff4e6" />
          <Lightformer intensity={0.6} position={[-5, 3, 2]} scale={[6, 4, 1]} color="#e6eefc" />
        </Environment>

        <Rig>
          <group position={[0.1, 0, 0]}>
            <Shell />
            <React.Suspense fallback={null}>
              <Window photo={photo} />
            </React.Suspense>
            <Artwork />
            <Desk />
            <Lamp />
            <Mug />
            <Chair />
            <FloorPlant />

            <Hotspot id="projects" index="01" label="Projects" href="#/projects" position={[0, 0, 0]} tagAt={[0.75, 2.75, -2.6]}>
              <Workstation />
            </Hotspot>
            <Hotspot id="blog" index="02" label="Writing" href="#/blog" position={[-0.2, 1.345, -2.25]} tagAt={[0, 0.45, 0]}>
              <Notebook />
            </Hotspot>
            <Hotspot id="course" index="03" label="Courses" href="#/course" position={[-2.76, 0, 1.55]} tagAt={[0.2, 3.25, 0]}>
              <Bookshelf count={courseCount} />
            </Hotspot>
            <Hotspot id="photos" index="04" label="Photographs" href="#/photos" position={[1.25, 0, 1.25]} rotation={[0, -2.2, 0]} tagAt={[0, 2.1, 0]}>
              <CameraRig />
            </Hotspot>
          </group>
          <GroundShadow />
        </Rig>

        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO aoRadius={0.6} intensity={2.2} distanceFalloff={0.6} quality="medium" color="#3b2d22" />
        </EffectComposer>
      </HoverContext.Provider>
    </Canvas>
  );
}
