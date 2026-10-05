// Boards with mode "test" are developer-only: they are served only when the
// request comes from a frontend running at http://localhost:3000. A browser
// always sends its page's Origin (or at least Referer) on API calls, so the
// deployed sites (bat246.com, gotobigwin.com, ...) can never reach them.
const LOCAL_FRONTEND = "http://localhost:3000";

export function isLocalFrontend(origin?: string | null, referer?: string | null): boolean {
  if (origin) return origin === LOCAL_FRONTEND;
  return !!referer && (referer === LOCAL_FRONTEND || referer.startsWith(LOCAL_FRONTEND + "/"));
}

/** Convenience for controllers: reads the headers off an Express request. */
export function requestIsFromLocalFrontend(req: { headers?: Record<string, any> }): boolean {
  return isLocalFrontend(req?.headers?.origin, req?.headers?.referer);
}
