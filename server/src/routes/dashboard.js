import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import Task from "../models/Task.js";

const router = Router();

router.get("/stats", requireAuth, async (req, res) => {
  const match = req.user.role === "admin" ? {} : { owner: req.user._id };
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  const [counts, total, activityRows] = await Promise.all([
    Task.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Task.countDocuments(match),
    Task.aggregate([
      { $match: { ...match, $or: [{ createdAt: { $gte: start } }, { completedAt: { $gte: start } }] } },
      { $project: { createdAt: 1, completedAt: 1 } },
      {
        $project: {
          events: [
            {
              $cond: [
                { $gte: ["$createdAt", start] },
                { day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, kind: "opened" },
                null,
              ],
            },
            {
              $cond: [
                { $and: [{ $ne: ["$completedAt", null] }, { $gte: ["$completedAt", start] }] },
                { day: { $dateToString: { format: "%Y-%m-%d", date: "$completedAt" } }, kind: "completed" },
                null,
              ],
            },
          ],
        },
      },
      { $unwind: "$events" },
      { $match: { events: { $ne: null } } },
      { $group: { _id: { day: "$events.day", kind: "$events.kind" }, count: { $sum: 1 } } },
    ]),
  ]);
  const byStatus = { todo: 0, in_progress: 0, done: 0 };
  for (const row of counts) byStatus[row._id] = row.count;
  const daily = new Map();
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + offset);
    const day = date.toISOString().slice(0, 10);
    daily.set(day, { day: date.toLocaleDateString("en", { weekday: "short", timeZone: "UTC" }), opened: 0, completed: 0 });
  }
  for (const row of activityRows) {
    const item = daily.get(row._id.day);
    if (item) item[row._id.kind] = row.count;
  }
  res.json({
    total,
    byStatus,
    completion: total ? Math.round((byStatus.done / total) * 100) : 0,
    activity: [...daily.values()],
  });
});

export default router;
