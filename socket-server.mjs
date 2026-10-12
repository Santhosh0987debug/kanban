/**
 * Custom Next.js + Socket.io server.
 *
 * Next.js Route Handlers cannot hold persistent WebSocket connections,
 * so real-time collaboration runs through this small custom server.
 *
 * Run:
 *   node socket-server.mjs          (production: serves `next start` + WS)
 *   $env:PORT=3000; node socket-server.mjs
 *
 * Protocol (see src/lib/socket-events.ts):
 *   client -> server: "board:join"  ({boardId, user?} | boardId) -> joins room + presence
 *   client -> server: "board:leave" ({boardId, user?} | boardId) -> leaves room + presence
 *   server -> room:   "board:presence" ({boardId, users: [{id, name}]})
 *   server -> room:   "task:moved" | "task:updated" | "task:created"
 *                     | "task:deleted" | "board:updated" | "activity:logged"
 *
 * API routes broadcast by POSTing to themselves is NOT needed — the
 * browser emits the event after a successful REST mutation and the
 * server re-broadcasts it to the rest of the room (sender excluded
 * via `socket.to(...)` so the sender keeps its optimistic UI).
 * Presence is broadcast to the whole room (including the joiner) so
 * newcomers immediately receive the current user list.
 */
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const app = next({ dev });
const handle = app.getRequestHandler();

const BOARD_ROOM = (id) => `board:${id}`;

// room -> (socketId -> { id, name })
const presence = new Map();
// socketId -> Set<room>
const socketRooms = new Map();

function normalizeJoin(payload) {
  if (typeof payload === "string") return { boardId: payload, user: null };
  return {
    boardId: typeof payload?.boardId === "string" ? payload.boardId : "",
    user:
      payload?.user && typeof payload.user.id === "string"
        ? { id: payload.user.id, name: String(payload.user.name ?? "Anonymous").slice(0, 60) }
        : null,
  };
}

function track(socketId, room) {
  if (!socketRooms.has(socketId)) socketRooms.set(socketId, new Set());
  socketRooms.get(socketId).add(room);
}

function untrack(socketId, room) {
  socketRooms.get(socketId)?.delete(room);
  if (socketRooms.get(socketId)?.size === 0) socketRooms.delete(socketId);
}

function emitPresence(io, boardId) {
  const room = BOARD_ROOM(boardId);
  const users = [...(presence.get(room)?.values() ?? [])];
  io.to(room).emit("board:presence", { boardId, users });
}

function removeFromPresence(io, socketId, boardId) {
  const room = BOARD_ROOM(boardId);
  if (presence.get(room)?.delete(socketId)) {
    if (presence.get(room).size === 0) presence.delete(room);
    emitPresence(io, boardId);
  }
  untrack(socketId, room);
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));

  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: dev ? { origin: "*" } : undefined,
  });

  io.on("connection", (socket) => {
    socket.on("board:join", (payload) => {
      const { boardId, user } = normalizeJoin(payload);
      if (!boardId) return;
      const room = BOARD_ROOM(boardId);
      socket.join(room);
      track(socket.id, room);
      if (user) {
        if (!presence.has(room)) presence.set(room, new Map());
        presence.get(room).set(socket.id, user);
      }
      emitPresence(io, boardId);
    });

    socket.on("board:leave", (payload) => {
      const { boardId } = normalizeJoin(payload);
      if (!boardId) return;
      socket.leave(BOARD_ROOM(boardId));
      removeFromPresence(io, socket.id, boardId);
    });

    socket.on("disconnect", () => {
      const rooms = [...(socketRooms.get(socket.id) ?? [])];
      for (const room of rooms) {
        const boardId = room.startsWith("board:") ? room.slice("board:".length) : room;
        removeFromPresence(io, socket.id, boardId);
      }
      socketRooms.delete(socket.id);
    });

    // Generic relay: clients emit one of the task/board/activity events with
    // { boardId, ...payload }; the server forwards to the room.
    const relay = ["task:moved", "task:updated", "task:created", "task:deleted", "board:updated", "activity:logged"];
    for (const event of relay) {
      socket.on(event, (payload) => {
        const boardId = payload?.boardId;
        if (typeof boardId === "string" && boardId.length > 0) {
          socket.to(BOARD_ROOM(boardId)).emit(event, payload);
        }
      });
    }
  });

  httpServer.listen(port, () => {
    console.log(`> Kanban ready on http://localhost:${port} (Socket.io enabled)`);
  });
});
