# System Overview (Very Detailed)

This document describes the overall system architecture, runtime responsibilities, and major flows of **FireSlot Nepal**—a full-stack tournament platform where players join paid tournaments, upload payment proofs, get room credentials after approval, submit results, and receive winnings into an in-app wallet.

---

## 1) High-level Architecture

### 1.1 Monorepo Layout
The repository is a **Turborepo + pnpm workspaces** monorepo. The main packages/apps are:

- **`apps/web/`**: Next.js application (frontend) + Android/Capacitor wrapper for the mobile app.
- **`apps/api/`**: NestJS application (backend) exposing REST APIs.
- **`packages/db/`**: Database package using **Prisma** (schema, migrations, seed, Prisma client).
- **`packages/shared/`**: Shared code (e.g., Zod schemas and constants used by both web and api).

### 1.2 Runtime Components
At runtime, the system consists of:

1. **Mobile App / Web UI** (Next.js + Capacitor)
   - Auth screens (register/login)
   - Tournament browsing + join flows
   - Payment proof upload UI
   - Admin-facing UI routes (for admin users)
   - In-app update checker modal

2. **Backend API** (NestJS)
   - Authentication + authorization (JWT + roles)
   - Tournament lifecycle (create → join → approval → room assignment → result submission)
   - Payment processing workflow (proof upload, admin approval/rejection)
   - Wallet + withdrawals
   - Results verification and winner declaration
   - Notifications
   - App update config serving (`/app/config`)

3. **Database** (PostgreSQL + Prisma)
   - Stores users, tournaments, payments, results, wallet balances, transactions, etc.

4. **File Storage**
   - Upload artifacts (payment proof images, result screenshots) saved under server-side uploads directory.
   - Served via `/uploads/<filename>`.

5. **Automation / CI-CD**
   - GitHub Actions builds APKs and produces releases.

---

## 2) Core Concepts & Data Lifecycle

Even though each module is implemented separately, the business flow can be understood as a **state machine** across several domains:

### 2.1 Tournament Lifecycle
A tournament typically goes through:

1. **Created by admin**
   - Admin sets metadata (mode, slots, prize, date/time, etc.)
   - Tournament is created in DB with initial counters.

2. **Open for joining**
   - Player selects tournament and clicks join.

3. **Payment proof submission**
   - Player uploads proof of payment.
   - Payment record is created.
   - Tournament slot is not fully committed until approval.

4. **Admin review & approval**
   - Admin checks proof.
   - On approval: the player becomes an accepted participant.
   - Room credentials (ID/password) become visible once approved conditions are met.
   - On rejection: the player’s join attempt is cancelled and/or refunded (wallet refund behavior depends on implementation).

5. **Room becomes usable**
   - Players receive **room ID + password** (only when allowed by system rules).

6. **Match played**
   - Player submits result screenshot.

7. **Result verification and winners declared**
   - Admin verifies result.
   - Winners are assigned with placements/prize.
   - Wallet balances are credited.

8. **Withdrawals**
   - Player requests withdrawal.
   - Admin processes withdrawal.

### 2.2 Wallet Lifecycle
- Wallet maintains a balance for each user.
- When winnings are confirmed, wallet is credited.
- When withdrawal is requested, funds may be debited immediately or reserved depending on the business rules.
- If withdrawal is rejected, money is refunded.

### 2.3 Payments Lifecycle
- Player submits:
  - payment method
  - reference (e.g., transaction reference)
  - proof URL (server stores uploaded artifact)
- Admin approves/rejects.
- Approved payments lead to:
  - participant acceptance
  - tournament slot availability update
  - eventual results and winnings flow.

---

## 3) Frontend (apps/web) Responsibilities

### 3.1 Technology
- Next.js App Router (`apps/web/src/app/*`)
- Tailwind CSS
- TypeScript
- Framer Motion (UI)
- Zod (validation, often paired with shared schemas/constants)

### 3.2 UI Surface Areas
From repository structure:

- **Public user pages**
  - `/login`, `/register`
  - tournament listing and detail routes (`/tournaments/*`)
  - player matches (`/my-matches`)
  - wallet (`/wallet`)
  - support (`/support`)

- **Admin pages**
  - admin tournaments create/manage
  - admin super pages and configuration
  - admin areas likely exposed via role guards

