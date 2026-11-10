import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "./config.js";
import User from "./models/User.js";

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;

if (!email || !password || password.length < 12) {
  throw new Error("Set SEED_ADMIN_EMAIL and a SEED_ADMIN_PASSWORD of at least 12 characters.");
}

await mongoose.connect(config.mongoUri);
try {
  if (await User.exists({ role: "admin" })) {
    throw new Error("An administrator already exists; the seed command will not modify accounts.");
  }
  const name = email.split("@")[0].slice(0, 80) || "Administrator";
  await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), role: "admin" });
  console.log("Administrator account created.");
} finally {
  await mongoose.disconnect();
}
