# InTrack

Intern attendance, daily logbooks, planning, and mentor progress tracking.

## Structure

- client: React, Vite, Tailwind UI.
- server: Express API, Prisma and PostgreSQL.
- ai-service: Python FastAPI and InsightFace.

## Setup

Install dependencies with npm install in the root, client, and server directories. Copy the placeholder configuration from docs/intrack.server.env.example into server/.env and supply your own credentials.

Run npm run db:generate --prefix server. For a new empty database only, run npm run db:push --prefix server. Set BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_PASSWORD (minimum 12 characters) before npm run db:seed --prefix server. No default login credentials are included. The seed creates an admin and missing settings without resetting existing users.

Run npm run dev for frontend and Node API (port 3001). Start Python separately from ai-service after installing requirements: python -m uvicorn main:app --host 127.0.0.1 --port 8001.

## Documentation

- [New accounts and integrations](INTRACK_NEW_ACCOUNTS_GUIDE.md)
- [Function audit and known issues](WEBSITE_FUNCTION_AUDIT.md)
- [Design reference](DESIGN.md)
- [UI plan](UI_REBRANDING_PLAN.md)

Google and Notion OAuth connect integrations; application login uses email/password. Calendar sync is partial and one-way. Review the audit before production use.

Build: npm run build --prefix client. Cookie tests: node --test server/test/auth-cookies.test.js. Isolated audit: node docs/function-audit.cjs (reports known defects, not an all-pass suite).

This publication excludes previous Git history, live credentials, demo credential seeds, local logs, and dependency directories. Deployment configurations tied to the previous application are excluded; configure your own frontend/API routing before hosting.
