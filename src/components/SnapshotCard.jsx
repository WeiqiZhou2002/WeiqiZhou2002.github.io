import { ArrowRight } from "lucide-react";

export default function SnapshotCard({ icon: Icon, eyebrow, title, body, href }) {
  return (
    <a className="snapshot-card" href={href}>
      <span className="snapshot-icon">
        <Icon size={21} />
      </span>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{body}</p>
      <span className="text-link">
        Open
        <ArrowRight size={16} />
      </span>
    </a>
  );
}
