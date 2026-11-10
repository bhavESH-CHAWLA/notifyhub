import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import Notification from "../models/Notification.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import { config } from "../config.js";
import { emailScheduleFields } from "../services/emailSchedule.js";
import { processEmailQueue } from "../services/emailWorker.js";

const router = Router();
const taskInput = z.object({
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional().default(""),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.union([z.string().datetime().or(z.literal("")), z.null()]).optional(),
  owner: z.union([z.string().regex(/^[a-f\d]{24}$/i), z.literal("")]).optional(),
  emailTiming: z.enum(["none", "immediate", "one_day_before", "at_due_date"]).optional(),
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
  const emailTiming = input.emailTiming || "none";
  if (emailTiming !== "none" && !config.emailEnabled) {
    return res.status(503).json({ message: "Email delivery is not configured. Ask your administrator to configure Brevo." });
  }
  const owner = req.user.role === "admin" && input.owner ? input.owner : req.user.id;
  const dueDate = input.dueDate ? new Date(input.dueDate) : null;
  const emailFields = emailScheduleFields(emailTiming, dueDate);
  const task = await Task.create({
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    dueDate,
    ...emailFields,
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
  if (emailTiming === "immediate") {
    processEmailQueue().catch((error) => console.error("Email queue processing failed.", error));
  }
  res.status(201).json({ task: saved });
});

router.patch("/:id", async (req, res) => {
  const input = taskInput.partial().parse(req.body);
  const filter = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, owner: req.user.id };
  const update = { ...input };
  if (req.user.role !== "admin") delete update.owner;
  if (update.dueDate !== undefined) update.dueDate = update.dueDate || null;
  const previous = await Task.findOne(filter).select("owner title dueDate emailTiming emailStatus status");
  if (!previous) return res.status(404).json({ message: "Task not found." });
  const ownerChanged = update.owner !== undefined && String(update.owner || req.user.id) !== String(previous.owner);
  if (update.owner === "") update.owner = req.user.id;
  if (update.status !== undefined) {
    update.completedAt = update.status === "done" ? new Date() : null;
    if (update.status === "done" && ["pending", "processing"].includes(previous.emailStatus)) {
      update.emailStatus = "cancelled";
      update.emailNextAttemptAt = null;
      update.emailClaimedAt = null;
    }
  }
  const timingChanged = input.emailTiming !== undefined && input.emailTiming !== previous.emailTiming;
  const dueDateChanged = input.dueDate !== undefined;
  if ((timingChanged || dueDateChanged || ownerChanged) && update.status !== "done" && previous.status !== "done") {
    const emailTiming = input.emailTiming || previous.emailTiming;
    if (emailTiming !== "none" && !config.emailEnabled) {
      return res.status(503).json({ message: "Email delivery is not configured. Ask your administrator to configure Brevo." });
    }
    Object.assign(update, emailScheduleFields(emailTiming, update.dueDate ?? previous.dueDate));
  }
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
  if (task.emailTiming === "immediate" && task.emailStatus === "pending") {
    processEmailQueue().catch((error) => console.error("Email queue processing failed.", error));
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
