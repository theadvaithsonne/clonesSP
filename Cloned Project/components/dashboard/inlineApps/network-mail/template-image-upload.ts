import { useNetworkMailEditor } from "./network-mail-editor-context";

type AssetPurpose = "logo" | "image" | "social-icon";

/** Upload via API when in editor; otherwise fall back to base64 (preview-only). */
export async function resolveEditorImageSrc(
  file: File,
  purpose: AssetPurpose,
  editor: ReturnType<typeof useNetworkMailEditor>,
): Promise<string> {
  if (editor) {
    return editor.uploadAsset(file, purpose);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
