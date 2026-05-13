# FireSlot Nepal 🔥

A full-stack Free Fire tournament platform for Nepal. Players join paid NPR tournaments, upload payment proof (eSewa / Khalti / Bank), get room ID after admin approval, play their match, submit a result screenshot, and receive winnings into an in-app wallet they can withdraw.

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Frontend** (`apps/web`): Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Zod, lucide-react
- **Backend** (`apps/api`): NestJS 10, REST API, JWT auth, class-validator, multer (local file uploads)
- **Database** (`packages/db`): PostgreSQL + Prisma
- **Shared** (`packages/shared`): Zod schemas + game-mode constants used by both apps

## Project Structure

```
fireslot-nepal/
├─ apps/
│  ├─ api/         # NestJS backend
│  └─ web/         # Next.js frontend
├─ packages/
│  ├─ db/          # Prisma schema, client, seed
│  └─ shared/      # Shared zod schemas + types
├─ turbo.json
├─ pnpm-workspace.yaml
└─ .env.example
```

## Getting Started

### 1. Prerequisites
- Node.js 18+
- pnpm 9
- PostgreSQL 14+

### 2. Install
```bash
pnpm install
```

### 3. Configure Environment
Copy and edit:
```bash
cp .env.example .env
cp .env.example apps/api/.env
cp .env.example apps/web/.env.local
```
Set `DATABASE_URL`, `JWT_SECRET`, and admin credentials.

### 4. Database
```bash
pnpm db:generate     # generate Prisma client
pnpm db:migrate      # create + run migrations
pnpm db:seed         # creates admin + sample tournaments
```

### 5. Run dev servers
```bash
pnpm dev
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:4000/api

### Default Accounts (after seed)
- **Admin** — `admin@fireslot.np` / `Admin@123`
- **Player** — `player1@fireslot.np` / `Player@123`

## User Flow

1. Register & create player profile (Free Fire UID + IGN).
2. Browse tournaments, filter by mode/status.
3. Click **Join Now**, then upload payment proof (image).
4. Admin reviews payment in `/admin/payments` and approves.
5. Once approved, slot is locked and **Room ID + Password** become visible on the tournament detail page.
6. Play the match in Free Fire.
7. Submit result screenshot via the result endpoint (`POST /api/results`).
8. Admin verifies result, then declares winners (`POST /api/tournaments/:id/winners` with `[{ userId, placement, prize }]`). Wallets are credited automatically.
9. Player requests withdrawal from `/wallet`.
10. Admin processes withdrawal in `/admin/withdrawals`.

## API Modules

| Module | Path | Notes |
|--------|------|-------|
| Auth | `/api/auth/*` | register, login, me |
| Profile | `/api/profile` | Free Fire UID + IGN |
| Tournaments | `/api/tournaments/*` | list/filter, detail, join, admin create/status/room/winners |
| Challenges | `/api/challenges/*` | user-created challenges |
| Payments | `/api/payments/*` | submit proof (multipart), admin approve/reject |
| Wallet | `/api/wallet/*` | balance, transactions, withdrawals |
| Results | `/api/results/*` | submit screenshot, admin verify |
| Notifications | `/api/notifications` | per-user feed |
| Admin | `/api/admin/*` | stats, users, ban/unban, action logs |
| Leaderboard | `/api/leaderboard` | total NPR won |

## Security Rules Enforced

- Room ID/password hidden until payment is `APPROVED` (or admin requests `/full`).
- Tournament `filledSlots` increments only after payment approval.
- Cannot join the same tournament twice (unique constraint).
- Cannot join a full tournament.
- All admin routes are protected via `@Roles(ADMIN)` + JWT guard.
- All admin write actions are recorded in `AdminActionLog`.
- Withdrawals debit balance immediately and refund on rejection.

## Game Modes Supported

`BR_SOLO`, `BR_DUO`, `BR_SQUAD`, `CS_4V4`, `LW_1V1`, `LW_2V2`, `CRAFTLAND`

## Extending to Real Payments

The `Payment` model and submission endpoint already accept `method`, `reference`, and `proofUrl`. Replace the manual flow with eSewa/Khalti by:

1. Calling their checkout SDK from the frontend in [`apps/web/src/app/tournaments/[id]/page.tsx`](apps/web/src/app/tournaments/[id]/page.tsx).
2. Creating a webhook controller under `apps/api/src/modules/payments/` that auto-approves payments matching a verified `reference`.
3. Replacing manual `approve()` admin step with the webhook handler.

## Development Scripts

```bash
pnpm dev          # turbo dev (web + api)
pnpm build        # turbo build
pnpm db:migrate   # prisma migrate dev
pnpm db:seed      # seed admin + sample tournaments
pnpm db:studio    # Prisma Studio GUI
```

## File Uploads

Payment and result screenshots are saved to `./uploads` (configurable via `UPLOAD_DIR`) and served at `http://localhost:4000/uploads/<filename>`.

## License

MIT
# FireShot-Nepal
# Esport
# Esport
# Esport
# FireShot
