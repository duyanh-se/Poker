# Tasks: switch-to-npm

## 1. Prepare the npm workspace

- [x] Inspect existing manifests and pnpm configuration for dependency and script parity.
- [x] Update root `package.json` to declare npm, npm engine support and current workspace globs.
- [x] Translate root workspace scripts to equivalent npm workspace commands without changing their public names.
- [x] Retain or remove `.npmrc` based only on whether its settings are relevant and non-secret for npm.

## 2. Create the dependency lock foundation

- [x] Generate the root `package-lock.json` using npm without intentionally changing declared dependency versions.
- [x] Verify that npm recognises all workspaces and produces no nested lockfile.
- [x] Remove `pnpm-lock.yaml` and `pnpm-workspace.yaml` after the npm lockfile is valid.

## 3. Update delivery and developer tooling

- [x] Update Playwright web-server commands to npm workspace commands.
- [x] Update API and web Dockerfiles to use npm workspace installation, build and start commands.
- [x] Update GitHub Actions cache, install, browser-install and quality-gate commands to npm.
- [x] Update README prerequisites, local setup, commands and Playwright instructions to npm.
- [x] Update architecture documentation that identifies pnpm as the active workspace tool.

## 4. Verify behavior and delivery

- [x] Run a clean `npm ci` install using the committed lockfile.
- [x] Run format check, lint and typecheck through npm.
- [x] Run unit and smoke tests through npm.
- [x] Run builds and Playwright E2E through npm.
- [x] Run Compose configuration validation through npm.
- [x] Start the API and verify `GET /health` remains available.
- [x] Attempt Docker Compose build and routing validation; the local Docker Desktop daemon is unavailable, so runtime routing remains externally blocked.
- [x] Review the resulting diff against this change, the bootstrap change and existing OpenSpec specs.

## External Blocker

- `docker info --format '{{.ServerVersion}}'` cannot connect to `//./pipe/dockerDesktopLinuxEngine`; Docker Compose build and routing must be rerun after Docker Desktop is started.