- **Notifications**
  - user-facing notifications page

### 3.3 App Update Checker (Mobile UX)
The system provides an in-app update checker that:

- Calls the backend endpoint **`GET /app/config`**.
- Receives:
  - latest version
  - download URL
  - force update flag
- The frontend shows a modal and prompts installation.

Key frontend files (mentioned in docs):
- `apps/web/src/hooks/useAppUpdates.ts`
- `apps/web/src/lib/update-checker.ts`
- `apps/web/src/components/AppUpdateModal.tsx`
- `apps/web/src/lib/update-context.tsx`

### 3.4 Backend API Integration on Frontend
The frontend has an API client layer (e.g., `apps/web/src/lib/api.ts`) responsible for making HTTP requests to NestJS.

---

## 4) Backend (apps/api) Responsibilities

### 4.1 Technology
- NestJS
- REST APIs
- JWT auth and role-based guards

### 4.2 App Module: How Backend Modules Are Wired
The NestJS root `AppModule` imports all major modules such as:

- `AuthModule`
- `UsersModule`
- `ProfileModule`
- `TournamentsModule`
- `ChallengesModule`
- `PaymentsModule`
- `WalletModule`
- `ResultsModule`
- `NotificationsModule`
- `AdminModule`
- `CategoriesModule`
- `BotModule`
- `SupportModule`
- `AppReleasesModule`
- `BannersModule`
- `ReferralsModule`
- `SuperAdminModule`
- plus common infrastructure:
  - `PrismaModule`
  - `StorageModule`
  - `CacheModule`
  - `RealtimeModule`
  - global `TransformInterceptor`
  - global `AllExceptionsFilter`
  - `LoggerMiddleware`

This means the backend is a **modular domain service** where each business area has dedicated controller/service files.

### 4.3 Cross-cutting Concerns

#### 4.3.1 Logging
- `LoggerMiddleware` is applied to all routes (`forRoutes('*')`).

#### 4.3.2 Error Handling
- `AllExceptionsFilter` converts thrown exceptions into a consistent API error response.

#### 4.3.3 Response Transformation
- `TransformInterceptor` applies consistent serialization/format transformations.

#### 4.3.4 Scheduling (Optional)
- If `BOT_SCHEDULER_ENABLED === 'true'`, the backend includes `ScheduleModule.forRoot()`.

### 4.4 Module Responsibilities (Conceptual Mapping)

Below is a conceptual mapping aligned to the module names and documented API areas:

- **Auth** (`/api/auth/*`)
  - register/login
  - JWT issuance
  - `me` endpoint

- **Users** (`/api/users/*` likely)
  - user management

- **Profile** (`/api/profile`)
  - store Free Fire UID and IGN

- **Tournaments** (`/api/tournaments/*`)
  - list/filter
  - create (admin)
  - join (player)
  - detail including room credentials visibility rules
  - admin actions like approving status / winners

- **Challenges** (`/api/challenges/*`)
  - user-created challenges

- **Payments** (`/api/payments/*`)
  - upload payment proof (multipart)
  - admin approval/rejection

- **Wallet** (`/api/wallet/*`)
  - balance, wallet transactions
  - withdrawals

- **Results** (`/api/results/*`)
  - player submits result screenshot
  - admin verification and winner assignment

- **Notifications** (`/api/notifications`)
  - per-user feed

- **Admin** (`/api/admin/*`)
  - dashboards/stats
  - ban/unban, action logs
  - admin write actions recorded in an action log

- **Super Admin** (`/api/super-admin/*`)
  - higher privilege admin management
  - separate guard/module for stricter access

- **App Releases / Updates** (`GET /app/config`)
  - returns latest version information for the in-app update checker

---

## 5) Database (packages/db) Responsibilities

### 5.1 Technology
- Prisma
- PostgreSQL

### 5.2 What the DB Stores (By Domain)

From the system behavior, DB tables/entities must cover:
- Users and auth-related profiles
- Player profile data (UID/IGN)
- Tournaments and tournament settings
- Tournament participants and their join/payment status
- Payments (method/reference/proof)
- Results (placement screenshot/verification status)
- Wallet balances and transaction ledger
- Withdrawals state and admin processing state
- Notifications
- Admin action logs (for audit)
- App release config (latest version, force flag, min Android version, download enablement)

