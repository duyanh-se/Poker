# Tasks: bootstrap-project

## 1. Workspace and shared contracts

- [x] Initialize the root pnpm workspace and Node version pinning.
- [x] Add root scripts for format check, lint, typecheck, test, build, E2E, and Compose verification.
- [x] Generate and commit the pnpm lockfile.
- [x] Create the strict TypeScript `packages/contracts` package with build and typecheck scripts, without domain exports.

## 2. Web foundation

- [x] Initialize Next.js App Router in `apps/web`.
- [x] Configure Tailwind, global styles, and a minimal Vietnamese application shell.
- [x] Configure Zustand as an available dependency without a business store.
- [x] Configure React Testing Library and a shell smoke test.

## 3. API foundation

- [x] Initialize NestJS in `apps/api`.
- [x] Add validated API configuration and environment handling.
- [x] Add the health module and `GET /health` endpoint.
- [x] Configure Swagger metadata and document the health endpoint.
- [x] Configure Socket.IO transport foundation with validated origin checks and no game events.
- [x] Configure Jest and a health endpoint smoke test.

## 4. Quality and environment

- [x] Configure ESLint and Prettier rules.
- [x] Wire format check and strict typecheck scripts across all workspace packages.
- [x] Add `.env.example` and environment documentation, including local and production Caddy values.
- [x] Configure Playwright server startup with test-local environment values.
- [x] Add health and home smoke E2E tests.

## 5. Delivery foundation

- [x] Add non-root Dockerfiles for web and API.
- [x] Add Caddyfile with route and security-header rules.
- [x] Add Docker Compose configuration with health checks and local/production configuration behavior.
- [x] Add GitHub Actions quality-gate workflow with explicit E2E service startup.
- [x] Create README with local setup, commands, Docker instructions, and RAM-only state limitation.

## 6. Verification and review

- [x] Run install.
- [x] Run format check and lint.
- [x] Run typecheck.
- [x] Run unit and integration tests.
- [x] Run build.
- [x] Run E2E smoke tests.
- [ ] Validate Docker Compose routing.
- [x] Review output against this change, initial specs, and acceptance criteria.
