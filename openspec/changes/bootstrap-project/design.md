# Design: bootstrap-project

## Approved Architecture

Hệ thống là modular monolith với Next.js frontend và NestJS backend. Backend đơn sở hữu trạng thái trong RAM và là nguồn quyết định game state. Frontend giao tiếp qua HTTP cho lifecycle và Socket.IO cho realtime. Bootstrap chỉ cài transport foundation, không đăng ký command game.

## Technology Choices

| Area      | Choice                                    |
| --------- | ----------------------------------------- |
| Runtime   | Node.js 24 LTS                            |
| Language  | TypeScript strict                         |
| Workspace | pnpm workspace                            |
| Frontend  | Next.js App Router, Tailwind CSS, Zustand |
| Backend   | NestJS, Socket.IO, Swagger                |
| Test      | Jest, React Testing Library, Playwright   |
| Quality   | ESLint, Prettier, `tsc --noEmit`          |

## Repository Structure

```text
apps/
  api/
  web/
packages/
  contracts/
tests/
  e2e/
deploy/
.github/workflows/
openspec/
```

## Module Boundaries

`apps/api` SHALL contain configuration, health, and Socket.IO transport foundation. Business modules (`session-access`, `rooms`, `chips`, `poker`, and `realtime`) SHALL be created by their first approved feature change, not as empty placeholders. `apps/web` SHALL contain only the application shell without business state. `packages/contracts` SHALL contain no domain contract until one is consumed by both applications.

## Configuration Strategy

API configuration SHALL validate `NODE_ENV`, `API_PORT`, `WEB_PORT`, `PUBLIC_ORIGIN`, and `LOG_LEVEL` at startup. Deployment configuration SHALL additionally require `CADDY_DOMAIN`; local Compose uses HTTP on `localhost` and production Caddy terminates TLS for `CADDY_DOMAIN`. `.env.example` SHALL document every variable, its local default, and whether it is server-only. Secrets SHALL remain server-only and not use `NEXT_PUBLIC_` names.

## Database Foundation

N/A. The approved architecture explicitly uses ephemeral in-memory state. Bootstrap SHALL not install, configure, connect to, or migrate a database.

## Testing Foundation

Jest SHALL support API/domain tests, React Testing Library SHALL support web components, and Playwright SHALL run smoke E2E tests. Initial tests cover the health endpoint and web shell only; poker behavior remains specified but unimplemented.

## CI Foundation

GitHub Actions SHALL install dependencies from the lockfile then run format check, lint, typecheck, unit/integration tests, build and E2E. Playwright SHALL start the API and web servers with test-local environment values through its `webServer` configuration. The workflow SHALL not require runtime secrets.

## Deployment Foundation

Docker Compose SHALL run Caddy, web and API. Caddy SHALL be the only public service and proxy `/api`, `/socket.io`, `/health`, and `/docs` to API. Web and API containers SHALL run as non-root users and expose health checks; Caddy shall wait for the services to be healthy. The deployment has no database, volume-backed game state, cache or worker process.

## Security Considerations

- Health responses SHALL not reveal internal state or configuration.
- CORS and Socket.IO origins SHALL be configured from validated environment values.
- Socket.IO SHALL reject connections from origins other than `PUBLIC_ORIGIN`; it shall register no application events or private-data payloads in this change.
- Caddy SHALL set baseline response security headers and proxy only the approved web, API, and Socket.IO paths.
- Logs SHALL not contain secrets, cookies, room passwords, decks or private cards.
- The bootstrap SHALL expose no business command or unauthenticated management endpoint.
