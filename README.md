# InTrack

Intern attendance, daily logbooks, planning, and mentor progress tracking.

## Structure

- client: React, Vite, Tailwind UI.
- server: Express API, Prisma and PostgreSQL.
- ai-service: Python FastAPI and InsightFace.

## Setup

Install dependencies with npm install in the root, client, and server directories. Copy the placeholder configuration from docs/intrack.server.env.example into the root .env and supply your own credentials. Existing process environment takes priority, followed by server/.env overrides, then root .env. Prisma scripts use the same loader.

Run npm run db:generate --prefix server. For a new empty database, run npm run db:migrate --prefix server. Existing databases require a verified baseline first; the current local Neon database has already been baselined and migrated. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (minimum 12 characters) before npm run db:seed --prefix server. No default login credentials are included. The seed creates an admin and missing settings without resetting existing users.

Run npm run dev for frontend and Node API (port 3001). Start Python separately from ai-service after installing requirements: python -m uvicorn main:app --host 127.0.0.1 --port 8001.

## Documentation

- [New accounts and integrations](INTRACK_NEW_ACCOUNTS_GUIDE.md)
- [Implementation status and test results](IMPLEMENTATION_STATUS.md)
- [Function audit and known issues](WEBSITE_FUNCTION_AUDIT.md)
- [Design reference](DESIGN.md)
- [UI plan](UI_REBRANDING_PLAN.md)

Google and Notion OAuth connect integrations; application login uses email/password. Calendar sync is partial and one-way. Review the audit before production use.

Build: npm run build --prefix client. Tests: npm test. Lint: npm run lint --prefix client. GitHub Actions runs these checks without production secrets. The original docs/function-audit.cjs is a historical pre-migration harness; use the current tests and live audit instructions in IMPLEMENTATION_STATUS.md.

This publication excludes previous Git history, live credentials, demo credential seeds, local logs, and dependency directories. Deployment configurations tied to the previous application are excluded; configure your own frontend/API routing before hosting.

## AI chat scope

AI Chat is limited to InTrack intern data, attendance, logbooks, progress, planning, and relevant mentoring guidance. A separate model classification runs before answer generation. Out-of-scope requests receive a fixed refusal. Simple greetings, thanks, and language choices have distinct local replies without a provider call. Clear Indonesian/English questions and explicit language preferences override the classifier's language choice. Invalid classification results stop the request. Database fields and previous messages are treated as untrusted data, and missing records must not be invented. Answers default to 100 words, or 60 for brief requests; performance judgments require sufficient evidence. The database context retains task outputs and details, distinguishes attendance submissions from presence, and declares its date range and any truncated results.

`npm test` checks language selection, scope gating, errors, and context construction with isolated fixtures. To evaluate the configured model itself, run `node --test server/test/ai-scope.live.cjs` explicitly. This uses AI provider quota with fictional intern data and does not access the database. The live suite runs sequentially, waits 15 seconds between provider requests, and skips remaining scenarios after a provider failure. Re-run it when changing models or prompts; model classification and generated answers remain probabilistic, and unit tests alone do not establish prompt-injection resistance. In-scope questions use two provider requests under a shared 45-second timeout; the live suite's deliberate intra-request delay also counts toward that timeout.
