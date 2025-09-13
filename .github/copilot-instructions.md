# Copilot Instructions for dongam-culture-analyzer

These instructions teach AI agents how to be productive immediately in this repo. Keep responses concise and concrete; reference files by path.

## System architecture
- Frontend (Vite + React) in `frontend/` renders the UI and calls API routes under `/api`. Dev server proxies `/api` to the deployed Vercel Functions (see `frontend/vite.config.js`).
- Serverless API (Vercel Functions) in `api/**` integrates with Supabase. Important routes:
  - `api/sessions` + `api/sessions/[sessionCode]/**`: session CRUD and join/leave
  - `api/gateway-auth` + `api/gateway-admin`: authentication (admin or temp password) and admin operations; reads/writes Supabase tables
  - `api/generate-prompt`, `api/fields/**`, `api/artifacts` etc.
- Local single-process backend for on-prem runs in `backend/app.py` (FastAPI). Frontend can also target this (see `README-RUN.md`). The Vercel Functions mirror most endpoints.
- Data stores:
  - Supabase tables: `sessions` (real workshop sessions), `temp_passwords` (one-time keys), `gateway_access_logs` (login logs), plus artifacts/realtime tables.
  - Local file artifacts and session-index for on-prem mode in `uploads/`.

## Key patterns & conventions
- API base URL: use dynamic resolution via `frontend/src/utils/networkUtils.js#getApiUrl()`. In components/hooks, prefer `dynamicApiBase` rather than hardcoding.
- Admin auth: `api/gateway-auth` returns a `sessionToken` prefixed with `gw_...`. Admin-only endpoints (e.g., `api/gateway-admin`) accept either the env `GATEWAY_ADMIN_PASSWORD` or a valid `gw_*` token in `Authorization: Bearer ...`.
- Session model differs between environments:
  - Vercel: `sessions` table fields: `code`, `name`, `description`, `participant_count`, `created_at`, `last_access`, `status`.
  - Backend/FastAPI: camelCase keys (`participantCount`, `createdAt`, etc.). When showing sessions in React, keep this in mind and map/guard accordingly.
- Join a session via `POST /api/sessions/{code}/join` and store `currentSessionCode`/`currentSessionName` in `localStorage` (see `SessionManager.jsx`).
- Admin Panel uses `useAuth` and calls `GET /api/gateway-admin?type=sessions` to list sessions, `DELETE /api/admin/sessions/{code}` to delete.

## Developer workflows
- Local (recommended for UI work):
  - Frontend: `cd frontend && npm run dev` (port 3333; proxies `/api` to production unless you change proxy target).
  - On‑prem full stack: use `run-dev.ps1` to start FastAPI (127.0.0.1:8000) and Vite (5176) with proxy to backend.
- Tests: `frontend` has Jest/RTL configured; run with `npm test` (if added). No test runner for Vercel Functions currently.
- Deployment: push to `main` triggers Vercel build. Confirm endpoints with curl (examples below).

## Useful curl checks (production)
- List sessions (admin):
  - `curl -H "Authorization: Bearer WINTER09@!" https://dongam-culture-analyzer.vercel.app/api/gateway-admin?type=sessions`
- Join session:
  - `curl -X POST https://dongam-culture-analyzer.vercel.app/api/sessions/KSS1GW/join`

## Common pitfalls (avoid them)
- Do NOT query `gateway_access_logs` for sessions. Real sessions are in the `sessions` table.
- Do NOT mix API base variables: use `apiBase` or `dynamicApiBase` consistently; avoid undefined `API_BASE`.
- When adding admin features, always pass `Authorization: Bearer <admin-password or gw_* token>`.
- In React, guard against field name differences (snake_case from Supabase vs camelCase in FastAPI). Prefer using objects as‑is from the API and conditional render.

## Where to add things
- New server endpoints → `api/<route>.js` (Vercel Function). Mirror in `backend/app.py` only if required for on‑prem.
- Frontend API calls → `frontend/src/services/api-vercel.js` (axios) or components/hooks using `dynamicApiBase`.
- Admin features → `frontend/src/hooks/useAuth.jsx`, `frontend/src/components/AdminPanel.jsx` and Vercel routes `api/gateway-*`.

## Definition of done (repo‑specific)
- Verify with curl against the deployed URL and with the local dev server if changed.
- Update `README-RUN.md` when changing ports/proxy.
- If touching session flows, test: list → join → leave, and Admin Panel session listing.
