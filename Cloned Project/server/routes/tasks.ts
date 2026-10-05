import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Task } from "../models/task.model";
import { Types } from "mongoose";

const router = Router();

// List all tasks for the org
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  const tasks = await Task.find({ orgId: new Types.ObjectId(me.orgId) })
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 })
    .lean();
  
  res.json({ tasks });
});

// Create a new task
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string; orgId: string };
  if (!me.orgId) return res.status(400).json({ error: "No organization" });

  // FIX: Make assignedTo and dueDate nullable to accept `null` from the frontend
  const body = z
    .object({
      title: z.string().min(1).max(200),
      assignedTo: z.string().nullable().optional(), // Accepts string, null, or undefined
      dueDate: z.string().nullable().optional(),    // Accepts date string, null, or undefined
    })
    .parse(req.body);

  const task = await Task.create({
    orgId: me.orgId,
    title: body.title,
    createdBy: me.userId,
    assignedTo: body.assignedTo ? new Types.ObjectId(body.assignedTo) : undefined,
    dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
  });

  res.status(201).json({ task });
});

// Update a task
router.patch("/:id", requireAuth, async (req, res) => {
    const me = (req as any).user as { orgId: string };
    const { id } = req.params;

    // FIX: Remove the strict .datetime() check to allow simple date strings or null
    const body = z
    .object({
      title: z.string().min(1).max(200).optional(),
      status: z.enum(["todo", "inprogress", "done"]).optional(),
      assignedTo: z.string().nullable().optional(),
      dueDate: z.string().nullable().optional(),
    })
    .parse(req.body);

    const update: any = {};
    if (body.title) update.title = body.title;
    if (body.status) update.status = body.status;
    if (body.assignedTo !== undefined) {
        update.assignedTo = body.assignedTo ? new Types.ObjectId(body.assignedTo) : null;
    }
    if (body.dueDate !== undefined) {
        update.dueDate = body.dueDate ? new Date(body.dueDate) : null;
    }

    const updatedTask = await Task.findOneAndUpdate(
        { _id: id, orgId: new Types.ObjectId(me.orgId) },
        { $set: update },
        { new: true }
    ).populate("assignedTo", "name email").lean();

    if (!updatedTask) return res.status(404).json({ error: "Task not found" });

    res.json({ task: updatedTask });
});


// Delete a task
router.delete("/:id", requireAuth, async (req, res) => {
    const me = (req as any).user as { orgId: string };
    const { id } = req.params;

    await Task.deleteOne({ _id: id, orgId: new Types.ObjectId(me.orgId) });

    res.json({ ok: true });
});


export default router;