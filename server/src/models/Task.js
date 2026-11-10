import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 2000, default: "" },
    status: {
      type: String,
      enum: ["todo", "in_progress", "done"],
      default: "todo",
    },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    emailTiming: {
      type: String,
      enum: ["none", "immediate", "one_day_before", "at_due_date"],
      default: "none",
    },
    emailScheduledAt: { type: Date, default: null },
    emailNextAttemptAt: { type: Date, default: null },
    emailStatus: {
      type: String,
      enum: ["not_scheduled", "pending", "processing", "sent", "failed", "cancelled"],
      default: "not_scheduled",
    },
    emailAttempts: { type: Number, default: 0 },
    emailClaimedAt: { type: Date, default: null },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

taskSchema.index({ owner: 1, status: 1, updatedAt: -1 });
taskSchema.index({ emailStatus: 1, emailNextAttemptAt: 1 });

export default mongoose.model("Task", taskSchema);
