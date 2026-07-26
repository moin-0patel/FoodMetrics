import { useEffect } from "react";

// Lightweight per-page <head> control for the public pages. No SSR / helmet lib —
// we just set document.title + the description/robots meta tags on mount and
// restore the previous values on unmount so the app's default title returns.

function upsertMeta(name: string, content: string): { el: HTMLMetaElement; prev: string | null; created: boolean } {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  let created = false;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
    created = true;
  }
  const prev = el.getAttribute("content");
  el.setAttribute("content", content);
  return { el, prev, created };
}

export function usePageMeta({
  title,
  description,
  noindex = false,
}: {
  title: string;
  description?: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    const cleanups: Array<() => void> = [];
    if (description) {
      const { el, prev, created } = upsertMeta("description", description);
      cleanups.push(() => (created ? el.remove() : prev !== null && el.setAttribute("content", prev)));
    }
    if (noindex) {
      const { el, prev, created } = upsertMeta("robots", "noindex, nofollow");
      cleanups.push(() => (created ? el.remove() : prev !== null && el.setAttribute("content", prev)));
    }

    return () => {
      document.title = prevTitle;
      cleanups.forEach((fn) => fn());
    };
  }, [title, description, noindex]);
}
