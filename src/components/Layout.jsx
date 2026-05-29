import { Github, Mail } from "lucide-react";
import { routes } from "../data/site.js";

export function Header({ route }) {
  return (
    <header className="site-header">
      <a className="logo" href="#/" aria-label="Weiqi Zhou home">
        <span>WZ</span>
        Weiqi Zhou
      </a>
      <nav aria-label="Primary navigation">
        {routes.map((item) => (
          <a className={route === item.path ? "is-active" : ""} href={`#${item.path}`} key={item.id}>
            {item.label}
          </a>
        ))}
      </nav>
      <a className="header-link" href="mailto:wez092@ucsd.edu">
        <Mail size={16} />
        Contact
      </a>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <span>© 2026 Weiqi Zhou</span>
      <div>
        <a href="mailto:wez092@ucsd.edu">
          <Mail size={16} />
          Email
        </a>
        <a href="https://github.com/WeiqiZhou2002" target="_blank" rel="noreferrer">
          <Github size={16} />
          GitHub
        </a>
      </div>
    </footer>
  );
}
