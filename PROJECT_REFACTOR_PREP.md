# Project Refactor Preparation

## Current State Snapshot

- Stack: Node.js + Express 5, single runtime entry in `server.js`.
- Main API code is fully concentrated in `api/index.js`.
- Data storage is in-memory (`db = { blogs: [], posts: [] }`) with counters.
- Deployment config exists for Vercel in `vercel.json`.
- No actual tests found in `__tests__` (directory exists but empty).

## Main Risks and Technical Debt

1. **Security**
   - Hardcoded admin credentials in code (`admin:qwerty`).
   - `.env` contains real connection data; keep only local and rotate leaked secrets if needed.

2. **Architecture**
   - Entire API logic (routing, validation, auth, data access) is in one file.
   - No clear layering (`routes -> controllers -> services -> repositories`).

3. **Data and Persistence**
   - MongoDB dependency is installed but not used by runtime code.
   - In-memory data resets on restart; not production-safe.

4. **Project Hygiene**
   - Multiple lockfiles (`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) create package manager drift.
   - `api/package.json` duplicates dependencies and can confuse deployment/runtime ownership.
   - `express-validator` is installed but not used.

5. **API Consistency**
   - Router is mounted with overlapping prefixes (`/hometask_03/api`, `/api/index.js`, and root).
   - Validation is custom inline middleware; hard to scale and reuse.

## Recommended Target Structure

Suggested backend structure:

`src/app.js` - app composition  
`src/server.js` - process bootstrap  
`src/routes/*.route.js`  
`src/controllers/*.controller.js`  
`src/services/*.service.js`  
`src/repositories/*.repository.js`  
`src/middlewares/*.middleware.js`  
`src/validators/*.validator.js`  
`src/db/mongo.js`  
`src/config/*.config.js`

## Refactor Roadmap (Phased)

### Phase 1 - Stabilize Baseline

- Pick one package manager and remove extra lockfiles.
- Add ESLint + Prettier + simple scripts (`lint`, `format`, `test`).
- Add basic health route (`/health`) and global error handler.

### Phase 2 - Decompose Monolith File

- Split `api/index.js` into modules by responsibility.
- Move auth and validation to dedicated middleware/validator files.
- Normalize route mounting under one versioned prefix (for example `/api/v1`).

### Phase 3 - Persistence Migration

- Introduce Mongo connection module and env-driven config.
- Replace in-memory storage with repositories on Mongo collections.
- Keep response contracts unchanged during migration.

### Phase 4 - Quality Net

- Add integration tests for blogs/posts CRUD and auth cases.
- Add validation tests (bad payloads, edge lengths, bad URL, missing blogId).
- Add smoke test for startup + DB connection.

### Phase 5 - Hardening

- Move credentials and secrets to env only.
- Add centralized config validation at startup.
- Add request logging and optional rate limiting for admin endpoints.

## First Sprint Backlog (Practical)

1. Create `src/` structure and move current app wiring there without behavior changes.
2. Introduce `blogs` and `posts` routers/controllers.
3. Replace hardcoded auth with `ADMIN_LOGIN` / `ADMIN_PASSWORD` from env.
4. Add Jest + Supertest and cover current happy-path CRUD.
5. Remove dead dependencies/usages and keep one lockfile.

## Done Criteria for "Refactor-Ready"

- App behavior remains backward-compatible for existing endpoints.
- CI (or local scripts) runs lint + tests successfully.
- No hardcoded credentials in code.
- Storage abstraction exists, allowing in-memory or Mongo implementations.
