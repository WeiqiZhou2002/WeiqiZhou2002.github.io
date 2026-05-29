import { ArrowUpRight } from "lucide-react";
import PageShell from "../components/PageShell.jsx";
import { projects } from "../data/site.js";

export default function ProjectsPage() {
  return (
    <PageShell
      eyebrow="Selected projects"
      title="A focused shelf of things I am building."
      intro="The project page keeps the homepage lighter and gives each build enough room to breathe."
    >
      <div className="project-grid page-grid">
        {projects.map((project) => {
          const Icon = project.icon;
          const isExternal = project.href.startsWith("http");
          return (
            <a className="project-card" href={project.href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noreferrer" : undefined} key={project.title}>
              <span className="project-icon">
                <Icon size={21} />
              </span>
              <span className="project-meta">{project.meta}</span>
              <h2>{project.title}</h2>
              <p>{project.body}</p>
              <div className="tag-row">
                {project.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              <span className="project-link">
                {isExternal ? "Open" : "Details"}
                <ArrowUpRight size={16} />
              </span>
            </a>
          );
        })}
      </div>
    </PageShell>
  );
}
