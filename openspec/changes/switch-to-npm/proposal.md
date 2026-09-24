# Change: switch-to-npm

## Summary

Chuyển package manager duy nhất của repository từ pnpm sang npm workspace. Thay đổi cập nhật lockfile, lệnh phát triển, Docker, CI, cấu hình E2E và tài liệu; không thay đổi hành vi ứng dụng hoặc kiến trúc runtime đã phê duyệt.

## Problem / Purpose

Nền tảng hiện được bootstrap bằng pnpm, trong khi nhóm muốn dùng npm. Dùng đồng thời `pnpm-lock.yaml` và `package-lock.json` có thể tạo dependency tree không nhất quán giữa máy phát triển, CI và container. Repository cần một package manager, một lockfile và một bộ lệnh thống nhất.

## Goals

- Dùng npm workspace làm package manager duy nhất cho root, ứng dụng và package dùng chung.
- Thay `pnpm-lock.yaml` bằng `package-lock.json` được tạo từ chính các dependency hiện có.
- Cập nhật scripts, Playwright, Docker, GitHub Actions và README để dùng npm.
- Giữ nguyên Node.js 24, dependency version đã khai báo, cấu trúc monorepo và toàn bộ hành vi bootstrap hiện có.
- Xác minh lại các quality gate bằng npm.

## Non-Goals

- Không nâng hoặc thay dependency chỉ để chuyển package manager.
- Không thay đổi Next.js, NestJS, Socket.IO, cấu hình game RAM-only, endpoint `GET /health` hoặc Swagger.
- Không thêm database, Prisma, migration, cache, queue hay business feature poker.
- Không thay đổi deployment topology gồm Caddy, web và API.

## Scope

Thay đổi bao gồm root workspace manifest và scripts, lockfile, cấu hình pnpm đã không còn dùng, lệnh khởi động E2E, Dockerfile, GitHub Actions, README và tài liệu kiến trúc có nhắc đến pnpm.

## Assumptions

- npm 10.9.3 là baseline đã có sẵn tại thời điểm soạn change; Node.js 24 vẫn là runtime mục tiêu của repository.
- npm workspaces bao phủ `apps/*`, `packages/*` và `tests/*` như workspace pnpm hiện tại.
- `npm ci` dùng cho CI và Docker để cài đúng dependency từ lockfile.
- Người dùng không cần tương thích đồng thời với pnpm sau khi change được áp dụng.

## Compatibility Considerations

Lệnh của người phát triển đổi từ `pnpm …` sang `npm …`; giao diện web, API, endpoint health, OpenSpec và dữ liệu runtime không đổi. Không có database schema, migration, API contract hay game state cần chuyển đổi. Developer đang dùng pnpm cần chạy `npm install` một lần sau khi change hoàn tất để tạo/cập nhật `node_modules` theo lockfile npm.

## Risks

- npm có thể giải quyết dependency tree khác pnpm dù version range giữ nguyên.
- Docker layer cài dependency workspace có thể cần copy đầy đủ manifest workspace trước khi gọi `npm ci`.
- Dùng Node.js thấp hơn 24 vẫn bị từ chối theo engine của repository; máy hiện tại dùng Node 22 chỉ phù hợp để kiểm tra giới hạn, không thay đổi runtime mục tiêu.
- Docker runtime có thể chưa sẵn sàng cục bộ, nên routing Compose có thể tiếp tục cần kiểm tra khi Docker daemon hoạt động.

## Acceptance Criteria

- [ ] Root manifest khai báo npm workspaces và npm là package manager duy nhất.
- [ ] `package-lock.json` tồn tại, còn `pnpm-lock.yaml` và `pnpm-workspace.yaml` không còn tồn tại.
- [ ] `npm ci` cài được toàn bộ workspace theo lockfile.
- [ ] Scripts root, Playwright, Docker, CI và README không còn yêu cầu pnpm.
- [ ] Format check, lint, typecheck, unit/smoke test, build, E2E và Compose config chạy qua npm.
- [ ] Không có dependency, endpoint hay business behavior mới.
