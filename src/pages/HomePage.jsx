import React from "react";
import { Camera, FileText, Github, GraduationCap, MessageCircle, Sparkles } from "lucide-react";
import SnapshotCard from "../components/SnapshotCard.jsx";
import { fetchPostsFromApi } from "../lib/api.js";
import { focusAreas, photos } from "../data/site.js";

export default function HomePage() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">MS CS @ UC San Diego / builder / photographer</p>
          <h1>
            Weiqi Zhou
            <span>周玮琦</span>
          </h1>
          <p>
            I build practical software where data, AI, and everyday workflows meet. The site is now organized as a set of focused pages, with quick snapshots below.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#/projects">
              <FileText size={18} />
              View projects
            </a>
            <a className="button" href="https://github.com/WeiqiZhou2002" target="_blank" rel="noreferrer">
              <Github size={18} />
              GitHub
            </a>
            <a className="button" href="https://chat.weiqizhou.com" target="_blank" rel="noreferrer">
              <MessageCircle size={18} />
              Chat with my AI
            </a>
          </div>
        </div>
        <div className="hero-photo-panel">
          <img src={photos.hero} alt="Snowy coastal village below a mountain" />
          <div>
            <span>Current mode</span>
            <strong>AI products, data systems, and the occasional mountain.</strong>
          </div>
        </div>
      </section>

      <section className="snapshot-grid">
        <SnapshotCard
          icon={Sparkles}
          eyebrow="Projects"
          title="Travel Claim Copilot joins the project shelf."
          body="A current copilot project for travel reimbursement workflows, alongside Auto Course Calendar and data systems work."
          href="#/projects"
        />
        <SnapshotCard
          icon={Camera}
          eyebrow="Photos"
          title="A backend-powered gallery with EXIF and location."
          body="Click into photos for camera metadata and saved location context from the API."
          href="#/photos"
        />
        <SnapshotCard
          icon={FileText}
          eyebrow="Blog"
          title="Posts now have their own reading surface."
          body="A cleaner archive for project notes, memories, and longer-form writing."
          href="#/blog"
        />
        <SnapshotCard
          icon={GraduationCap}
          eyebrow="Course"
          title="A draggable academic timeline."
          body="Graduate and undergraduate courses are arranged by term for quick scanning."
          href="#/course"
        />
      </section>

      <section className="home-band">
        {focusAreas.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label}>
              <Icon size={22} />
              <h2>{item.label}</h2>
              <p>{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="section two-column-preview">
        <div>
          <p className="eyebrow">Latest notes</p>
          <h2>Writing snapshot</h2>
        </div>
        <LatestPostsPreview />
      </section>
    </>
  );
}

function LatestPostsPreview() {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    fetchPostsFromApi()
      .then((remotePosts) => {
        if (!alive) return;
        setItems((remotePosts || []).slice(0, 3));
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mini-post-list">
        <article>
          <span>API</span>
          <h3>Loading latest posts...</h3>
          <time>Live</time>
        </article>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="mini-post-list">
        <article>
          <span>API</span>
          <h3>No posts published yet.</h3>
          <time>Live</time>
        </article>
      </div>
    );
  }

  return (
    <div className="mini-post-list">
      {items.map((post) => (
        <article key={post.id}>
          <span>{post.tag}</span>
          <h3>{post.title}</h3>
          <time>{post.date}</time>
        </article>
      ))}
    </div>
  );
}
