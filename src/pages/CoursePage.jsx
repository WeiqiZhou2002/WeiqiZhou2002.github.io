import React from "react";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import PageShell from "../components/PageShell.jsx";
import { courses } from "../data/site.js";

export default function CoursePage() {
  const timelineRef = React.useRef(null);
  useDragScroll(timelineRef);

  const terms = [...new Set(courses.map((course) => course.term))];

  const scrollByCard = (direction) => {
    timelineRef.current?.scrollBy({ left: direction * 360, behavior: "smooth" });
  };

  const jumpToTerm = (term) => {
    const node = timelineRef.current?.querySelector(`[data-term="${term}"]`);
    node?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <PageShell
      eyebrow="Course timeline"
      title="A draggable map of graduate and undergraduate coursework."
      intro="Courses are grouped chronologically, with project links surfaced where available."
    >
      <div className="timeline-controls">
        <div className="term-jump">
          {terms.map((term) => (
            <button key={term} type="button" onClick={() => jumpToTerm(term)}>
              {term}
            </button>
          ))}
        </div>
        <div className="timeline-arrows" aria-label="Timeline navigation">
          <button type="button" onClick={() => scrollByCard(-1)} aria-label="Scroll timeline left">
            <ChevronLeft size={19} />
          </button>
          <button type="button" onClick={() => scrollByCard(1)} aria-label="Scroll timeline right">
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      <div className="timeline-wrap" ref={timelineRef}>
        <div className="timeline-line" />
        {courses.map((course) => (
          <article className="course-card" data-term={course.term} key={`${course.term}-${course.title}`}>
            <span className="course-dot" />
            <div className="course-meta">
              <span>{course.term}</span>
              <strong>{course.school}</strong>
            </div>
            <h2>{course.title}</h2>
            <h3>{course.name}</h3>
            <p>{course.body}</p>
            <div className="course-footer">
              <span>{course.grade}</span>
              <span>{course.level}</span>
              {course.href && (
                <a href={course.href} target="_blank" rel="noreferrer">
                  Project
                  <ArrowUpRight size={14} />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </PageShell>
  );
}

function useDragScroll(ref) {
  React.useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    let isDown = false;
    let startX = 0;
    let startLeft = 0;

    const onPointerDown = (event) => {
      isDown = true;
      startX = event.clientX;
      startLeft = node.scrollLeft;
      node.classList.add("is-dragging");
      node.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
      if (!isDown) return;
      node.scrollLeft = startLeft - (event.clientX - startX);
    };

    const stop = () => {
      isDown = false;
      node.classList.remove("is-dragging");
    };

    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", stop);
    node.addEventListener("pointerleave", stop);

    return () => {
      node.removeEventListener("pointerdown", onPointerDown);
      node.removeEventListener("pointermove", onPointerMove);
      node.removeEventListener("pointerup", stop);
      node.removeEventListener("pointerleave", stop);
    };
  }, [ref]);
}
