import { Request, Response } from "express";
import { AdminModel } from "../models/admin.model";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { z } from "zod";
import { ok, fail } from "../utils/http";

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  password: z.string().min(8),
  role: z.enum(["admin", "superadmin"]).optional(),
});

export async function registerAdmin(req: Request, res: Response) {
  console.log("first", req.body);
  const parsed = registerSchema.safeParse(req.body);
  console.log("parsed", parsed);

  if (!parsed.success) {
    return res.status(400).json(fail("Invalid input"));
  }
  const { email, name, password, role } = parsed.data;

  const existing = await AdminModel.findOne({ email }).lean();
  if (existing) return res.status(409).json(fail("Email already in use"));

  const passwordHash = await bcrypt.hash(password, 12);

  const doc = await AdminModel.create({
    email,
    name,
    passwordHash,
    role: role ?? "admin",
  });

  return res
    .status(201)
    .json(
      ok({ id: doc._id, email: doc.email, name: doc.name, role: doc.role })
    );
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAdmin(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json(fail("Invalid input"));
  }
  const { email, password } = parsed.data;

  const admin = await AdminModel.findOne({ email });
  if (!admin || !admin.isActive)
    return res.status(401).json(fail("Invalid credentials"));

  const okPw = await bcrypt.compare(password, admin.passwordHash);
  if (!okPw) return res.status(401).json(fail("Invalid credentials"));

  const token = jwt.sign(
    { sub: String(admin._id), role: admin.role, email: admin.email },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  return res.json(
    ok({ token, role: admin.role, name: admin.name, email: admin.email })
  );
}

export async function me(req: Request, res: Response) {
  // Example of using Model.find with projection & .lean()
  const admin = await AdminModel.findOne(
    { _id: req.user!.id },
    { passwordHash: 0 }
  ).lean();
  if (!admin) return res.status(404).json(fail("Not found"));
  return res.json(ok(admin));
}

/** Example admin list using .find(...) like Next backends */
export async function listAdmins(_req: Request, res: Response) {
  const admins = await AdminModel.find({}, { passwordHash: 0 })
    .sort({ createdAt: -1 })
    .lean();
  return res.json(ok(admins));
}

/** Toggle active flag using findByIdAndUpdate */
export async function toggleActive(req: Request, res: Response) {
  const { id } = req.params;
  const doc = await AdminModel.findByIdAndUpdate(
    id,
    [{ $set: { isActive: { $not: "$isActive" } } }], // aggregation pipeline update to flip bool
    { new: true, projection: { passwordHash: 0 } }
  ).lean();

  if (!doc) return res.status(404).json(fail("Not found"));
  return res.json(ok(doc));
}
