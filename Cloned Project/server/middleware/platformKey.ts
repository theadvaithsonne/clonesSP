// src/middleware/platformKey.ts
//
// Platform-key auth for the office grace programme.
//
// These routes take BOTH a normal user JWT and an `X-Garage-Platform` key:
// the JWT says who the office is for, the key says which integrating platform
// is vouching for them. The key is what permits skipping the Unilevel Plus
// licence gate, so it is issued to a handful of platforms and to nothing else
// — the main web and mobile apps never send one and keep the gate.
//
// Keys reuse the ThirdPartyClient machinery (same hashing, same rotation, same
// admin surface) with the `offices:grace` scope. A billing productConfig is not
// required, matching how `analytics:read` partners already work.

import { Request, Response, NextFunction } from "express";
import {
  ThirdPartyClient,
  IThirdPartyClient,
  extractKeyPrefix,
  verifyApiKey,
} from "../models/thirdPartyClient.model";

export type PlatformRequest = Request & {
  platformClient: IThirdPartyClient;
};

const SCOPE = "offices:grace" as const;

export async function requirePlatformKey(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const rawKey = req.headers["x-garage-platform"] as string | undefined;
  if (!rawKey) {
    res.status(401).json({
      success: false,
      error: "missing_platform_key",
      message: "X-Garage-Platform header is required for this endpoint.",
    });
    return;
  }

  // Narrow by prefix, then bcrypt-verify the candidates. Same two-step the
  // partner-API middleware uses: bcrypt against every key in the collection
  // would be deliberately slow, for every request.
  const prefix = extractKeyPrefix(rawKey);
  const candidates = await ThirdPartyClient.find({
    apiKeyPrefix: prefix,
    isActive: true,
  });

  let client: IThirdPartyClient | null = null;
  for (const c of candidates) {
    if (await verifyApiKey(rawKey, c.apiKeyHash)) {
      client = c;
      break;
    }
  }

  if (!client) {
    res.status(401).json({
      success: false,
      error: "invalid_platform_key",
      message: "That platform key is not recognised or has been revoked.",
    });
    return;
  }

  if (!client.scopes.includes(SCOPE)) {
    res.status(403).json({
      success: false,
      error: "missing_scope",
      message: `Platform "${client.name}" does not hold the ${SCOPE} scope.`,
    });
    return;
  }

  (req as PlatformRequest).platformClient = client;
  next();
}
