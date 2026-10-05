import { parseColumns, type ComponentBlock } from "./block-factory";
import { buildPreheaderExportFragments } from "./preheader-block";
import { renderFooterEmail } from "./footer-block";
import { renderSocialIconsEmail } from "./social-icons";

export function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function isTrue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
  }
  return false;
}

function renderTextEmail(s: Record<string, string>, content: Record<string, string>): string {
  const bg = s.backgroundColor === "transparent" ? "" : `background-color:${s.backgroundColor};`;
  return `<tr><td style="padding:${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px;font-size:${s.fontSize}px;color:${s.color};${bg}text-align:${s.textAlign};line-height:${s.lineHeight};font-weight:${s.fontWeight};font-family:Arial,Helvetica,sans-serif;">${content.html}</td></tr>`;
}

function headingDecorationCss(s: Record<string, string>): string {
  const parts: string[] = [];
  if (s.decorationUnderline === "true") parts.push("underline");
  if (s.decorationLineThrough === "true") parts.push("line-through");
  return parts.length ? `text-decoration:${parts.join(" ")};` : "text-decoration:none;";
}

function renderHeadingEmail(s: Record<string, string>, content: Record<string, string>): string {
  const text = esc(content.text || "Your heading here");
  const bg = s.backgroundColor && s.backgroundColor !== "transparent" ? `background-color:${s.backgroundColor};` : "";
  const borderBottom = isTrue(s.borderBottomEnabled)
    ? `border-bottom:${s.borderBottomWidth}px solid ${s.borderBottomColor};` : "";
  const letterSpacing = Number(s.letterSpacing) !== 0 ? `letter-spacing:${s.letterSpacing}px;` : "";
  const textTransform = s.textTransform !== "none" ? `text-transform:${s.textTransform};` : "";
  const fontFamily = s.fontFamily || "Arial, Helvetica, sans-serif";
  const inner = `<p role="heading" aria-level="${content.level || "2"}" style="margin:${s.marginTop}px 0 ${s.marginBottom}px 0;padding:0;font-size:${s.fontSize}px;color:${s.color};font-weight:${s.fontWeight};text-align:${s.textAlign};line-height:${s.lineHeight};${textTransform}${letterSpacing}${headingDecorationCss(s)}font-family:${fontFamily};">${text}</p>`;
  const wrapper = borderBottom
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;"><tr><td style="padding:0;font-family:${fontFamily};">${inner}</td></tr><tr><td style="padding:0;line-height:0;font-size:0;${borderBottom}">&nbsp;</td></tr></table>`
    : inner;
  return `<tr><td style="padding:${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px;font-family:${fontFamily};${bg}">${wrapper}</td></tr>`;
}

/**
 * Email-safe alignment row. Uses td align + text-align with inline-level content
 * so centering works in Gmail, Outlook, and in-app preview (Tailwind sets img to block).
 */
function wrapAlignedEmailRow(
  innerHtml: string,
  align: "left" | "right" | "center",
  outerPadding: string,
  rowClass = "",
): string {
  const classAttr = rowClass ? ` class="${rowClass}"` : "";
  return `<tr><td align="${align}"${classAttr} style="${outerPadding}text-align:${align};font-size:0;line-height:0;mso-line-height-rule:exactly;">${innerHtml}</td></tr>`;
}

function normalizeAlign(value: string | undefined): "left" | "right" | "center" {
  const normalized = (value || "center").trim().toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "right") return "right";
  return "center";
}

