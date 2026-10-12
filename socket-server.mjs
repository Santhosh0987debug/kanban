/**
 * Standalone Socket.io collaboration server (no Next.js dependency).
 *
 * Deploy on Render as a Web Service:
 *   Build Command:  npm install
 *   Start Command:  node socket-server.mjs
 *   Env vars:       MONGODB_URI (required for persistence checks),
 *                   PORT (provided by Render automatically)
 *
 * Local single-port dev (serves the Next.js app + sockets together):
 *   node socket-server.mjs --serve-next        (PORT 3000 by default)
 *
 * Split local dev (Next.js on :3000, sockets on :3001):
 *   Terminal 1: npm run dev
 *   Terminal 2: node socket-server.mjs         (defaults to PORT 3001)
 *   .env.local: NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
 *
 * Protocol (see src/lib/socket-events.ts):
 *   client -> server: "join-board"  ({boardId, user?} | boardId) -> joins room + presence
 *   client -> server: "leave-board" ({boardId} | boardId)        -> leaves room + presence
 *   client -> server: "board-updated" ({boardId, ...})           -> relayed to the room
 *   server -> room:   "board:presence" ({boardId, users: [{id, name}]})
 *
 * Legacy aliases (kept so existing clients keep working unchanged):
 *   "board:join" === "join-board", "board:leave" === "leave-board",
 *   plus relays for "task:moved" | "task:updated" | "task:created"
 *   | "task:deleted" | "board:updated" | "activity:logged".
 *
 * Relays exclude the sender (socket.to) so optimistic UI never echoes;
 * presence is broadcast to the whole room (including the joiner) so
 * newcomers immediately receive the current user list.
 */
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Server } from "socket.io";

// ---------------------------------------------------------------------------
// Env (tiny .env.local loader so `node socket-server.mjs` works with zero
// extra dependencies; real env vars always take precedence).
// ---------------------------------------------------------------------------
const ROOT = dirname(fileURLToPath(import.meta.url));

function loadLocalEnv() {
  const file = join(ROOT, ".env.local");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnv();

const SERVE_NEXT = process.argv.includes("--serve-next");
const port = Number(process.env.PORT ?? (SERVE_NEXT ? 3000 : 3001));
const MONGODB_URI = process.env.MONGODB_URI ?? "";

// ---------------------------------------------------------------------------
// MongoDB (best-effort: realtime relay + presence are in-memory, so the
// server stays up even if the database is unreachable; errors are logged).
// ---------------------------------------------------------------------------
async function connectDb() {
  if (!MONGODB_URI) {
    console.warn("[socket] MONGODB_URI not set — running without database.");
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, { dbName: "kanban", maxPoolSize: 5 });
    console.log("[socket] Connected to MongoDB.");
  } catch (err) {
    console.error(
      "[socket] MongoDB connection failed (continuing without DB):",
      err instanceof Error ? err.message : err
    );
  }
}

// ---------------------------------------------------------------------------
// Presence tracking: room -> (socketId -> { id, name }), plus reverse index
// so abrupt disconnects can clean up every room the socket was in.
// ---------------------------------------------------------------------------
const BOARD_ROOM = (id) => `board:${id}`;
const presence = new Map();
const socketRooms = new Map();

let ioRef = null;

function normalizeJoin(payload) {
  if (typeof payload === "string") return { boardId: payload, user: null };
  const boardId =
    typeof payload?.boardId === "string" ? payload.boardId : "";
  const user =
    payload?.user && typeof payload.user.id === "string"
      ? {
          id: payload.user.id,
          name: String(payload.user.name ?? "Anonymous").slice(0, 60),
        }
      : null;
  return { boardId, user };
}

function track(socketId, room) {
  if (!socketRooms.has(socketId)) socketRooms.set(socketId, new Set());
  socketRooms.get(socketId).add(room);
}

function untrack(socketId, room) {
  socketRooms.get(socketId)?.delete(room);
  if (socketRooms.get(socketId)?.size === 0) socketRooms.delete(socketId);
}

