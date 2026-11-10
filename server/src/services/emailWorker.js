import { config } from "../config.js";
import Task from "../models/Task.js";
import { sendTaskEmail } from "./email.js";

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;
let queueRunning = false;

export async function processEmailQueue() {
  if (!config.emailEnabled || queueRunning) return;
  queueRunning = true;

  try {
    const now = new Date();
    await Task.updateMany(
      { emailStatus: "processing", emailClaimedAt: { $lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } },
      { $set: { emailStatus: "pending", emailNextAttemptAt: now, emailClaimedAt: null } },
    );

    for (let count = 0; count < BATCH_SIZE; count += 1) {
      const task = await Task.findOneAndUpdate(
        { emailStatus: "pending", emailNextAttemptAt: { $lte: new Date() }, status: { $ne: "done" } },
        { $set: { emailStatus: "processing", emailClaimedAt: new Date() } },
        { new: true, sort: { emailNextAttemptAt: 1 } },
      )
        .populate("owner", "name email")
        .populate("createdBy", "name");

      if (!task) break;

      try {
        if (!task.owner?.email) throw new Error("Task recipient has no email address.");
        await sendTaskEmail(task);
        await Task.updateOne(
          { _id: task._id, emailStatus: "processing" },
          { $set: { emailStatus: "sent", emailClaimedAt: null, emailNextAttemptAt: null } },
        );
      } catch (error) {
        const attempts = task.emailAttempts + 1;
        const failed = attempts >= MAX_ATTEMPTS;
        const retryAt = failed ? null : new Date(Date.now() + Math.min(2 ** attempts, 60) * 60 * 1000);
        await Task.updateOne(
          { _id: task._id, emailStatus: "processing" },
          {
            $set: {
              emailStatus: failed ? "failed" : "pending",
              emailAttempts: attempts,
              emailNextAttemptAt: retryAt,
              emailClaimedAt: null,
            },
          },
        );
        console.error("Task email delivery failed.", {
          taskId: task.id,
          attempt: attempts,
          willRetry: !failed,
          status: error.status || "network_error",
        });
      }
    }
  } finally {
    queueRunning = false;
  }
}

export function startEmailWorker() {
  if (!config.emailEnabled) {
    console.warn("Email notifications are disabled; configure BREVO_API_KEY and EMAIL_FROM to enable them.");
    return () => {};
  }

  const timer = setInterval(() => {
    processEmailQueue().catch((error) => console.error("Email queue processing failed.", error));
  }, 30 * 1000);
  timer.unref();
  processEmailQueue().catch((error) => console.error("Email queue processing failed.", error));
  return () => clearInterval(timer);
}
