export default function PageShell({ eyebrow, title, intro, children }) {
  return (
    <div className="page-shell">
      <section className="page-hero">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{intro}</p>
      </section>
      {children}
    </div>
  );
}
