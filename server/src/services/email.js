import { config } from "../config.js";

export async function sendTaskEmail(task) {
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": config.brevoApiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.emailFrom, name: config.emailFromName },
      to: [{ email: task.owner.email, name: task.owner.name }],
      subject: `Task reminder: ${task.title}`,
      textContent: [
        `Hi ${task.owner.name},`,
        "",
        task.emailTiming === "immediate"
          ? `${task.createdBy?.name || "Your team"} created a task for you.`
          : "Here is your scheduled task reminder.",
        "",
        task.title,
        task.description || "",
        task.dueDate ? `Due: ${task.dueDate.toLocaleString()}` : "",
        "",
        "Sign in to NotifyHub to view your task.",
      ].filter(Boolean).join("\n"),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = new Error(`Brevo rejected the email with status ${response.status}.`);
    error.status = response.status;
    throw error;
  }
}