### 5.3 Migrations & Seeding
Repository scripts indicate:
- generate prisma client
- migrate
- seed admin + sample tournaments

---

## 6) File Upload & Serving

### 6.1 What Gets Uploaded
- **Payment proofs**: images uploaded by players
- **Result screenshots**: images uploaded by players

### 6.2 Storage Path Concept
The uploaded artifacts are saved on the backend in an uploads directory (configurable).

### 6.3 Serving
Uploads are served as static files from the backend under:
- `http://localhost:4000/uploads/<filename>`

---

## 7) Security Model

### 7.1 Authentication
- JWT-based auth.

### 7.2 Authorization
- Role-based access control (RBAC) with decorators/guards.
- Admin routes and write operations are protected.
- Super-admin has separate stricter guard and controller.

### 7.3 Business Rule Security
The system enforces key workflow rules, for example:
- room ID/password are hidden until payment status is approved
- cannot join the same tournament twice
- cannot join a full tournament

---

## 8) In-App Update System (End-to-End)

### 8.1 Backend: `GET /app/config`
Backend returns:
- `latestVersion`
- `downloadUrl`
- `force` / `minAndroidVersion`

Config keys used by this system include:
- `APP_LATEST_VERSION`
- `APP_MIN_ANDROID_VERSION`
- `APP_FORCE_UPDATE_ENABLED`
- `APP_DOWNLOAD_ENABLED`

### 8.2 Frontend Flow
- App checks updates on mount and periodically (e.g., every 6 hours).
- If `latestVersion` is higher, modal appears.
- If forced:
  - user cannot dismiss
- On “Update Now”:
  - app opens download URL
  - Android install prompt handles installation

### 8.3 APK Download URL
The backend exposes the APK file from the public downloads folder (or equivalent static route).

---

## 9) CI/CD and APK Release Pipeline

### 9.1 GitHub Actions Trigger
- Workflow triggers on push to `main` (and supports manual trigger).

### 9.2 Build Steps (Conceptual)
- Setup Node + pnpm
- Setup Java + Android SDK
- Build Next.js web assets
- Sync Capacitor with Android project
- Build APK via Gradle
- Copy APK to `public/downloads/`
- Compute checksum
- Create GitHub Release
- Upload artifact (with retention)

### 9.3 Versioning
Version format is generally:
- `MAJOR.MINOR.PATCH-<hash>`

The workflow can compute version code and version name using git history (e.g., commit count and commit hash).

### 9.4 Admin “Latest Version” Switch
Even if APK is built automatically:
- the app will only notify users if backend config (`APP_LATEST_VERSION`) points to that newly built version.

---

## 10) Operational / Developer View

### 10.1 Local Development
Typical workflow (from repo README):
- install dependencies
- configure environment variables
- run dev servers (web + api)

### 10.2 Health Endpoint
Backend includes a health controller (`HealthController`).

### 10.3 Maintenance & Troubleshooting
- If update prompts don’t show:
  - verify backend config keys
  - verify version comparison logic
  - verify APK exists at download URL
- If CI/CD build fails:
  - check Actions logs
  - rerun workflow

---

## 11) Key Files Index (Quick Reference)

### Backend
- `apps/api/src/app.module.ts`
- `apps/api/src/health.controller.ts`

### Frontend Update System
- `apps/web/src/hooks/useAppUpdates.ts`
- `apps/web/src/lib/update-checker.ts` (referenced by docs)
- `apps/web/src/components/AppUpdateModal.tsx`

### Update Docs (already in repo)
- `docs/AUTO_UPDATE_QUICK_START.md`
- `docs/IN_APP_UPDATE_CHECKER.md`
- `docs/GITHUB_ACTIONS_CI_CD.md`

---

## 12) Summary

FireSlot Nepal is a monorepo system with:
- a **Next.js + Capacitor frontend** (`apps/web`)
- a **NestJS backend API** (`apps/api`) built from modular domain controllers/services
- a **Prisma-managed PostgreSQL database** (`packages/db`)
- a shared schema/types package (`packages/shared`)
- a complete **APK build + release** automation pipeline via GitHub Actions
- an **in-app update checker** that uses backend-served config (`GET /app/config`)

The main end-user business flow is driven by tournament state transitions across payments, approvals, room credential unlock, results verification, and wallet crediting.