function renderLogoEmail(s: Record<string, string>, content: Record<string, string>, isNested?: boolean): string {
  const align = normalizeAlign(s.align);
  const padX = Number(s.paddingX) || 24;
  const bg = s.backgroundColor && s.backgroundColor !== "transparent" ? `background-color:${s.backgroundColor};` : "";
  const opacity = Number(s.opacity) < 100 ? `opacity:${Number(s.opacity) / 100};` : "";
  const radius = Number(s.borderRadius) > 0 ? `border-radius:${s.borderRadius}px;` : "";
  const displayWidth = Number(s.width) || 150;
  const heightStyle = s.height === "auto" ? "height:auto;" : `height:${s.height}px;`;
  const outerPadding = `padding:${s.paddingTop}px ${padX}px ${s.paddingBottom}px ${padX}px;${bg}font-family:Arial,Helvetica,sans-serif;`;

  if (!content.src) {
    const fallback = content.fallbackText?.trim();
    if (!fallback) return "";
    return wrapAlignedEmailRow(
      `<p style="margin:0;font-size:18px;font-weight:600;color:#111827;">${esc(fallback)}</p>`,
      align,
      outerPadding,
      "logo-row",
    );
  }

  const alt = esc(content.alt || content.fallbackText || "Logo");
  const titleAttr = content.fallbackText ? ` title="${esc(content.fallbackText)}"` : "";
  const retinaHint = isTrue(s.retinaOptimized) ? "-ms-interpolation-mode:bicubic;" : "";
  const imgWidth = isNested ? "100%" : `${displayWidth}px`;
  const imgAlignAttr = align === "center" ? ' align="center"' : align === "right" ? ' align="right"' : ' align="left"';
  const imgDisplay = align === "center" || isNested ? "inline" : "block";
  const img = `<img src="${esc(content.src)}" alt="${alt}"${titleAttr}${imgAlignAttr} width="${displayWidth}" style="display:${imgDisplay};float:none;vertical-align:middle;max-width:100%;width:${imgWidth};${heightStyle}${radius}${opacity}${retinaHint}border:0;outline:none;text-decoration:none;" />`;
  const linked = content.link?.trim()
    ? `<a href="${esc(content.link)}" target="_blank" style="text-decoration:none;border:0;display:inline;">${img}</a>`
    : img;

  return wrapAlignedEmailRow(linked, align, outerPadding, "logo-row");
}

function renderImageEmail(s: Record<string, string>, content: Record<string, string>, isNested?: boolean): string {
  if (!content.src) return "";
  const align = normalizeAlign(s.align);
  const border = s.borderStyle !== "none" && Number(s.borderWidth) > 0
    ? `border:${s.borderWidth}px ${s.borderStyle} ${s.borderColor};` : "";
  const radius = Number(s.borderRadius) > 0 ? `border-radius:${s.borderRadius}px;` : "";
  const displayWidth = Number(s.width) || 600;
  const imgAlignAttr = align === "center" ? ' align="center"' : align === "right" ? ' align="right"' : ' align="left"';
  const imgDisplay = align === "center" || isNested ? "inline" : "block";
  const img = `<img src="${esc(content.src)}" alt="${esc(content.alt || "")}"${imgAlignAttr} width="${isNested ? "100%" : displayWidth}" style="display:${imgDisplay};float:none;vertical-align:middle;max-width:100%;width:${isNested ? "100%" : displayWidth + "px"};height:${s.height === "auto" ? "auto" : s.height + "px"};${radius}${border}border:0;outline:none;text-decoration:none;" />`;
  const linked = content.link
    ? `<a href="${esc(content.link)}" target="_blank" style="text-decoration:none;border:0;display:inline;${isNested ? "width:100%;" : ""}">${img}</a>`
    : img;

  const padL = Number(s.paddingLeft) || 0;
  const padR = Number(s.paddingRight) || 0;
  const outerPadding = `padding:${s.paddingTop}px ${padR}px ${s.paddingBottom}px ${padL}px;`;

  return wrapAlignedEmailRow(linked, align, outerPadding, "image-row");
}

function renderButtonEmail(s: Record<string, string>, content: Record<string, string>): string {
  const align = s.align === "full" ? "center" : s.align === "left" ? "left" : s.align === "right" ? "right" : "center";
  const radius = Number(s.borderRadius) > 0 ? `border-radius:${s.borderRadius}px;` : "";
  const outlined = s.variant === "outlined" ? `border:${s.borderWidth}px solid ${s.borderColor};` : "";
  const filled = s.variant === "filled" ? `background-color:${s.backgroundColor};` : "";
  const target = content.openInNewTab === "true" ? ' target="_blank"' : "";
  const width = s.align === "full" ? "display:block;width:100%;box-sizing:border-box;text-align:center;" : "display:inline-block;";
  return `<tr><td align="${align}" style="padding:${s.marginTop}px ${s.marginRight}px ${s.marginBottom}px ${s.marginLeft}px;text-align:${align};font-family:Arial,Helvetica,sans-serif;"><a href="${esc(content.url || "#")}"${target} style="${width}padding:${s.paddingY}px ${s.paddingX}px;${filled}color:${s.color};text-decoration:none;${radius}font-size:${s.fontSize}px;font-weight:${s.fontWeight};${outlined}font-family:Arial,Helvetica,sans-serif;">${esc(content.text)}</a></td></tr>`;
}

