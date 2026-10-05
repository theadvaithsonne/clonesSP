import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { Todo } from "../models/todo.model";
import { Types } from "mongoose";
import { emitNotification } from "../services/socket";
import { User } from "../models/user.model";

const router = Router();

// List all todos for the current user in the current org
router.get("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;

  if (!orgId) return res.status(400).json({ error: "No organization" });

  const todos = await Todo.find({
    orgId: new Types.ObjectId(orgId),
    userId: new Types.ObjectId(me.userId),
  })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ todos });
});

// List todos for a specific user (for others to add todos for them)
router.get("/user/:userId", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { userId } = req.params;
  const orgId = req.query.orgId as string;

  if (!orgId) return res.status(400).json({ error: "No organization" });

  const todos = await Todo.find({
    orgId: new Types.ObjectId(orgId),
    userId: new Types.ObjectId(userId),
    isPersonal: false, // Only show todos created by others
  })
    .populate("createdBy", "name email")
    .sort({ createdAt: -1 })
    .lean();

  res.json({ todos });
});

// Create a new todo
router.post("/", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const orgId = req.query.orgId as string;

  if (!orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      task: z.string().min(1).max(500),
      targetUserId: z.string().optional(), // For creating todos for others
    })
    .parse(req.body);

  const todo = await Todo.create({
    orgId: new Types.ObjectId(orgId),
    userId: new Types.ObjectId(body.targetUserId || me.userId),
    createdBy: new Types.ObjectId(me.userId),
    task: body.task,
    isPersonal: !body.targetUserId, // Personal if no targetUserId
  });

  const populatedTodo = await Todo.findById(todo._id)
    .populate("createdBy", "name email")
    .lean();

  // If this todo is for another user, send a socket notification
  if (body.targetUserId && body.targetUserId !== me.userId) {
    try {
      const creator = await User.findById(me.userId)
        .select("name email")
        .lean();
      const fromName = creator?.name || creator?.email || "Someone";

      emitNotification(body.targetUserId, {
        type: "todo_assigned",
        title: "New Todo Assigned",
        message: `${fromName} assigned you a task: ${body.task}`,
        data: {
          from: me.userId,
          fromName: fromName,
          task: body.task,
          todoId: todo._id.toString(),
        },
      });
    } catch (error) {
      console.error("Failed to send todo notification:", error);
      // Don't fail the request if notification fails
    }
  }

  res.status(201).json({ todo: populatedTodo });
});

// Update a todo
router.patch("/:id", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { id } = req.params;
  const orgId = req.query.orgId as string;

  if (!orgId) return res.status(400).json({ error: "No organization" });

  const body = z
    .object({
      task: z.string().min(1).max(500),
    })
    .parse(req.body);

  const updatedTodo = await Todo.findOneAndUpdate(
    {
      _id: id,
      orgId: new Types.ObjectId(orgId),
      userId: new Types.ObjectId(me.userId),
    },
    { $set: { task: body.task } },
    { new: true }
  ).lean();

  if (!updatedTodo) return res.status(404).json({ error: "Todo not found" });

  res.json({ todo: updatedTodo });
});

// Delete a todo
router.delete("/:id", requireAuth, async (req, res) => {
  const me = (req as any).user as { userId: string };
  const { id } = req.params;
  const orgId = req.query.orgId as string;

  if (!orgId) return res.status(400).json({ error: "No organization" });

  const result = await Todo.deleteOne({
    _id: id,
    orgId: new Types.ObjectId(orgId),
    $or: [
      { userId: new Types.ObjectId(me.userId) }, // User can delete their own todos
      { createdBy: new Types.ObjectId(me.userId) }, // User can delete todos they created
    ],
  });

  if (result.deletedCount === 0) {
    return res.status(404).json({ error: "Todo not found" });
  }

  res.json({ ok: true });
});

export default router;
