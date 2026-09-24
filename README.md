# Private Card Table

Ứng dụng web chơi No-Limit Texas Hold'em cho nhóm riêng. Dự án hiện ở giai đoạn bootstrap: trang web tối thiểu, API health check, testing, Docker và CI đã được thiết lập; chưa có tính năng phòng hoặc game.

## Available games

- **Texas Hold'em:** No-Limit private poker with host-confirmed hands.
- **Bài nói dối:** 2–4 players, 1–10 starting lives, face-down claims, challenges and a host-confirmed next round. Joker is always valid; private cards are delivered only to their owner.

Both game types are RAM-only: restarting the API removes rooms and matches.

## Prerequisites

- Node.js 24 LTS (`.nvmrc`)
- npm 10.9.3 hoặc mới hơn
- Docker Desktop nếu chạy bằng Compose

## Local setup

```bash
npm install
cp .env.example .env
npm run build
```

Chạy API và web trong hai terminal:

```bash
npm run start:dev --workspace=@poker/api
npm run dev --workspace=@poker/web
```

Web chạy tại `http://localhost:3000`; API health check tại `http://localhost:3001/health`; Swagger tại `http://localhost:3001/docs`.

## Commands

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run compose:check
```

E2E cần Chromium. Cài một lần bằng `npm exec -- playwright install chromium`.

## Docker

```bash
docker compose up --build
```

Với `.env.example`, Caddy phục vụ local HTTP trên cổng 80. Khi deploy, đặt `CADDY_DOMAIN` là tên miền thực và `PUBLIC_ORIGIN` là HTTPS origin tương ứng để Caddy cấp TLS.

## State limitation

Phiên bản ứng dụng theo kiến trúc RAM-only. Khi các tính năng game được thêm, restart API hoặc đóng phòng sẽ xóa dữ liệu phiên; không có PostgreSQL, Prisma hoặc migration trong bootstrap.

## Bàn poker 3D

Giao diện dùng camera cố định, bàn nỉ xanh và điều khiển tiếng Việt. Mỗi ván cần chủ phòng chọn **Bắt đầu ván**. Cấp chip, chuyển chủ, mời ra và đóng phòng nằm trong **Quản lý**, chỉ dùng giữa các ván. Nút **Xem bài riêng** độc lập với **Check — không thêm chip**.

WebGL 2 được dùng cho cảnh 3D; khi không khả dụng, bàn 2D vẫn giữ các thao tác. Tài nguyên bài/chip/bàn được tạo trong ứng dụng, không cần tải ảnh bên ngoài. Chế độ giảm chuyển động của hệ điều hành được tôn trọng.

Reload giữ phiên nếu API vẫn đang chạy. Mật khẩu lời mời chỉ giữ trong tab người tạo phòng, che mặc định và không đưa vào URL. Nếu máy chủ ngừng, giao diện báo lỗi kết nối để thử lại; restart API làm mất phòng theo kiến trúc RAM-only.

Kiểm thử E2E dùng cổng riêng 3100/3101 và không tái sử dụng server đang chạy. Sau kiểm thử, các server do phiên test tạo phải được dừng; không dừng tiến trình phát triển của người dùng.

## Nhịp chơi đồng bộ

Poker và Bài nói dối có nhịp chia bài 1,8 giây, chuyển lượt 0,45 giây và công bố kết quả theo từng bước. Backend quyết định thời gian; đồng hồ 180 giây chỉ bắt đầu khi người chơi được hành động. Trong chuyển tiếp, giao diện hiển thị lý do chờ và khóa thao tác game/quản lý. Chủ phòng vẫn xác nhận ván hoặc vòng tiếp theo.

Reload hoặc quay lại tab không chạy lại hiệu ứng đã bỏ lỡ. Chế độ giảm chuyển động giữ nguyên nhịp của bàn nhưng bỏ chuyển động trang trí. API tự build package contracts trước build, typecheck và test; không cần chạy thủ công thêm bước này.
