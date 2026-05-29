import React from "react";
import BlogContent from "../components/BlogContent.jsx";
import PageShell from "../components/PageShell.jsx";
import { API_BASE_URL, fetchPostFromApi, fetchPostsFromApi } from "../lib/api.js";

export default function BlogPage() {
  const [items, setItems] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPostsFromApi()
      .then((remotePosts) => {
        if (!alive) return;
        const nextPosts = remotePosts || [];
        setItems(nextPosts);
        setSelected(nextPosts[0] || null);
        setError("");
      })
      .catch(() => {
        if (alive) setError("Could not load posts from the API.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const selectPost = async (post) => {
    setSelected(post);
    if (post.content || !API_BASE_URL) return;
    try {
      const fullPost = await fetchPostFromApi(post);
      if (!fullPost) return;
      setSelected(fullPost);
      setItems((current) => current.map((item) => (item.id === post.id ? fullPost : item)));
    } catch {
      setError("Could not load the full post from the API.");
    }
  };

  return (
    <PageShell
      eyebrow="Blog"
      title="Posts, project notes, and the occasional memory."
      intro=""
    >
      <section className="blog-layout">
        <div className="blog-list" aria-label="Blog posts">
          <div className="blog-list-header">
            <span>{loading ? "Loading" : `${items.length} posts`}</span>
            {error && <strong>{error}</strong>}
          </div>
          {!loading && !items.length && (
            <div className="empty-state">
              <strong>No posts yet.</strong>
              <p>Publish from the backend and the archive will update automatically.</p>
            </div>
          )}
          {items.map((post) => (
            <button
              className={selected?.id === post.id ? "blog-list-item is-selected" : "blog-list-item"}
              type="button"
              key={post.id}
              onClick={() => selectPost(post)}
            >
              <span>{post.tag}</span>
              <h2>{post.title}</h2>
              <time>{post.date}</time>
              {post.excerpt && <p>{post.excerpt}</p>}
            </button>
          ))}
        </div>

        {selected ? (
          <article className="blog-reader">
            <div className="blog-reader-meta">
              <span>{selected.tag}</span>
              <time>{selected.date}</time>
            </div>
            <h2>{selected.title}</h2>
            <BlogContent content={selected.content || selected.excerpt || ""} />
          </article>
        ) : (
          <div className="blog-reader empty-state">
            <strong>{loading ? "Loading post..." : "No post selected."}</strong>
            <p>{loading ? "Fetching the latest blog content from the API." : "Once posts exist, the first one will open here."}</p>
          </div>
        )}
      </section>
    </PageShell>
  );
}
