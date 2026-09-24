# Design: switch-to-npm

## Approved Architecture

Kiến trúc đã phê duyệt vẫn là Next.js frontend, NestJS backend realtime và shared contracts trong một monorepo. Backend đơn giữ trạng thái game trong RAM khi các feature game được triển khai sau này. Caddy, web và API vẫn chạy bằng Docker Compose. Change này chỉ thay công cụ quản lý dependency; không thay kiến trúc hay hành vi quan sát được.

## Technology Choices

| Area             | Choice after change                       |
| ---------------- | ----------------------------------------- |
| Runtime target   | Node.js 24 LTS                            |
| Package manager  | npm 10.9.3 baseline, npm workspaces       |
| Lockfile         | Root `package-lock.json`                  |
| Workspace layout | `apps/*`, `packages/*`, `tests/*`         |
| Frontend         | Next.js App Router, Tailwind CSS, Zustand |
| Backend          | NestJS, Socket.IO, Swagger                |
| Test             | Jest, React Testing Library, Playwright   |
| Quality          | ESLint, Prettier, strict TypeScript       |

No dependency is added, removed, upgraded or downgraded as part of this change unless npm must add its own lockfile metadata.

## Repository and Script Strategy

The root `package.json` SHALL declare `workspaces` for the current application, package and E2E directories. It SHALL identify npm as the supported package manager and replace its pnpm engine constraint with an npm constraint. The current root command names remain unchanged to avoid changing the quality-gate interface:

- root cross-workspace scripts use `npm run <script> --workspaces --if-present` where ordering is immaterial;
- targeted API, web and E2E scripts use `npm run <script> --workspace=<workspace-name>`;
- `tests/e2e/playwright.config.ts` starts its web servers with the same targeted npm commands.

`pnpm-workspace.yaml` and `pnpm-lock.yaml` SHALL be removed only after a valid root `package-lock.json` has been generated. The existing `.npmrc` SHALL be retained only if it contains npm-relevant, non-secret configuration; otherwise it SHALL be removed. No package-local lockfile may be created.

## Module Boundaries

Workspace boundaries stay unchanged:

- `apps/web` remains the minimal Next.js application shell.
- `apps/api` remains the NestJS health and transport foundation.
- `packages/contracts` remains intentionally empty of domain contracts.
- `tests/e2e` remains the Playwright smoke-test workspace.

This change SHALL not create a domain module, a Socket.IO application event, an access mechanism or a poker rule.

## Configuration Strategy

Runtime configuration remains unchanged. `NODE_ENV`, ports, public origin, log level and Caddy configuration continue to come from `.env`/environment variables, with `.env.example` as documentation. No secret is introduced or exposed to frontend variables by changing package manager.

## Database Foundation

No database is configured. The approved RAM-only application model remains unchanged; no ORM, migration command or persistence environment variable is added.

## Testing Foundation

The existing test tools and test cases remain intact. The verification interface changes only from pnpm invocations to npm invocations. The required check sequence is:

1. `npm ci`
2. `npm run format:check`
3. `npm run lint`
4. `npm run typecheck`
5. `npm run test`
6. `npm run build`
7. install Playwright Chromium through npm and run `npm run test:e2e`
8. `npm run compose:check`

The API startup smoke check continues to call `GET /health`. Docker routing is validated when a Docker daemon is available.

## CI Foundation

GitHub Actions SHALL use `actions/setup-node` with npm cache and `npm ci`. It SHALL remove the pnpm setup action and invoke existing root quality-gate script names with npm. Playwright browser installation SHALL use `npm exec playwright install --with-deps chromium`. CI continues to require no runtime secret.

## Deployment Foundation

Dockerfiles SHALL use the existing Node.js 24 image and non-root runtime user. Before `npm ci`, each build stage SHALL copy the root `package.json`, root `package-lock.json`, and every workspace `package.json` necessary for npm workspace resolution. Build and runtime commands SHALL target the appropriate workspace with npm. Docker Compose, Caddy routes, ports, health checks and deployment model remain unchanged.

## Security Considerations

- The lockfile is committed and `npm ci` prevents floating dependency installation in CI and Docker.
- npm registry configuration, if retained, must not contain credentials; credentials remain outside source control.
- No environment secret, private card, cookie, password or room data is introduced into package scripts, CI logs or Docker image layers.
- The existing CORS, Socket.IO origin and Caddy security controls are unaffected.

## Spec Coverage

This change modifies developer tooling only. It introduces no observable application behavior beyond the already specified operations endpoint; therefore it requires no OpenSpec spec delta.
