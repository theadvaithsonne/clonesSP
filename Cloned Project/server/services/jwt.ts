// src/services/jwt.ts
import jwt, { JwtPayload, SignOptions, VerifyOptions } from "jsonwebtoken";
import { env } from "../config/env";

// Ensure at startup:
if (!env.JWT_SECRET) {
  throw new Error("JWT_SECRET is missing");
}

// Optional: central default options
const DEFAULT_SIGN_OPTS: SignOptions = {
  algorithm: "HS256",
  expiresIn: "7d", // string | number
};

export function signJwt<T extends object>(
  payload: T,
  options?: SignOptions
): string {
  // ensure secret is treated as a jwt.Secret
  return jwt.sign(payload, env.JWT_SECRET as jwt.Secret, {
    ...DEFAULT_SIGN_OPTS,
    ...(options || {}),
  });
}

export function verifyJwt<T = JwtPayload>(
  token: string,
  options?: VerifyOptions
): T {
  return jwt.verify(token, env.JWT_SECRET as jwt.Secret, options) as T;
}

/**
 * Generate a JWT token for event guests
 * @param eventId - The event ID the guest is joining
 * @param guestId - Unique identifier for the guest session
 * @param displayName - The guest's display name
 * @param email - The guest's email
 * @returns JWT token valid for the event duration + 1 hour
 */
export function generateGuestSocketToken(
  eventId: string,
  guestId: string,
  displayName: string,
  email: string,
  eventEndTime: Date
): string {
  // Calculate expiry: event end time + 1 hour buffer
  const expiryDate = new Date(eventEndTime);
  expiryDate.setHours(expiryDate.getHours() + 1);

  const now = new Date();
  const expiresInSeconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);

  // Ensure minimum 5 minutes validity, maximum 24 hours
  const finalExpiresIn = Math.max(300, Math.min(expiresInSeconds, 86400));

  const payload = {
    guestId,
    eventId,
    displayName,
    email,
    isGuest: true
  };

  return signJwt(payload, {
    expiresIn: finalExpiresIn
  });
}
