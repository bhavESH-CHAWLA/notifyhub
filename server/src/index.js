import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import app from "./app.js";
import { config } from "./config.js";
import { startEmailWorker } from "./services/emailWorker.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin, credentials: true },
});

io.use((socket, next) => {
  const token = socket.request.headers.cookie
    ?.split("; ")
    .find((part) => part.startsWith("session="))
    ?.slice("session=".length);
  if (!token) return next(new Error("Authentication required."));
  try {
    const { sub } = jwt.verify(decodeURIComponent(token), config.jwtSecret);
    socket.data.userId = sub;
    next();
  } catch {
    next(new Error("Authentication required."));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);
});

app.set("io", io);

await mongoose.connect(config.mongoUri);
const stopEmailWorker = startEmailWorker();
server.listen(config.port, () => {
  console.log(`NotifyHub API listening on port ${config.port}`);
});

async function shutdown() {
  stopEmailWorker();
  await mongoose.disconnect();
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
