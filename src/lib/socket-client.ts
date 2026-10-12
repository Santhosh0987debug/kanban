"use client";

import { useEffect } from "react";
import { io, type Socket } from "socket.io-client";
import type { PresenceUser } from "@/lib/types";

let socket: Socket | null = null;

/**
 * Standalone socket server URL (e.g. Render deployment).
 * When unset, connects same-origin (single-port `node socket-server.mjs --serve-next`).
 */
const SOCKET_URL =
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SOCKET_URL
    : undefined;

/** Browser-side Socket.io singleton (connects to the custom server). */
export function getSocket(): Socket {
  if (!socket) {
    const opts = {
      path: "/socket.io",
      autoConnect: true,
      reconnection: true,
    };
    socket = SOCKET_URL ? io(SOCKET_URL, opts) : io(opts);
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
