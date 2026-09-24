# Change: bootstrap-project

## Summary

Tạo nền tảng chạy được cho ứng dụng Poker Texas Hold'em: pnpm monorepo gồm Next.js frontend, NestJS backend realtime và shared contracts. Bootstrap chỉ thiết lập cấu trúc, công cụ chất lượng, môi trường, Docker, CI và health check; không triển khai nghiệp vụ poker.

## Problem / Purpose

Repository hiện chỉ có tài liệu và living specs. Các change sau cần một nền tảng nhất quán để phát triển, kiểm thử và triển khai theo OneSpec/OpenSpec.

## Goals

- Khởi tạo pnpm workspace cho `apps/web`, `apps/api` và `packages/contracts`.
- Cấu hình Next.js, NestJS, TypeScript strict, Tailwind, Zustand và Socket.IO foundation.
- Thiết lập lint, format, typecheck, unit test, E2E test, build và CI.
- Cấu hình môi trường, Docker Compose, Caddy và endpoint health.
- Bổ sung spec delta cho các endpoint vận hành công khai.
- Giữ database, Prisma, migration, cache, queue và business feature ngoài bootstrap.

## Non-Goals

- Không tạo phòng, vào phòng, guest session hoặc authorization nghiệp vụ.
- Không triển khai luật poker, chia bài, chip, timer, Socket.IO command hay snapshot game.
- Không tạo database connection hoặc migration vì kiến trúc được phê duyệt dùng RAM-only state.
- Không tạo UI bàn chơi hoặc business API.

## Scope

Tạo skeleton chạy được với trang web cơ bản, API NestJS có health check và Swagger vận hành, shared contracts rỗng có chủ đích, cấu hình chất lượng và hạ tầng chạy local/VPS.

## Assumptions

- Node.js 24 LTS và pnpm được dùng xuyên suốt.
- PostgreSQL, Prisma và migration không được thêm trong bootstrap.
- API là process đơn; Docker Compose phù hợp một VPS.
- GitHub Actions là CI target khi repository được đưa lên GitHub.

## Compatibility Considerations

Không có behavior cũ, schema, migration hoặc public API cần tương thích. Bootstrap thêm `GET /health` và Swagger UI chỉ mô tả endpoint này; cả hai được mô tả trong spec delta `operations`.

## Risks

- Phiên bản dependency mới có thể gây xung đột giữa Next.js, NestJS và tooling.
- Docker build có thể cần điều chỉnh theo kiến trúc CPU/VPS thực tế.
- Không có persistence là hành vi có chủ đích; restart API sẽ không giữ game state khi feature game được thêm.

## Acceptance Criteria

- [ ] Workspace cài dependency bằng lockfile và chạy được các package.
- [ ] Web và API build thành công.
- [ ] API trả trạng thái health.
- [ ] Swagger chỉ mô tả endpoint health và không công bố endpoint nghiệp vụ.
- [ ] Lint, format check, typecheck và test cơ bản chạy được.
- [ ] Docker Compose chạy web/API qua Caddy.
- [ ] CI chạy các quality gate không cần secret.
- [ ] Không có business behavior ngoài health check.
