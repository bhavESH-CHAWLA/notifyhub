import test from "node:test";
import assert from "node:assert/strict";
import { emailScheduleFields, getEmailSchedule, InvalidEmailScheduleError } from "../src/services/emailSchedule.js";

const now = new Date("2026-01-01T12:00:00.000Z");
const dueDate = new Date("2026-01-04T12:00:00.000Z");

test("immediate emails are scheduled at creation time", () => {
  assert.equal(getEmailSchedule("immediate", null, now).toISOString(), now.toISOString());
});

test("scheduled emails are calculated from the due date", () => {
  assert.equal(getEmailSchedule("one_day_before", dueDate, now).toISOString(), "2026-01-03T12:00:00.000Z");
  assert.equal(getEmailSchedule("at_due_date", dueDate, now).toISOString(), dueDate.toISOString());
});

test("tasks without email have no queued delivery", () => {
  assert.equal(getEmailSchedule("none", null, now), null);
  assert.deepEqual(emailScheduleFields("none", null, now), {
    emailTiming: "none",
    emailScheduledAt: null,
    emailNextAttemptAt: null,
    emailStatus: "not_scheduled",
    emailAttempts: 0,
    emailClaimedAt: null,
  });
});

test("scheduled reminders require a future due date", () => {
  assert.throws(() => getEmailSchedule("at_due_date", null, now), InvalidEmailScheduleError);
  assert.throws(() => getEmailSchedule("one_day_before", now, now), InvalidEmailScheduleError);
});
