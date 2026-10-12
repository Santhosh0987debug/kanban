/**
 * Shared Socket.io event + room contract used by both the
 * custom socket server (socket-server.mjs) and the client hook.
 */
export const SocketEvents = {
  BoardJoin: "board:join",
  BoardLeave: "board:leave",
  BoardPresence: "board:presence",
  TaskMoved: "task:moved",
  TaskUpdated: "task:updated",
  TaskCreated: "task:created",
  TaskDeleted: "task:deleted",
  BoardUpdated: "board:updated",
  ActivityLogged: "activity:logged",
} as const;

export type SocketEventName =
  (typeof SocketEvents)[keyof typeof SocketEvents];

export function boardRoom(boardId: string): string {
  return `board:${boardId}`;
}
