// src/routes/whatsappWebhook.ts
//
// Meta WhatsApp Cloud API webhook. Two halves, per Meta's spec:
//
//   GET  /webhooks/whatsapp   — subscription verification. Meta calls this
//       once when you save the webhook in the App Dashboard:
//         ?hub.mode=subscribe&hub.verify_token=<TOKEN>&hub.challenge=<N>
//       We echo hub.challenge back (plain text, 200) IFF the verify_token
//       matches ours. Anything else → 403.
//
//   POST /webhooks/whatsapp   — event receiver (incoming messages + status
//       updates). Meta signs the body with the App Secret; we verify the
//       X-Hub-Signature-256 HMAC over the RAW bytes before trusting it, then
//       ACK 200 fast (Meta retries on non-2xx / slow responses).
//
// Mounted BEFORE express.json() with express.raw so req.body is the exact
// bytes Meta sent — required for the HMAC to match.
//
// Config (config/env.ts):
//   WHATSAPP_VERIFY_TOKEN — must equal the "Verify token" you type in the
//                           Meta dashboard. Empty => verification 503s.
//   WHATSAPP_APP_SECRET   — Meta App Secret. Empty => signature check is
//                           skipped (fine for the unpublished sandbox; set
//                           it before going live).
import { Router, Request, Response } from "express";
import crypto from "crypto";
import { env } from "../config/env";

const router = Router();

// ── GET: subscription verification ───────────────────────────────────────────
router.get("/", (req: Request, res: Response) => {
  if (!env.WHATSAPP_VERIFY_TOKEN) {
    res.status(503).send("whatsapp webhook not configured");
    return;
  }
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.WHATSAPP_VERIFY_TOKEN) {
    console.log("[whatsapp] webhook verified");
    // Echo the challenge back verbatim as plain text.
    res.status(200).send(String(challenge ?? ""));
    return;
  }
  console.warn("[whatsapp] webhook verification failed", { mode, token });
  res.sendStatus(403);
});

// ── POST: event receiver ─────────────────────────────────────────────────────
router.post("/", (req: Request, res: Response) => {
  // req.body is a Buffer here (express.raw). Verify the signature over the
  // raw bytes when the app secret is configured.
  const raw: Buffer = Buffer.isBuffer(req.body)
    ? (req.body as Buffer)
    : Buffer.from(typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {}));

  if (env.WHATSAPP_APP_SECRET) {
    const sig = req.header("x-hub-signature-256") || "";
    const expected =
      "sha256=" +
      crypto.createHmac("sha256", env.WHATSAPP_APP_SECRET).update(raw).digest("hex");
    // timingSafeEqual throws on length mismatch — guard first.
    const ok =
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok) {
      console.warn("[whatsapp] bad signature — rejecting");
      res.sendStatus(401);
      return;
    }
  }

  // Parse + process. ACK first so Meta never retries on a slow handler; any
  // downstream work is best-effort.
  res.sendStatus(200);

  try {
    const payload = JSON.parse(raw.toString("utf8"));
    // WhatsApp payload shape:
    //   { object:"whatsapp_business_account",
    //     entry:[{ id, changes:[{ value:{ messaging_product, metadata,
    //       contacts:[...], messages:[...], statuses:[...] }, field }] }] }
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const value = change?.value ?? {};
        for (const msg of value?.messages ?? []) {
          console.log("[whatsapp] incoming message", {
            from: msg.from,
            type: msg.type,
            text: msg.text?.body,
            id: msg.id,
          });
          // TODO: route to the messaging pipeline (persist + reply).
        }
        for (const status of value?.statuses ?? []) {
          console.log("[whatsapp] status update", {
            id: status.id,
            status: status.status,
            recipient: status.recipient_id,
          });
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp] failed to parse webhook payload:", err);
  }
});

export default router;
