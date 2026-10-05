import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  ThirdPartyClient,
  IThirdPartyClient,
  ThirdPartyScope,
  extractKeyPrefix,
  verifyApiKey,
} from "../models/thirdPartyClient.model";

export type ThirdPartyAuthRequest = Request & {
  thirdPartyClient: IThirdPartyClient;
};

export async function requireThirdPartyApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Already authenticated on this request, so don't do it again.
  //
  // More than one router is mounted on /api/v1/third-party, and a router-level
  // `use` fires for every request entering that prefix — including ones whose
  // route lives in a later router. Without this guard the key would be verified
  // twice, and verification is bcrypt against every candidate hash: deliberately
  // slow, and slow twice for no benefit.
  if ((req as any).thirdPartyClient) {
    next();
    return;
  }

  const rawKey = req.headers["x-api-key"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({ error: "Missing x-api-key header", code: "MISSING_API_KEY" });
    return;
  }

  const prefix = extractKeyPrefix(rawKey);
  if (!prefix) {
    res.status(401).json({ error: "Malformed API key", code: "INVALID_API_KEY" });
    return;
  }

  const candidates = await ThirdPartyClient.find({
    apiKeyPrefix: prefix,
    isActive: true,
  });

  let matched: IThirdPartyClient | null = null;
  for (const c of candidates) {
    if (await verifyApiKey(rawKey, c.apiKeyHash)) {
      matched = c;
      break;
    }
  }

  if (!matched) {
    res.status(401).json({ error: "Invalid API key", code: "INVALID_API_KEY" });
    return;
  }

  (req as any).thirdPartyClient = matched;

  // Fire-and-forget lastUsedAt update
  ThirdPartyClient.updateOne({ _id: matched._id }, { lastUsedAt: new Date() }).catch(
    (err) => console.error("[ThirdParty] lastUsedAt update failed:", err)
  );

  next();
}

export function requireScope(scope: ThirdPartyScope): RequestHandler {
  return (req, res, next) => {
    const client = (req as any).thirdPartyClient as IThirdPartyClient | undefined;
    if (!client) {
      res.status(401).json({ error: "Not authenticated", code: "NOT_AUTHENTICATED" });
      return;
    }
    if (!client.scopes.includes(scope)) {
      res.status(403).json({ error: `Missing scope: ${scope}`, code: "MISSING_SCOPE" });
      return;
    }
    next();
  };
}
