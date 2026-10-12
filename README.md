# Real-Time Full-Stack Kanban SaaS 📋✨

A production-grade, Trello-style task management app with **live multi-user collaboration**. When one user drags, edits, or deletes a task, everyone else on the board sees it update instantly — no refresh. Built end-to-end with Next.js App Router, MongoDB, Zustand, dnd-kit, and Socket.io.

## ✨ Highlights

- **Dynamic workspaces** — unlimited boards with fully custom columns (Todo, Doing, Done, or anything you invent)
- **Fluid drag-and-drop** — dnd-kit ordering across and within columns with fractional indexing (O(1) moves, no full-column rewrites)
- **Optimistic UI + conflict resolution** — every mutation applies instantly, snapshots roll back on failure, and simultaneous edits return a 409 with automatic reload instead of silent overwrites
- **Live collaboration** — Socket.io room-per-board, online presence avatars, and a real-time activity audit trail
- **Task depth** — subtasks with progress tracking ("2 of 3"), assignees with avatar initials, due dates with overdue highlighting
- **Polish** — dark/light mode with persistence, shimmer skeleton loaders, spring-physics modals/drawers, toasts for every mutation, designed empty/error/crash states

## 🛠️ Tech Stack

| Layer      | Technology |
|------------|------------|
| Framework  | Next.js 16 (App Router), React 19, TypeScript |
| Styling    | Tailwind CSS v4, Framer Motion, Sonner toasts, Lucide icons |
| State      | Zustand (optimistic UI, board cache, presence, activity) |
| DnD        | @dnd-kit/core, @dnd-kit/sortable |
| Backend    | Next.js Route Handlers + custom Socket.io server (`socket-server.mjs`) |
| Database   | MongoDB + Mongoose (Board, Column, Task, Subtask, ActivityLog) |
| Validation | Zod on every API input |

## 🚀 Getting Started

### Prerequisites

- Node.js 20.9+ (24 recommended) and npm
- MongoDB — local (`mongodb://127.0.0.1:27017/kanban`) or Atlas

### 1. Install

```bash
npm install
```

### 2. Configure

Create `.env.local`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017/kanban
```

> For production/Atlas: `MONGODB_URI=mongodb+srv://<user>:<pass>@cluster/kanban?retryWrites=true&w=majority`

### 3. Run (app + WebSockets)

```bash
npm run dev:ws
```

Open [http://localhost:3000](http://localhost:3000). Open a second tab (or incognito window) to watch live collaboration — drag a card in one tab and see it move in the other.

> `npm run dev` starts Next.js only (no Socket.io). Real-time features require `dev:ws` / `start:ws`, which serve Next.js through the custom `socket-server.mjs`.

### Other scripts

```bash
npm run build     # production build
npm run start:ws  # production server with Socket.io
npm run lint      # eslint
```

## 📂 Project Structure

```
kanban/
├── socket-server.mjs              # Custom Next.js + Socket.io server (rooms, presence, relays)
├── src/
│   ├── app/
│   │   ├── page.tsx               # Renders <AppShell />
│   │   └── api/
│   │       ├── boards/route.ts              # GET list, POST create (+ default columns)
│   │       ├── boards/[boardId]/route.ts    # GET detail, PUT rename/sync columns, DELETE cascade
│   │       ├── boards/[boardId]/logs/route.ts # GET last 50 logs, POST audit entry
│   │       ├── tasks/route.ts               # POST create task + subtasks
│   │       ├── tasks/[taskId]/route.ts      # PUT edit (409 on conflict), DELETE + subtasks
│   │       └── tasks/move/route.ts          # PUT atomic drag-and-drop with fractional order
│   ├── components/
│   │   ├── AppShell.tsx           # Theme init, data bootstrap, Toaster, modals, drawer
│   │   ├── board/                 # BoardView (DndContext), Column, TaskCard, ActivityLogDrawer
│   │   ├── layout/                # Sidebar (collapsible + mobile drawer), Header (presence, activity)
│   │   ├── modals/                # Modal shell, BoardModal, TaskModal, ViewTaskModal
│   │   └── ui/                    # Skeleton loaders, EmptyState, ErrorBoundary
│   ├── lib/
│   │   ├── mongoose.ts            # Cached connection for serverless/HMR
│   │   ├── order.ts               # Fractional indexing helpers
│   │   ├── socket-client.ts       # Singleton + useBoardRoom (identity + reconnect rejoin)
│   │   ├── socket-events.ts       # Shared event contract
│   │   ├── types.ts               # DTOs + date/initials/relative-time helpers
│   │   └── validation/schemas.ts  # Zod schemas for all inputs
│   ├── models/                    # Board, Column, Task, Subtask, ActivityLog (Mongoose)
│   └── store/useBoardStore.ts      # Zustand: boards, optimistic mutations, presence, logs
└── .env.local                     # MONGODB_URI (git-ignored, create your own)
```

## 🗄️ Data Model

- **Board** — `name`, timestamps
- **Column** — `name`, `boardId` (ref, indexed), `order` (fractional index base 1000)
- **Task** — `title`, `description`, `status` (denormalized column name), `columnId`, `boardId`, `order`, `assignedTo`, `dueDate`, timestamps, `optimisticConcurrency: true`
- **Subtask** — `title`, `isCompleted`, `taskId`, `boardId`
- **ActivityLog** — `boardId`, `action`, `actorName`, timestamps

Key indexes: `{boardId, order}`, `{columnId, order}`, `{boardId, updatedAt}`, `{boardId, createdAt}` (logs).

## 🔌 Real-Time Protocol

One Socket.io room per board (`board:<id>`). Identity is a stable per-browser `{id, name}` (`Guest-XX`).

| Direction | Event | Payload |
|-----------|-------|---------|
| client → server | `board:join` / `board:leave` | `{boardId, user?}` (re-joins on reconnect) |
| server → room | `board:presence` | `{boardId, users: [{id, name}]}` |
| client → room (relayed) | `task:moved`, `task:updated`, `task:created`, `task:deleted`, `board:updated`, `activity:logged` | `{boardId, …}` |

Flow: REST mutation succeeds → client emits the event → server relays to room peers (sender excluded, keeping its optimistic UI) → peers merge into Zustand state.

## 🧠 Engineering Notes

- **Fractional indexing** — inserts use `(prev + next) / 2`; columns auto-renormalize to 1000-steps when gaps shrink below 1e-6.
- **Conflict resolution** — `expectedUpdatedAt` checks + Mongoose `VersionError` both surface as 409s; the client refetches, rolls back, and toasts.
- **Audit discipline** — metadata edits, moves, creates, and deletes are logged and broadcast; subtask checkbox toggles skip logging to keep the feed signal-rich.
- **Failure design** — skeletons while loading, toasts with rollback on every failed mutation, retryable error states, and an error boundary keyed per board.

## 🌐 Deploying

Standard Next.js hosting (e.g. Vercel) serves the UI + API, but WebSockets need a long-lived Node process: deploy `socket-server.mjs` (`npm run start:ws`) on a host that supports it (Railway, Render, Fly.io, or your own VPS) with `MONGODB_URI` set in the environment.

## 📝 License

MIT — built as a portfolio engineering project.
