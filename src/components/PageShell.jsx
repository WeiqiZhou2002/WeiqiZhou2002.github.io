export default function PageShell({ eyebrow, title, intro, children }) {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {intro ? <p>{intro}</p> : null}
      </section>
      {children}
    </div>
  );
}
