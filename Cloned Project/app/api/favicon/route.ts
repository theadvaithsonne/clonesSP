import { NextRequest } from "next/server";

type Cand = { url: string; hint?: string; sizes?: string; rel?: string };

function toAbs(href: string, base: URL) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseIcons(html: string, base: URL): Cand[] {
  const out: Cand[] = [];
  const linkRe = /<link[^>]+>/gi;
  const attr = (tag: string, name: string) => {
    const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
    return m?.[1];
  };

  for (const tag of html.match(linkRe) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase() ?? "";
    if (
      !/(^|\s)(icon|shortcut icon|apple-touch-icon|apple-touch-icon-precomposed|mask-icon)(\s|$)/.test(
        rel
      )
    )
      continue;
    const href = attr(tag, "href");
    if (!href) continue;
    out.push({
      url: toAbs(href, base),
      sizes: attr(tag, "sizes") ?? undefined,
      rel,
      hint: attr(tag, "type") ?? undefined,
    });
  }
  return out;
}

function byPreference(a: Cand, b: Cand) {
  // prefer apple-touch-icon, then icon, then others; then larger sizes
  const rank = (c: Cand) =>
    /apple-touch-icon/.test(c.rel || "")
      ? 3
      : /(^|\s)icon(\s|$)/.test(c.rel || "")
      ? 2
      : 1;
  const rDiff = rank(b) - rank(a);
  if (rDiff !== 0) return rDiff;

  const sizeToInt = (s?: string) => {
    if (!s) return 0;
    // sizes like "180x180 32x32"
    const nums = s.split(/\s+/).map((p) => {
      const m = /(\d+)\s*x\s*(\d+)/i.exec(p);
      return m ? Math.min(+m[1], +m[2]) : 0;
    });
    return Math.max(0, ...nums);
  };
  return sizeToInt(b.sizes) - sizeToInt(a.sizes);
}

export async function GET(req: NextRequest) {
  try {
    const urlParam = req.nextUrl.searchParams.get("url");
    const size = req.nextUrl.searchParams.get("sz") || "96";
    if (!urlParam) return new Response("Missing url", { status: 400 });

    const base = new URL(urlParam);

    // 1) Try parse HTML for explicit icons
    let candidates: Cand[] = [];
    try {
      const htmlRes = await fetch(base.toString(), { redirect: "follow" });
      if (
        htmlRes.ok &&
        htmlRes.headers.get("content-type")?.includes("text/html")
      ) {
        const html = await htmlRes.text();
        candidates = parseIcons(html, base).sort(byPreference);
      }
    } catch {}

    // 2) Add common paths
    candidates.push(
      { url: toAbs("/favicon.ico", base) },
      { url: toAbs("/favicon.png", base) },
      { url: toAbs("/apple-touch-icon.png", base) }
    );

    // 3) Add providers (last resort)
    candidates.push(
      {
        url: `https://www.google.com/s2/favicons?sz=${size}&domain=${base.hostname}`,
      },
      { url: `https://icons.duckduckgo.com/ip3/${base.hostname}.ico` }
    );

    // 4) Fetch first working image & proxy it
    for (const c of candidates) {
      try {
        const r = await fetch(c.url, { redirect: "follow" });
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || !/^image\//i.test(ct)) continue;
        const buf = await r.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "content-type": ct,
            "cache-control": "public, max-age=86400, s-maxage=86400",
          },
        });
      } catch {}
    }

    return new Response(null, { status: 404 });
  } catch (e) {
    return new Response("Error", { status: 500 });
  }
}
