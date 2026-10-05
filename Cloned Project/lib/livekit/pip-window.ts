// Shared Document Picture-in-Picture primitives.
// Used by both the global meet PipProvider and the webinar PiP hook.

export const isDocumentPipSupported = () =>
  typeof window !== "undefined" && "documentPictureInPicture" in window;

export interface PipWindowOptions {
  width?: number;
  height?: number;
  /** Skip if the host document is already visible (avoids empty-PiP overlap). */
  skipIfVisible?: boolean;
}

export async function requestPipWindow(
  opts: PipWindowOptions = {},
): Promise<Window | null> {
  if (!isDocumentPipSupported()) return null;
  const { width = 340, height = 240, skipIfVisible = true } = opts;
  if (skipIfVisible && typeof document !== "undefined" && !document.hidden) {
    return null;
  }

  try {
    // @ts-expect-error - Document PiP API not in TS lib yet
    const pip: Window = await documentPictureInPicture.requestWindow({
      width,
      height,
    });

    for (const sheet of document.styleSheets) {
      try {
        if (sheet.href) {
          const link = pip.document.createElement("link");
          link.rel = "stylesheet";
          link.href = sheet.href;
          pip.document.head.appendChild(link);
        } else if (sheet.cssRules) {
          const style = pip.document.createElement("style");
          for (const rule of sheet.cssRules) {
            style.textContent += rule.cssText + "\n";
          }
          pip.document.head.appendChild(style);
        }
      } catch {
        // cross-origin stylesheets — skip
      }
    }

    pip.document.documentElement.style.height = "100%";
    pip.document.documentElement.style.margin = "0";
    // The PiP document is a fresh window with no prefers-color-scheme
    // inheritance — declaring it dark keeps scrollbars, form controls and
    // any un-styled default surface from rendering light over the call.
    pip.document.documentElement.style.colorScheme = "dark";
    pip.document.body.style.height = "100%";
    pip.document.body.style.margin = "0";
    pip.document.body.style.padding = "0";
    pip.document.body.style.backgroundColor = "#181818";
    pip.document.body.style.color = "#ffffff";
    pip.document.body.style.overflow = "hidden";

    const mountEl = pip.document.createElement("div");
    mountEl.id = "pip-root";
    mountEl.style.width = "100%";
    mountEl.style.height = "100%";
    pip.document.body.appendChild(mountEl);

    return pip;
  } catch (err) {
    if (err instanceof DOMException && err.name === "NotAllowedError") return null;
    console.error("[PiP] requestWindow failed:", err);
    return null;
  }
}

export function createCanvasMediaStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 2, 2);
  }
  return canvas.captureStream(1);
}
