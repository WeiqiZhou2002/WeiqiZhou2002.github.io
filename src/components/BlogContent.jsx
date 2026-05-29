import React from "react";

const HORIZONTAL_RULE_PATTERN = /^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/;

function cleanContent(content) {
  return String(content || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !HORIZONTAL_RULE_PATTERN.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toBlocks(content) {
  const blocks = [];
  let current = [];

  cleanContent(content)
    .split("\n")
    .forEach((line) => {
      if (!line.trim()) {
        if (current.length) {
          blocks.push(current);
          current = [];
        }
        return;
      }
      current.push(line);
    });

  if (current.length) blocks.push(current);
  return blocks;
}

function renderInline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderParagraph(lines, blockIndex) {
  return (
    <p key={blockIndex}>
      {lines.map((line, lineIndex) => (
        <React.Fragment key={lineIndex}>
          {lineIndex > 0 && <br />}
          {renderInline(line.replace(/\s{2,}$/, ""))}
        </React.Fragment>
      ))}
    </p>
  );
}

function renderList(lines, blockIndex, ordered) {
  const items = lines.map((line) => line.replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*+]\s+/, ""));
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className="blog-list-block" key={blockIndex}>
      {items.map((item, index) => (
        <li key={index}>{renderInline(item)}</li>
      ))}
    </Tag>
  );
}

function renderBlock(lines, blockIndex) {
  if (!lines.length) return null;

  const heading = lines.length === 1 ? lines[0].match(/^(#{2,4})\s+(.+)$/) : null;
  if (heading) {
    const Tag = heading[1].length === 2 ? "h3" : "h4";
    return (
      <Tag className="blog-subheading" key={blockIndex}>
        {renderInline(heading[2])}
      </Tag>
    );
  }

  if (lines.every((line) => /^\s*[-*+]\s+/.test(line))) {
    return renderList(lines, blockIndex, false);
  }

  if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
    return renderList(lines, blockIndex, true);
  }

  if (lines.every((line) => /^\s*>/.test(line))) {
    return (
      <blockquote key={blockIndex}>
        {renderParagraph(lines.map((line) => line.replace(/^\s*>\s?/, "")), "quote")}
      </blockquote>
    );
  }

  return renderParagraph(lines, blockIndex);
}

export default function BlogContent({ content }) {
  const blocks = toBlocks(content);

  if (!blocks.length) {
    return (
      <div className="blog-content">
        <p>No content yet.</p>
      </div>
    );
  }

  return <div className="blog-content">{blocks.map(renderBlock)}</div>;
}
