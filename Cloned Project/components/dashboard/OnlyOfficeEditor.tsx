"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

export type DocumentType = "word" | "cell" | "slide";

interface OnlyOfficeEditorProps {
  documentId: string;
  documentType: DocumentType;
  documentTitle: string;
  documentUrl: string;
  documentKey: string;
  callbackUrl: string;
  userId: string;
  userName: string;
  userEmail?: string;
  token?: string;
  serverConfig?: any; // Pre-built config from backend (for JWT validation)
  mode?: "edit" | "view";
  onReady?: () => void;
  onError?: (error: any) => void;
  onDocumentStateChange?: (isSaved: boolean) => void;
}

const DOCUMENT_SERVER_URL = process.env.NEXT_PUBLIC_ONLYOFFICE_URL || "http://64.227.138.95";

const getFileExtension = (type: DocumentType): string => {
  switch (type) {
    case "word":
      return "docx";
    case "cell":
      return "xlsx";
    case "slide":
      return "pptx";
    default:
      return "docx";
  }
};

const getDocumentType = (type: DocumentType): string => {
  switch (type) {
    case "word":
      return "word";
    case "cell":
      return "cell";
    case "slide":
      return "slide";
    default:
      return "word";
  }
};

export default function OnlyOfficeEditor({
  documentId,
  documentType,
  documentTitle,
  documentUrl,
  documentKey,
  callbackUrl,
  userId,
  userName,
  userEmail,
  token,
  serverConfig,
  mode = "edit",
  onReady,
  onError,
  onDocumentStateChange,
}: OnlyOfficeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const docEditorRef = useRef<any>(null);

  useEffect(() => {
    let scriptElement: HTMLScriptElement | null = null;
    let isMounted = true;

    const loadAndInitEditor = () => {
      // Check if DocsAPI is already available (script already loaded from previous navigation)
      if (window.DocsAPI) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          if (isMounted) {
            initEditor();
          }
        }, 100);
        return;
      }

      // Check if script is already in DOM but not yet loaded
      const existingScript = document.querySelector(
        `script[src="${DOCUMENT_SERVER_URL}/web-apps/apps/api/documents/api.js"]`
      );

      if (existingScript) {
        // Script exists, wait for it to load
        const checkAPI = setInterval(() => {
          if (window.DocsAPI) {
            clearInterval(checkAPI);
            if (isMounted) {
              initEditor();
            }
          }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkAPI);
          if (!window.DocsAPI && isMounted) {
            setError("Failed to load ONLYOFFICE Document Server. Please check if it's running.");
            setLoading(false);
          }
        }, 10000);
        return;
      }

      // Load ONLYOFFICE Document Server API script
      scriptElement = document.createElement("script");
      scriptElement.src = `${DOCUMENT_SERVER_URL}/web-apps/apps/api/documents/api.js`;
      scriptElement.async = true;

      scriptElement.onload = () => {
        if (isMounted) {
          initEditor();
        }
      };

      scriptElement.onerror = () => {
        if (isMounted) {
          setError("Failed to load ONLYOFFICE Document Server. Please check if it's running.");
          setLoading(false);
          onError?.({ message: "Failed to load ONLYOFFICE API" });
        }
      };

      document.body.appendChild(scriptElement);
    };

    loadAndInitEditor();

    return () => {
      isMounted = false;
      // Cleanup editor
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
        } catch (e) {
          console.error("Error destroying editor:", e);
        }
        docEditorRef.current = null;
      }
      // Don't remove the script - it may be needed by other instances
    };
  }, [documentId]);

  const initEditor = () => {
    if (!window.DocsAPI || !editorRef.current) {
      setError("ONLYOFFICE API not available");
      setLoading(false);
      return;
    }

    try {
      console.log("[ONLYOFFICE Frontend] Initializing editor...");
      console.log("[ONLYOFFICE Frontend] serverConfig:", serverConfig);
      console.log("[ONLYOFFICE Frontend] token:", token);
      console.log("[ONLYOFFICE Frontend] mode:", mode);

      // Use server config if provided (contains JWT-signed document and editorConfig)
      // Add events and UI settings on top
      const config = serverConfig ? {
        ...serverConfig,
        documentType: getDocumentType(documentType),
        events: {
          onAppReady: () => {
            setLoading(false);
            onReady?.();
          },
          onDocumentStateChange: (event: any) => {
            onDocumentStateChange?.(!event.data);
          },
          onError: (event: any) => {
            console.error("ONLYOFFICE error:", event);
            setError(event.data?.message || "An error occurred");
            onError?.(event);
          },
          onWarning: (event: any) => {
            console.warn("ONLYOFFICE warning:", event);
          },
        },
        height: "100%",
        width: "100%",
        type: "desktop",
        token: token,
      } : {
        document: {
          fileType: getFileExtension(documentType),
          key: documentKey,
          title: documentTitle,
          url: documentUrl,
          permissions: {
            chat: true,
            comment: true,
            copy: true,
            download: true,
            edit: mode === "edit",
            fillForms: true,
            modifyContentControl: true,
            modifyFilter: true,
            print: true,
            review: true,
          },
        },
        documentType: getDocumentType(documentType),
        editorConfig: {
          callbackUrl: callbackUrl,
          lang: "en",
          mode: mode,
          user: {
            id: userId,
            name: userName,
            email: userEmail,
          },
          customization: {
            autosave: true,
            comments: true,
            compactHeader: false,
            compactToolbar: false,
            feedback: false,
            forcesave: false,
            goback: false,
            help: false,
            hideRightMenu: false,
            hideRulers: false,
            logo: {
              image: "",
              imageEmbedded: "",
              visible: false,
            },
            macros: false,
            plugins: false,
            toolbarHideFileName: false,
            toolbarNoTabs: false,
            uiTheme: "theme-dark",
          },
          embedded: {
            saveUrl: documentUrl,
            shareUrl: documentUrl,
          },
        },
        events: {
          onAppReady: () => {
            setLoading(false);
            onReady?.();
          },
          onDocumentStateChange: (event: any) => {
            onDocumentStateChange?.(!event.data);
          },
          onError: (event: any) => {
            console.error("ONLYOFFICE error:", event);
            setError(event.data?.message || "An error occurred");
            onError?.(event);
          },
          onWarning: (event: any) => {
            console.warn("ONLYOFFICE warning:", event);
          },
        },
        height: "100%",
        width: "100%",
        type: "desktop",
        token: token,
      };

      console.log("[ONLYOFFICE Frontend] Final config:", JSON.stringify(config, null, 2));
      console.log("[ONLYOFFICE Frontend] document.key:", config.document?.key);
      console.log("[ONLYOFFICE Frontend] document.permissions:", config.document?.permissions);
      console.log("[ONLYOFFICE Frontend] editorConfig.mode:", config.editorConfig?.mode);

      docEditorRef.current = new window.DocsAPI.DocEditor(
        editorRef.current.id,
        config
      );
    } catch (err: any) {
      console.error("Error initializing ONLYOFFICE:", err);
      setError(err.message || "Failed to initialize editor");
      setLoading(false);
      onError?.(err);
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#0b0b0d] text-white">
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md text-center">
          <h3 className="text-lg font-semibold text-red-400 mb-2">
            Editor Error
          </h3>
          <p className="text-white/80 text-sm">{error}</p>
          <p className="text-white/60 text-xs mt-4">
            Make sure ONLYOFFICE Document Server is running at {DOCUMENT_SERVER_URL}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" style={{ minHeight: "500px" }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b0d] z-10">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
            <p className="text-white/80">Loading editor...</p>
          </div>
        </div>
      )}
      <div
        id={`onlyoffice-editor-${documentId}`}
        ref={editorRef}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
