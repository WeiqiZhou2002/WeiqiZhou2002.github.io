import React from "react";
import { fetchPostsFromApi } from "../lib/api.js";
import { courses, photos, projects } from "../data/site.js";

const Room = React.lazy(() => import("../scene/Room.jsx"));

const rooms = [
  { id: "projects", index: "01", label: "Projects", href: "#/projects", object: "the monitor" },
  { id: "blog", index: "02", label: "Writing", href: "#/blog", object: "the notebook" },
  { id: "course", index: "03", label: "Courses", href: "#/course", object: "the bookshelf" },
  { id: "photos", index: "04", label: "Photographs", href: "#/photos", object: "the camera" },
];

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

class SceneBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function HomePage() {
  const [hovered, setHovered] = React.useState(null);
  const [listHover, setListHover] = React.useState(null);
  const [webgl] = React.useState(hasWebGL);
  const fallback = <img className="stage-fallback" src={photos.hero} alt="Snowy coastal village below a mountain" />;

  return (
    <>
      <section className="stage">
        <div className="stage-copy">
          <h1>
            Weiqi Zhou <span lang="zh">周玮琦</span>
          </h1>
          <p>
            I build practical software where data, AI and everyday workflows meet. Grad student in computer science at
            UC San Diego. Photographs on the side.
          </p>
          <ol className="stage-index">
            {rooms.map((room) => (
              <li key={room.id} className={hovered === room.id ? "is-on" : ""}>
                <a
                  href={room.href}
                  onMouseEnter={() => setListHover(room.id)}
                  onMouseLeave={() => setListHover(null)}
                  onFocus={() => setListHover(room.id)}
                  onBlur={() => setListHover(null)}
                >
                  <b>{room.index}</b>
                  <span>{room.label}</span>
                  <em>{room.object}</em>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <figure className="stage-scene">
          {webgl ? (
            <SceneBoundary fallback={fallback}>
              <React.Suspense fallback={<div className="stage-loading">setting up the room…</div>}>
                <Room photo={photos.windowView} courseCount={courses.length} highlight={listHover} onHover={setHovered} />
              </React.Suspense>
            </SceneBoundary>
          ) : (
            fallback
          )}
          <figcaption>
            Fig. 1 — my desk, rendered live in your browser. Click on things.
          </figcaption>
        </figure>
      </section>

      <section className="home-section">
        <h2 className="section-label">Now</h2>
        <p className="now-text">
          Working on <a href="https://copilot.weiqizhou.com/">Travel Claim Copilot</a>, a tool that turns a messy trip
          into a clean reimbursement claim, and on <a href="https://maireji.com">Maireji</a>, a product experiment I
          co-founded.
        </p>
      </section>

      <section className="home-section">
        <h2 className="section-label">Selected work</h2>
        <ul className="work-list">
          {projects.map((project, i) => {
            const external = project.href.startsWith("http");
            return (
              <li key={project.title}>
                <a href={project.href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                  <span className="work-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="work-title">{project.title}</span>
                  <span className="work-body">{project.body}</span>
                  <span className="work-meta">{project.meta}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="home-section">
        <h2 className="section-label">Recent writing</h2>
        <LatestPosts />
      </section>
    </>
  );
}

function LatestPosts() {
  const [items, setItems] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    fetchPostsFromApi()
      .then((posts) => alive && setItems((posts || []).slice(0, 3)))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) return <p className="quiet">Loading…</p>;
  if (!items.length) return <p className="quiet">Nothing published yet.</p>;

  return (
    <ul className="note-list">
      {items.map((post) => (
        <li key={post.id}>
          <a href="#/blog">
            <time>{post.date}</time>
            <span>{post.title}</span>
            <em>{post.tag}</em>
          </a>
        </li>
      ))}
    </ul>
  );
}
