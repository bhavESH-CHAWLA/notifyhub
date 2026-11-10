const scheduledTimings = new Set(["one_day_before", "at_due_date"]);

export class InvalidEmailScheduleError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidEmailScheduleError";
  }
}

export function getEmailSchedule(timing, dueDate, now = new Date()) {
  if (timing === "none") return null;
  if (timing === "immediate") return now;
  if (!scheduledTimings.has(timing)) {
    throw new InvalidEmailScheduleError("Choose a valid email notification time.");
  }
  if (!dueDate) {
    throw new InvalidEmailScheduleError("A due date is required for a scheduled email.");
  }

  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime()) || due <= now) {
    throw new InvalidEmailScheduleError("Choose a future due date for a scheduled email.");
  }

  const scheduledAt = new Date(due);
  if (timing === "one_day_before") scheduledAt.setDate(scheduledAt.getDate() - 1);
  return scheduledAt <= now ? now : scheduledAt;
}

export function emailScheduleFields(timing, dueDate, now = new Date()) {
  const scheduledAt = getEmailSchedule(timing, dueDate, now);
  return {
    emailTiming: timing,
    emailScheduledAt: scheduledAt,
    emailNextAttemptAt: scheduledAt,
    emailStatus: scheduledAt ? "pending" : "not_scheduled",
    emailAttempts: 0,
    emailClaimedAt: null,
  };
}
