import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB max
  fileFilter: (req, file, cb) => {
    const type = file.mimetype || "";
    if (type.startsWith("video/") || type === "application/pdf" || type.includes("pdf")) {
      return cb(null, true);
    }
    cb(null, false);
  },
});

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const apiKey = "AIzaSyBaf2cDGdxE8f9omgSO_JQU6tM7DoQ0lUQ" ;
    if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set" });

    const question = String(req.body?.question || "").trim();
    if (!question) return res.status(400).json({ error: "Question is required" });

    const file = req.file;
    if (!file) return res.status(400).json({ error: "Video or PDF file is required" });

    const genAI = new GoogleGenerativeAI(apiKey);
    const fileManager = new GoogleAIFileManager(apiKey);

    const buffer = file.buffer;
    const mimeType = file.mimetype || "application/pdf";
    const displayName = file.originalname || "uploaded-video";

    const tmpPath = path.join(
      os.tmpdir(),
      `ask-cabinet-${Date.now()}-${displayName.replace(/[^a-zA-Z0-9_.-]/g, "-")}`
    );
    await fs.writeFile(tmpPath, buffer);

    let uploaded: any;
    try {
      uploaded = await fileManager.uploadFile(tmpPath, { mimeType, displayName });
    } finally {
      fs.unlink(tmpPath).catch(() => {});
    }

    const uploadedName: string = uploaded?.file?.name || uploaded?.name;
    if (!uploadedName) return res.status(500).json({ error: "Upload to Gemini failed" });

    // Poll until ACTIVE
    const maxWaitMs = 20000;
    const intervalMs = 800;
    const start = Date.now();
    let fileMeta: any = null;
    while (Date.now() - start < maxWaitMs) {
      // eslint-disable-next-line no-await-in-loop
      fileMeta = await fileManager.getFile(uploadedName).catch(() => null);
      if (fileMeta?.state === "ACTIVE") break;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    if (!fileMeta || fileMeta.state !== "ACTIVE") {
      return res.status(502).json({ error: "Video not ready. Please retry." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: `You are an expert analyst. Answer the user's question about the following video. Be concise and reference timestamps if useful.\n\nQuestion: ${question}` },
            {
              // @ts-ignore
              fileData: {
                fileUri: fileMeta?.uri || uploaded?.file?.uri || uploaded?.uri,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    return res.json({ answer: response.response.text() });
  } catch (err) {
    console.error("ask-cabinet error", err);
    return res.status(500).json({ error: "Failed to process request" });
  }
});

export default router;


