import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import User from "../models/User.js";

const router = Router();
const taskInput = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional().default(""),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.union([z.string().datetime().or(z.literal("")), z.null()]).optional(),
  owner: z.union([z.string().regex(/^[a-f\d]{24}$/i), z.literal("")]).optional(),
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const filter = req.user.role === "admin" ? {} : { owner: req.user.id };
  const tasks = await Task.find(filter)
    .populate("owner", "name email")
    .sort({ updatedAt: -1 })
    .limit(250);
  res.json({ tasks });
});

router.post("/", async (req, res) => {
  const input = taskInput.parse(req.body);
  const owner = req.user.role === "admin" && input.owner ? input.owner : req.user.id;
  const task = await Task.create({
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate || null,
    owner,
    createdBy: req.user.id,
  });
  const saved = await task.populate("owner", "name email");
  if (String(owner) !== req.user.id) {
    const notification = await Notification.create({
      recipient: owner,
      task: task.id,
      message: `${req.user.name} assigned you “${task.title}”.`,
    });
    req.app.get("io").to(`user:${owner}`).emit("notification:new", notification);
  }
  res.status(201).json({ task: saved });
});

router.patch("/:id", async (req, res) => {
  const input = taskInput.partial().parse(req.body);
  const filter = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, owner: req.user.id };
  const update = { ...input };
  if (req.user.role !== "admin") delete update.owner;
  if (update.dueDate !== undefined) update.dueDate = update.dueDate || null;
  const previous = await Task.findOne(filter).select("owner title");
  if (!previous) return res.status(404).json({ message: "Task not found." });
  if (update.status !== undefined) update.completedAt = update.status === "done" ? new Date() : null;
  const task = await Task.findOneAndUpdate(filter, update, { new: true, runValidators: true })
    .populate("owner", "name email");
  if (!task) return res.status(404).json({ message: "Task not found." });
  if (String(previous.owner) !== String(task.owner._id)) {
    const notification = await Notification.create({
      recipient: task.owner._id,
      task: task.id,
      message: `${req.user.name} assigned you “${task.title}”.`,
    });
    req.app.get("io").to(`user:${task.owner._id}`).emit("notification:new", notification);
  }
  res.json({ task });
});

router.delete("/:id", async (req, res) => {
  const filter = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, owner: req.user.id };
  const task = await Task.findOneAndDelete(filter);
  if (!task) return res.status(404).json({ message: "Task not found." });
  await Notification.deleteMany({ task: task.id });
  res.status(204).end();
});

router.get("/team", requireAdmin, async (_req, res) => {
  const users = await User.find({}, "name email role").sort({ name: 1 });
  res.json({ users });
});

export default router;
