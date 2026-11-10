import "dotenv/config";

const required = ["MONGODB_URI", "JWT_SECRET", "CLIENT_ORIGIN"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}

if (process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters long.");
}

const brevoApiKey = process.env.BREVO_API_KEY?.trim() || "";
const emailFrom = process.env.EMAIL_FROM?.trim() || "";

if (Boolean(brevoApiKey) !== Boolean(emailFrom)) {
  throw new Error("Set both BREVO_API_KEY and EMAIL_FROM to enable email notifications.");
}

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  clientOrigin: process.env.CLIENT_ORIGIN,
  nodeEnv: process.env.NODE_ENV || "development",
  brevoApiKey,
  emailFrom,
  emailFromName: process.env.EMAIL_FROM_NAME?.trim() || "NotifyHub",
  emailEnabled: Boolean(brevoApiKey && emailFrom),
};
