"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Heading = { id: string; title: string };

export function DocsArticle({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const article = useRef<HTMLElement>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  useEffect(() => {
    // Read the committed article after layout, including MDX headings.
    const frame = requestAnimationFrame(() => {
      const used = new Set<string>();
      const entries = Array.from(article.current?.querySelectorAll("h2") ?? []).map((heading, index) => {
        const title = heading.textContent ?? "";
        const base = heading.id || title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `section-${index + 1}`;
        let id = base;
        while (used.has(id)) id += `-${index + 1}`;
        used.add(id);
        heading.id = id;
        return { id, title };
      });
      setHeadings(entries);
      if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return <div className="docs-reading-layout sr-page-enter"><article ref={article} className="docs-prose">{children}</article><aside className="docs-toc">{headings.length > 0 && <nav aria-label="On this page"><p>On this page</p>{headings.map(heading => <a href={`#${heading.id}`} key={heading.id}>{heading.title}</a>)}</nav>}</aside></div>;
}