function emitPresence(boardId) {
  const room = BOARD_ROOM(boardId);
  const users = [...(presence.get(room)?.values() ?? [])];
  ioRef?.to(room).emit("board:presence", { boardId, users });
}

function removeFromPresence(socketId, boardId) {
  const room = BOARD_ROOM(boardId);
  if (presence.get(room)?.delete(socketId)) {
    if (presence.get(room).size === 0) presence.delete(room);
    emitPresence(boardId);
  }
  untrack(socketId, room);
}

function handleJoin(socket, payload) {
  const { boardId, user } = normalizeJoin(payload);
  if (!boardId) return;
  const room = BOARD_ROOM(boardId);
  socket.join(room);
  track(socket.id, room);
  if (user) {
    if (!presence.has(room)) presence.set(room, new Map());
    presence.get(room).set(socket.id, user);
  }
  emitPresence(boardId);
}

function handleLeave(socket, payload) {
  const { boardId } = normalizeJoin(payload);
  if (!boardId) return;
  socket.leave(BOARD_ROOM(boardId));
  removeFromPresence(socket.id, boardId);
}

function handleDisconnect(socket) {
  const rooms = [...(socketRooms.get(socket.id) ?? [])];
  for (const room of rooms) {
    const boardId = room.startsWith("board:")
      ? room.slice("board:".length)
      : room;
    removeFromPresence(socket.id, boardId);
  }
  socketRooms.delete(socket.id);
}

// ---------------------------------------------------------------------------
// HTTP + Socket.io
// ---------------------------------------------------------------------------
const RELAY_EVENTS = [
  "board-updated",
  "task:moved",
  "task:updated",
  "task:created",
  "task:deleted",
  "board:updated",
  "activity:logged",
];

let nextHandler = null;
if (SERVE_NEXT) {
  const next = (await import("next")).default;
  const dev = process.env.NODE_ENV !== "production";
  const app = next({ dev, dir: ROOT });
  await app.prepare();
  nextHandler = app.getRequestHandler();
  console.log("[socket] Also serving the Next.js app (--serve-next).");
}

const httpServer = createServer((req, res) => {
  // Let Socket.io own its transport path.
  if (req.url?.startsWith("/socket.io")) return;

  if (nextHandler && req.url !== "/__socket_health") {
    nextHandler(req, res);
    return;
  }

  const url = req.url?.split("?")[0] ?? "/";
  if (url === "/" || url === "/health") {
    const body =
      url === "/health"
        ? JSON.stringify({ status: "ok", uptime: process.uptime() })
        : "Socket.io Server Running";
    res.writeHead(200, {
      "Content-Type": url === "/health" ? "application/json" : "text/plain",
    });
    res.end(body);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const io = new Server(httpServer, {
  path: "/socket.io",
  cors: { origin: "*" },
});
ioRef = io;

io.on("connection", (socket) => {
  socket.on("join-board", (payload) => handleJoin(socket, payload));
  socket.on("leave-board", (payload) => handleLeave(socket, payload));
  // Legacy aliases used by the current Next.js frontend.
  socket.on("board:join", (payload) => handleJoin(socket, payload));
  socket.on("board:leave", (payload) => handleLeave(socket, payload));

  socket.on("disconnect", () => handleDisconnect(socket));

  // Generic relay: clients emit one of the board/task/activity events with
  // { boardId, ...payload }; the server forwards to the room.
  for (const event of RELAY_EVENTS) {
    socket.on(event, (payload) => {
      const boardId = payload?.boardId;
      if (typeof boardId === "string" && boardId.length > 0) {
        socket.to(BOARD_ROOM(boardId)).emit(event, payload);
      }
    });
  }
});

function shutdown(signal) {
  console.log(`[socket] Received ${signal} — shutting down.`);
  httpServer.close(() => {
    mongoose.disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

await connectDb();

httpServer.listen(port, () => {
  console.log(`> Socket.io server running on port ${port}`);
});
