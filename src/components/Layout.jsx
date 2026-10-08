import { routes } from "../data/site.js";

export function Header({ route }) {
  return (
    <header className="site-header">
      <a className="logo" href="#/" aria-label="Weiqi Zhou home">
        Weiqi Zhou
      </a>
      <nav aria-label="Primary navigation">
        {routes
          .filter((item) => item.path !== "/")
          .map((item) => (
            <a className={route === item.path ? "is-active" : ""} href={`#${item.path}`} key={item.id}>
              {item.label}
            </a>
          ))}
        <a className="header-link" href="mailto:wez092@ucsd.edu">
          Email
        </a>
      </nav>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Weiqi Zhou · San Diego</span>
      <div>
        <a href="mailto:wez092@ucsd.edu">wez092@ucsd.edu</a>
        <a href="https://github.com/WeiqiZhou2002" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </div>
    </footer>
  );
}
