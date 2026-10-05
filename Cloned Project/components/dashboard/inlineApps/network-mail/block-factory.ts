import {
  createSocialIconsBlockContent,
  createSocialIconsBlockStyles,
} from "./social-icons";
import {
  createFooterBlockContent,
  createFooterBlockStyles,
} from "./footer-block";
import {
  createPreheaderBlockContent,
  createPreheaderBlockStyles,
} from "./preheader-block";

export type BlockType =
  | "text"
  | "preheader"
  | "heading"
  | "logo"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "socialIcons"
  | "footer";

export interface ComponentBlock {
  id: string;
  type: BlockType;
  content: Record<string, string>;
  styles: Record<string, string>;
}

export interface ColumnData {
  id: string;
  width: number;
  components: ComponentBlock[];
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function parseColumns(json: string): ColumnData[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}

export function serializeColumns(cols: ColumnData[]): string {
  return JSON.stringify(cols);
}

export function makeColumnsContent(count: number): ColumnData[] {
  const w = Math.floor(100 / count);
  return Array.from({ length: count }, (_, i) => ({
    id: makeId(),
    width: i === count - 1 ? 100 - w * (count - 1) : w,
    components: [],
  }));
}

export function createComponent(type: BlockType): ComponentBlock {
  const id = makeId();
  switch (type) {
    case "preheader":
      return {
        id,
        type: "preheader",
        content: createPreheaderBlockContent(),
        styles: createPreheaderBlockStyles(),
      };
    case "logo":
      return {
        id,
        type: "logo",
        content: {
          src: "",
          alt: "Company Logo",
          link: "",
          fallbackText: "",
          darkModeSrc: "",
        },
        styles: {
          width: "150",
          widthPreset: "medium",
          height: "auto",
          aspectLock: "true",
          align: "center",
          opacity: "100",
          backgroundColor: "transparent",
          borderRadius: "0",
          paddingTop: "24",
          paddingBottom: "24",
          paddingX: "16",
          retinaOptimized: "true",
        },
      };
    case "heading":
      return {
        id,
        type: "heading",
        content: { text: "Your heading here", level: "2" },
        styles: {
          fontSize: "30",
          color: "#000000",
          fontWeight: "600",
          textAlign: "left",
          textTransform: "none",
          letterSpacing: "0",
          decorationUnderline: "false",
          decorationLineThrough: "false",
          lineHeight: "1.3",
          backgroundColor: "transparent",
          borderBottomEnabled: "false",
          borderBottomWidth: "2",
          borderBottomColor: "#e5e7eb",
          paddingTop: "16",
          paddingRight: "16",
          paddingBottom: "16",
          paddingLeft: "16",
          marginTop: "0",
          marginBottom: "16",
          fontFamily: "Arial, sans-serif",
        },
      };
    case "text":
      return {
        id,
        type,
        content: { html: "Enter your text here...", plainText: "Enter your text here..." },
        styles: {
          fontSize: "16",
          color: "#333333",
          backgroundColor: "transparent",
          fontWeight: "400",
          lineHeight: "1.6",
          textAlign: "left",
          fontStyle: "normal",
          textDecoration: "none",
          paddingTop: "12",
          paddingRight: "24",
          paddingBottom: "12",
          paddingLeft: "24",
        },
      };
    case "image":
      return {
        id,
        type,
        content: { src: "", alt: "", link: "" },
        styles: {
          width: "600",
          height: "auto",
          objectFit: "cover",
          align: "center",
          borderRadius: "0",
          borderWidth: "0",
          borderColor: "#e5e7eb",
          borderStyle: "none",
          paddingTop: "12",
          paddingRight: "0",
          paddingBottom: "12",
          paddingLeft: "0",
        },
      };
    case "button":
      return {
        id,
        type,
        content: { text: "Click Me", url: "#", openInNewTab: "true" },
        styles: {
          variant: "filled",
          backgroundColor: "var(--brand)",
          color: "#ffffff",
          borderColor: "var(--brand)",
          borderWidth: "2",
          fontSize: "16",
          fontWeight: "600",
          paddingX: "32",
          paddingY: "14",
          borderRadius: "8",
          align: "center",
          marginTop: "12",
          marginRight: "0",
          marginBottom: "12",
          marginLeft: "0",
        },
      };
    case "divider":
      return {
        id,
        type,
        content: {},
        styles: {
          borderStyle: "solid",
          borderWidth: "1",
          borderColor: "#e5e7eb",
          opacity: "100",
          width: "100",
          align: "center",
          marginTop: "16",
          marginBottom: "16",
        },
      };
    case "spacer":
      return {
        id,
        type,
        content: {},
        styles: { height: "32", mobileHeight: "32", matchDesktop: "true" },
      };
    case "columns":
      return {
        id,
        type,
        content: { columns: serializeColumns(makeColumnsContent(2)) },
        styles: {
          gap: "16",
          paddingTop: "0",
          paddingRight: "0",
          paddingBottom: "0",
          paddingLeft: "0",
          stackOnMobile: "true",
          mobileOrder: "ltr",
        },
      };
    case "socialIcons":
      return {
        id,
        type: "socialIcons",
        content: createSocialIconsBlockContent(),
        styles: createSocialIconsBlockStyles(),
      };
    case "footer":
      return {
        id,
        type: "footer",
        content: createFooterBlockContent(),
        styles: createFooterBlockStyles(),
      };
  }
}

/** @alias createComponent */
export const createBlock = createComponent;