function renderDividerEmail(s: Record<string, string>): string {
  const align = normalizeAlign(s.align);
  const opacity = Number(s.opacity) < 100 ? `opacity:${Number(s.opacity) / 100};` : "";
  const widthPercent = Math.max(1, Math.min(100, Number(s.width) || 100));
  const spacerPercent = 100 - widthPercent;
  const lineStyle = `font-size:0;line-height:0;border-top:${s.borderWidth}px ${s.borderStyle} ${s.borderColor};`;
  const spacerStyle = `font-size:0;line-height:0;`;

  // Spacer-column pattern — the only reliable Gmail approach for partial-width dividers.
  // left:  [divider | spacer], center: [half-spacer | divider | half-spacer], right: [spacer | divider]
  let cells: string;
  if (widthPercent >= 100) {
    cells = `<td width="100%" style="width:100%;${lineStyle}">&nbsp;</td>`;
  } else if (align === "left") {
    cells = `<td width="${widthPercent}%" style="width:${widthPercent}%;${lineStyle}">&nbsp;</td><td width="${spacerPercent}%" style="width:${spacerPercent}%;${spacerStyle}">&nbsp;</td>`;
  } else if (align === "right") {
    cells = `<td width="${spacerPercent}%" style="width:${spacerPercent}%;${spacerStyle}">&nbsp;</td><td width="${widthPercent}%" style="width:${widthPercent}%;${lineStyle}">&nbsp;</td>`;
  } else {
    const half = Math.floor(spacerPercent / 2);
    const otherHalf = spacerPercent - half;
    cells = `<td width="${half}%" style="width:${half}%;${spacerStyle}">&nbsp;</td><td width="${widthPercent}%" style="width:${widthPercent}%;${lineStyle}">&nbsp;</td><td width="${otherHalf}%" style="width:${otherHalf}%;${spacerStyle}">&nbsp;</td>`;
  }

  const wrapper = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;${opacity}"><tr>${cells}</tr></table>`;
  return `<tr><td style="padding:${s.marginTop}px 24px ${s.marginBottom}px 24px;">${wrapper}</td></tr>`;
}

function renderSpacerEmail(s: Record<string, string>): string {
  return `<tr><td style="height:${s.height}px;line-height:${s.height}px;font-size:1px;">&nbsp;</td></tr>`;
}

function renderColumnsEmail(s: Record<string, string>, content: Record<string, string>): string {
  const columns = parseColumns(content.columns);
  if (columns.length === 0) return "";
  const gap = Number(s.gap) || 0;
  const totalGap = gap * (columns.length - 1);
  const containerWidth = 600 - Number(s.paddingLeft || 0) - Number(s.paddingRight || 0);

  const colsHtml = columns.map((col, i) => {
    const colWidth = Math.floor((containerWidth - totalGap) * col.width / 100);
    const cellPad = i < columns.length - 1 ? `padding-right:${gap}px;` : "";
    const nested = col.components.map((c) => renderComponentEmail(c, true)).join("");
    const inner = nested || `<p style="margin:0;font-size:13px;color:#999;font-family:Arial,Helvetica,sans-serif;">Column ${i + 1}</p>`;
    return `<td class="col-stack" width="${colWidth}" style="width:${colWidth}px;vertical-align:top;${cellPad}" valign="top"><table role="presentation" width="100%" style="width:100%;border-collapse:collapse;">${inner}</table></td>`;
  }).join("");

  const stackClass = s.stackOnMobile === "true" ? "stack-on-mobile" : "";
  return `<tr><td style="padding:${s.paddingTop}px ${s.paddingRight}px ${s.paddingBottom}px ${s.paddingLeft}px;"><table role="presentation" width="100%" class="${stackClass}" style="width:100%;border-collapse:collapse;"><tr>${colsHtml}</tr></table></td></tr>`;
}

function renderComponentEmail(block: ComponentBlock, isNested?: boolean): string {
  switch (block.type) {
    case "preheader": return "";
    case "logo": return renderLogoEmail(block.styles, block.content, isNested);
    case "heading": return renderHeadingEmail(block.styles, block.content);
    case "text": return renderTextEmail(block.styles, block.content);
    case "image": return renderImageEmail(block.styles, block.content, isNested);
    case "button": return renderButtonEmail(block.styles, block.content);
    case "divider": return renderDividerEmail(block.styles);
    case "spacer": return renderSpacerEmail(block.styles);
    case "columns": return renderColumnsEmail(block.styles, block.content);
    case "socialIcons": return renderSocialIconsEmail(block.styles, block.content, esc);
    case "footer": return renderFooterEmail(block.styles, block.content, esc);
    default: return "";
  }
}

