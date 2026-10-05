import type { CmsModule, CmsModuleType } from "./types";
import { makeColumns } from "./columns";
import { newModuleId } from "./ids";

export { newModuleId };

export type ModuleLibraryItem = {
  type: CmsModuleType;
  label: string;
  category: "Layout" | "Content" | "Lead Form" | "Media" | "Social Proof" | "Advanced";
  disabled?: boolean;
};

export const COLUMN_ADDABLE_TYPES: CmsModuleType[] = [
  "logo",
  "heading",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
  "social_icons",
  "footer",
  "lead_form",
];

export const MODULE_LIBRARY: ModuleLibraryItem[] = [
  { type: "section", label: "Section", category: "Layout" },
  { type: "columns", label: "Columns", category: "Layout" },
  { type: "two_column", label: "Two Column", category: "Layout" },
  { type: "three_column", label: "Three Column", category: "Layout" },
  { type: "hero", label: "Hero Block", category: "Layout" },
  { type: "container", label: "Container", category: "Layout" },
  { type: "logo", label: "Logo", category: "Content" },
  { type: "heading", label: "Heading", category: "Content" },
  { type: "text", label: "Text Block", category: "Content" },
  { type: "image", label: "Image", category: "Content" },
  { type: "button", label: "Button", category: "Content" },
  { type: "divider", label: "Divider", category: "Content" },
  { type: "spacer", label: "Spacer", category: "Content" },
  { type: "social_icons", label: "Social Icons", category: "Social Proof" },
  { type: "footer", label: "Footer", category: "Advanced" },
  { type: "lead_form", label: "Lead Form", category: "Lead Form" },
];

export function createModule(type: CmsModuleType): CmsModule {
  const id = newModuleId();
  switch (type) {
    case "hero":
      return {
        id,
        type,
        props: {
          background: "dark-gradient",
          heading: "Your Headline Here",
          subheading: "A short supporting sentence that explains the value of your offer.",
          buttonLabel: "Get Started",
          buttonColor: "#F5C518",
          alignment: "center",
          fontSize: 48,
          padding: { t: 40, r: 24, b: 40, l: 24 },
        },
      };
    case "section":
    case "container":
      return {
        id,
        type,
        props: {
          background: "#ffffff",
          padding: { t: 24, r: 24, b: 24, l: 24 },
          columns: makeColumns(1),
        },
      };
    case "columns":
      return {
        id,
        type,
        props: {
          gap: 16,
          padding: { t: 24, r: 24, b: 24, l: 24 },
          background: "#ffffff",
          columns: makeColumns(2),
        },
      };
    case "two_column":
      return {
        id,
        type,
        props: {
          gap: 16,
          padding: { t: 24, r: 24, b: 24, l: 24 },
          background: "#ffffff",
          columns: makeColumns(2),
        },
      };
    case "three_column":
      return {
        id,
        type,
        props: {
          gap: 12,
          padding: { t: 24, r: 24, b: 24, l: 24 },
          background: "#ffffff",
          columns: makeColumns(3),
        },
      };
    case "heading":
      return {
        id,
        type,
        props: { text: "Heading", fontSize: 28, weight: 700, alignment: "left", color: "#111111" },
      };
    case "text":
      return {
        id,
        type,
        props: { text: "Body text goes here.", fontSize: 15, color: "#555555", alignment: "left" },
      };
    case "image":
      return {
        id,
        type,
        props: { src: "", alt: "Image", borderRadius: 8, linkUrl: "" },
      };
    case "button":
      return {
        id,
        type,
        props: {
          label: "Click me",
          url: "#",
          backgroundColor: "#F5C518",
          textColor: "#000000",
          borderRadius: 8,
        },
      };
    case "divider":
      return { id, type, props: { color: "#e5e5e5", thickness: 1 } };
    case "spacer":
      return { id, type, props: { height: 32 } };
    case "lead_form":
      return {
        id,
        type,
        props: { title: "Get the Free Blueprint" },
      };
    case "logo":
      return {
        id,
        type,
        props: {
          src: "",
          alt: "Company Logo",
          link: "",
          align: "center",
          width: 150,
        },
      };
    case "social_icons":
      return {
        id,
        type,
        props: {
          align: "center",
          size: 32,
          spacing: 12,
          icons: [
            { id: newModuleId(), platform: "facebook", url: "https://facebook.com", visible: true },
            { id: newModuleId(), platform: "instagram", url: "https://instagram.com", visible: true },
            { id: newModuleId(), platform: "linkedin", url: "https://linkedin.com", visible: true },
          ],
        },
      };
    case "footer":
      return {
        id,
        type,
        props: {
          companyName: "Your Company",
          street: "123 Main Street",
          city: "San Francisco",
          state: "CA",
          zip: "94102",
          country: "United States",
          contactEmail: "hello@company.com",
          copyrightText: "© 2026 Your Company. All rights reserved.",
          links: [
            { id: newModuleId(), text: "Privacy Policy", url: "#", visible: true },
            { id: newModuleId(), text: "Terms of Service", url: "#", visible: true },
          ],
          backgroundColor: "#111111",
          textColor: "#888888",
          linkColor: "#F5C518",
        },
      };
    default:
      return { id, type, props: {} };
  }
}
