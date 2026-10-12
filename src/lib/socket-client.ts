"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import type { PresenceUser } from "@/lib/types";

let socket: Socket | null = null;

/**
 * Socket.io backend URL.
 * - Explicit `NEXT_PUBLIC_SOCKET_URL` always wins (Vercel env, split deploys).
 * - Production builds without the variable default to the Render backend so
 *   the browser never polls the frontend origin (same-origin 404).
 * - Local dev keeps same-origin (single-port `--serve-next` / `next dev`).
 */
const PRODUCTION_SOCKET_URL = "https://kanban-p52i.onrender.com";

const SOCKET_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_SOCKET_URL) ||
  undefined;

const EFFECTIVE_URL =
  SOCKET_URL ||
  (typeof process !== "undefined" && process.env.NODE_ENV === "production"
    ? PRODUCTION_SOCKET_URL
    : undefined);

/** Browser-side Socket.io singleton (connects to the custom server). */
export function getSocket(): Socket {
  if (!socket) {
    if (
      typeof window !== "undefined" &&
      !SOCKET_URL &&
      process.env.NODE_ENV === "production"
    ) {
      // Same-origin fallback 404s on split deploys (Vercel + Render),
      // so production falls back to the Render backend instead.
      console.warn(
        "[socket] NEXT_PUBLIC_SOCKET_URL is not set — connecting to the " +
          `production backend at ${PRODUCTION_SOCKET_URL}. Set the env var to override.`
      );
    }
    const opts = {
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
    };
    socket = EFFECTIVE_URL ? io(EFFECTIVE_URL, opts) : io(opts);
  }
  return socket;
}

function joinPayload(boardId: string, user: PresenceUser | null) {
  return user ? { boardId, user } : boardId;
}

/**
 * Join a board room and leave it on unmount. Re-runs when boardId changes.
 * Passes the local user so the server can track room presence.
 */
export function useBoardRoom(boardId: string | null, user: PresenceUser | null) {
  useEffect(() => {
    if (!boardId) return;
    const s = getSocket();
    s.emit("board:join", joinPayload(boardId, user));
    // Re-join after reconnects (server-side rooms don't survive them).
    const onConnect = () => s.emit("board:join", joinPayload(boardId, user));
    s.on("connect", onConnect);
    return () => {
      s.off("connect", onConnect);
      s.emit("board:leave", joinPayload(boardId, user));
    };
  }, [boardId, user]);
}
