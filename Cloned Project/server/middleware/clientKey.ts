import { Request, Response, NextFunction } from "express";

export function requireClientKey(req: Request, res: Response, next: NextFunction): void {
  const provided = req.header("x-client-key");
  const expected = process.env.PUBLIC_CLIENT_KEY;

  if (!expected) {
    res.status(500).json({ error: "PUBLIC_CLIENT_KEY not configured" });
    return;
  }

  if (provided !== expected) {
    res.status(401).json({ error: "invalid client key" });
    return;
  }

  next();
}
