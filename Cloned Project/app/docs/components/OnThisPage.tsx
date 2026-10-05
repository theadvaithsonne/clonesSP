"use client";

import { useEffect, useState } from "react";

/**
 * Scroll-spy over the chapter's headings.
 *
 * IntersectionObserver alone picks the wrong heading when several are on
 * screen, so the observer only records visibility and the topmost visible
 * heading wins. Falls back to the last heading scrolled past, which is what
 * a reader in the middle of a long section expects to see highlighted.
 */
export default function OnThisPage({
  items,
}: {
  items: { id: string; text: string }[];
}) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    if (!items.length) return;
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }
        const first = items.find((item) => visible.has(item.id));
        if (first) {
          setActive(first.id);
          return;
        }
        const passed = items.filter((item) => {
          const element = document.getElementById(item.id);
          return element ? element.getBoundingClientRect().top < 120 : false;
        });
        if (passed.length) setActive(passed[passed.length - 1].id);
      },
      { rootMargin: "-72px 0px -62% 0px" }
    );

    for (const item of items) {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [items]);

  if (!items.length) return <aside className="doc-toc" />;

  return (
    <aside className="doc-toc">
      <h2>On this page</h2>
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} data-active={active === item.id}>
          {item.text}
        </a>
      ))}
    </aside>
  );
}