/** Table body fragment for in-app preview panes (no full HTML document wrapper). */
export function renderEmailTableBody(components: ComponentBlock[]): string {
  const { hiddenHtml, visibleRows } = buildPreheaderExportFragments(components, esc);
  const mainComponents = components.filter((c) => c.type !== "preheader");
  const body = mainComponents.map((c) => renderComponentEmail(c)).join("\n");
  const tableBody = `${visibleRows}${visibleRows && body ? "\n" : ""}${body}`;
  return `${hiddenHtml}<table role="presentation" style="width:100%;border-collapse:collapse;">${tableBody}</table>`;
}

export function exportToHTML(components: ComponentBlock[], title?: string): string {
  const mainComponents = components.filter((c) => c.type !== "preheader");
  const { hiddenHtml, visibleRows } = buildPreheaderExportFragments(components, esc);
  const body = mainComponents.map((c) => renderComponentEmail(c)).join("\n              ");
  const tableBody = `${visibleRows}${visibleRows && body ? "\n              " : ""}${body}`;

  const socialBlock = components.find((c) => c.type === "socialIcons");
  const s = socialBlock?.styles || {};
  const hoverEffect = s.hoverEffect || "grow";
  const hoverColor = s.hoverColor || "#f5c518";

  let hoverCss = "";
  if (hoverEffect === "grow") {
    hoverCss = `
    .social-link {
      display: inline-block;
      transition: transform 150ms ease-in-out !important;
    }
    .social-link:hover {
      transform: scale(1.1) !important;
    }`;
  } else if (hoverEffect === "lift") {
    hoverCss = `
    .social-link {
      display: inline-block;
      transition: transform 150ms ease-in-out !important;
    }
    .social-link:hover {
      transform: translateY(-4px) !important;
    }`;
  } else if (hoverEffect === "color-change") {
    hoverCss = `
    .social-link {
      display: inline-block;
      transition: background-color 150ms ease-in-out !important;
    }
    .social-link:hover {
      background-color: ${hoverColor} !important;
    }`;
  } else {
    hoverCss = `
    .social-link {
      display: inline-block;
    }`;
  }

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${esc(title || "Email Template")}</title>
  <!--[if mso]>
  <style type="text/css">
    table {border-collapse:collapse;}
    td {font-family:Arial,sans-serif;}
  </style>
  <![endif]-->
  <style type="text/css">
    body { margin:0; padding:0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    .logo-row img, .image-row img { float:none !important; vertical-align:middle !important; }
    a { text-decoration:none; }
    ul { list-style-type: disc !important; padding-left: 20px !important; margin: 8px 0 !important; }
    ol { list-style-type: decimal !important; padding-left: 20px !important; margin: 8px 0 !important; }
    li { margin: 4px 0 !important; }
    @media only screen and (max-width:620px) {
      .email-container { width:100% !important; }
      .stack-on-mobile > tr > td, .stack-on-mobile > tbody > tr > td, .col-stack { display:block !important; width:100% !important; padding-right:0 !important; }
      .preheader-hide-mobile { display:none !important; }
    }
    @media only screen and (min-width:621px) {
      .preheader-show-mobile { display:none !important; }
    }
    ${hoverCss}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  ${hiddenHtml}
  <table role="presentation" style="width:100%;border-collapse:collapse;background-color:#f3f4f6;">
    <tr>
      <td style="padding:24px 0;" align="center">
        <table role="presentation" class="email-container" style="width:600px;max-width:600px;border-collapse:collapse;background-color:#ffffff;">
              ${tableBody}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Prefer fresh client render from components so preview matches the editor. */
export function resolveTemplatePreviewHtml(template: {
  components?: ComponentBlock[];
  htmlBody?: string;
  name?: string;
}): string {
  if (template.components?.length) {
    return exportToHTML(template.components, template.name);
  }
  return template.htmlBody || "";
}

/** Re-export stored htmlBody from current components before send/launch. */
export function buildTemplateHtmlBody(
  components: ComponentBlock[],
  name?: string,
): string {
  return exportToHTML(components, name);
}
