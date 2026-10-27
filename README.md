# Private Card Table

Ứng dụng web chơi No-Limit Texas Hold'em cho nhóm riêng. Dự án hiện ở giai đoạn bootstrap: trang web tối thiểu, API health check, testing, Docker và CI đã được thiết lập; chưa có tính năng phòng hoặc game.

## Available games

- **Texas Hold'em:** No-Limit private poker with host-confirmed hands.
- **Bài nói dối:** 2–4 players, 1–10 starting lives, face-down claims, challenges and a host-confirmed next round. Joker is always valid; private cards are delivered only to their owner.
- **Mũ Trắng:** 4–12 người chơi và 1 quản trò không tham gia. Quản trò nhập hai từ, dùng chia role tự động hoặc chỉnh số gián điệp/mũ trắng, đặt số người bị loại mỗi vòng rồi lưu và bắt đầu. Người chơi chỉ nhận từ riêng, không có nhãn role. Mô tả lần lượt 60 giây; vote/bầu lại 60 giây, hòa lần hai do quản trò phân xử. Phiếu công khai khi chốt, role bị loại giấu tới cuối ván. Mỗi đợt vote có cùng 30 giây chờ quyền đoán cuối; mũ trắng cũng được lộ diện đoán ở hai khoảng nghỉ. Đúng dấu và đúng từ dân thường thì thắng riêng ngay; sai bị loại. Dân thường thắng khi hết gián điệp/mũ trắng, kể cả dân thường đã chết; gián điệp thắng khi bằng/vượt tổng người sống khác sau quyền đoán cuối. Chỉ còn mũ trắng được đoán 30 giây, không ai đúng thì dân thường thắng.

All game types are RAM-only: restarting the API removes rooms and matches. Mũ Trắng khóa roster/config trong ván; người bị loại chỉ xem, rời phòng là bỏ cuộc. Chuyển quản trò giữa các ván xóa bộ từ chuẩn bị. Từ riêng tự che khi mất focus/kết nối; chỉ quản trò nhận bộ từ và role đầy đủ. Deploy cả API và Web khi thêm game này, không cần migration hoặc biến môi trường mới.

Mũ Trắng có giao diện **Secret Party** riêng: nền sáng xanh cobalt/coral, mascot mũ trắng, 12 avatar nhân vật trung tính, board chọn vote, tiến trình vòng và hiệu ứng chiến thắng. Avatar không liên quan đến role. Font tiếng Việt và ảnh được lưu cục bộ trong `apps/web/public/white-hat`; ảnh dùng tối ưu hóa của Next Image. Điện thoại có thanh gửi phiếu cố định, vẫn hỗ trợ bàn phím và giảm chuyển động; reconnect không phát lại ăn mừng cũ. Theme chỉ áp dụng cho Mũ Trắng.

## Chat và thao tác bài

**Chat phòng** nổi gọn ở góc trống trên màn hình rộng; khi không đủ chỗ, chat nằm dưới bàn, không làm lệch tâm bàn. Có thể thu gọn, xem tin mới và số chưa đọc mà không mất bản nháp; không dùng drawer. Chat dùng văn bản thuần, tối đa 300 ký tự/tin và 5 tin trong 10 giây mỗi người. Phòng giữ 50 tin gần nhất trong RAM; người mới vào và người reconnect nhận phần lịch sử này. Đóng phòng hoặc restart API sẽ xóa chat. Chống gửi lặp áp dụng cho 128 lệnh chat được chấp nhận gần nhất trong phòng.

Nút **Xem/Che bài** nằm gần tay bài của bạn; mất focus vẫn tự che bài. Poker có các nút **+1, +2, +5, +10, +20, +50** cộng vào tổng mức cược đang nhập, không gửi cược ngay. Ví dụ tổng 10, bấm +5 thành 15. Vẫn nhập trực tiếp hoặc dùng thanh kéo và xác nhận Cược/Tăng; mức vượt stack bị khóa.

Trong Poker, giao diện bài của chủ phòng **Duy Anh** dùng nút **Xem bài riêng / Che bài riêng** giống người chơi thường. Bấm thông thường chỉ xem bài của mình; giữ liên tục nút này **5 giây** bằng chuột, cảm ứng hoặc phím Space/Enter mới xem mọi bài đã chia, kể cả bài đã bỏ. Nhả nút sau khi giữ đủ thời gian vẫn giữ bài mở; bấm che, mất focus/kết nối, reload, đổi phòng/người xem/ván hoặc mất quyền chủ sẽ reset và cần giữ lại. Bài công khai khi so bài vẫn hiện. Quyền do API cấp riêng cho chủ phòng hiện tại có tên hiển thị chính xác **Duy Anh**; khách cùng tên và chủ phòng tên khác không nhận thêm bài. Tên hiển thị không xác minh danh tính thật. Thao tác giữ là điều khiển hiển thị cục bộ; API hiện có vẫn gửi các bài được phép cho chủ phòng. Web mới dùng cùng API hỗ trợ quyền này, không cần migration hoặc cấu hình mới.

Khi cập nhật tính năng chat, deploy cả API và Web. Không có migration hoặc biến môi trường mới.

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

## Deploy lên Render

Render Free phù hợp để demo. Service ngủ sau 15 phút không có traffic; API restart sẽ xóa tất cả phòng vì game state chỉ tồn tại trong RAM.

Giữ **Root Directory** trống. Tạo API Web Service trước với Build Command là `npm ci --include=dev && npm run build --workspace=@poker/api` và Start Command là `npm run start --workspace=@poker/api`. Không thêm dấu `-` hay `--` ở cuối lệnh. Đặt `NODE_VERSION=24.12.0`, `NODE_ENV=production`, `PUBLIC_ORIGIN=https://TEN-WEB-SERVICE.onrender.com`, `LOG_LEVEL=warn`, và tùy chọn `SESSION_COOKIE_NAME=poker_session`. `--include=dev` là bắt buộc vì TypeScript và các type definition chỉ cần khi build đang là development dependencies.

Tạo Web Web Service từ cùng repository với Build Command là `npm ci --include=dev && npm run build --workspace=@poker/web` và Start Command là `npm run start --workspace=@poker/web`. Đặt `NODE_VERSION=24.12.0`, `NODE_ENV=production`, `API_INTERNAL_ORIGIN=https://TEN-API-SERVICE.onrender.com`, và `NEXT_PUBLIC_API_ORIGIN=https://TEN-API-SERVICE.onrender.com`. Ứng dụng tự dùng `PORT` do Render cung cấp, nên không đặt `API_PORT` hoặc `WEB_PORT`.

## State limitation

Phiên bản ứng dụng theo kiến trúc RAM-only. Khi các tính năng game được thêm, restart API hoặc đóng phòng sẽ xóa dữ liệu phiên; không có PostgreSQL, Prisma hoặc migration trong bootstrap.

## Bàn poker 3D

Giao diện dùng camera cố định, bàn nỉ xanh và điều khiển tiếng Việt. Mỗi ván cần chủ phòng chọn **Bắt đầu ván**. Cấp chip, chuyển chủ, mời ra và đóng phòng nằm trong **Quản lý**, chỉ dùng giữa các ván. Nút **Xem bài riêng** độc lập với **Check — không thêm chip**.

WebGL 2 được dùng cho cảnh 3D; khi không khả dụng, bàn 2D vẫn giữ các thao tác. Tài nguyên bài/chip/bàn được tạo trong ứng dụng, không cần tải ảnh bên ngoài. Chế độ giảm chuyển động của hệ điều hành được tôn trọng.

Reload giữ phiên nếu API vẫn đang chạy. Mật khẩu lời mời chỉ giữ trong tab người tạo phòng, che mặc định và không đưa vào URL. Nếu máy chủ ngừng, giao diện báo lỗi kết nối để thử lại; restart API làm mất phòng theo kiến trúc RAM-only.

Kiểm thử E2E dùng cổng riêng 3100/3101 và không tái sử dụng server đang chạy. Sau kiểm thử, các server do phiên test tạo phải được dừng; không dừng tiến trình phát triển của người dùng.

## Chơi trên điện thoại dọc

Poker dùng bàn 2D dọc, Bài nói dối dùng bàn CSS/SVG; không cần xoay ngang. Menu trên cùng chứa lời mời, luật, kết quả và quản lý. Chạm tên người chơi để xem thông tin; Poker mở bảng nhập khi chọn Cược/Tăng. Bài riêng có nút che/xem, tổ hợp Poker có thể chạm để đọc chi tiết. Màn hình nhỏ cho cuộn dọc bàn, khu thao tác giữ ở dưới và có khoảng đệm vùng an toàn. Xoay thiết bị không tạo lại phiên hoặc reset deadline.

Kiểm thử portrait: `npm run test --workspace=@poker/e2e -- portrait`. Ma trận 320/360/390/430px cùng luồng hai trình duyệt; thử thêm trên Safari iOS/Chrome Android thật trước khi nghiệm thu trải nghiệm thiết bị.

## Nhịp chơi đồng bộ

Poker và Bài nói dối có nhịp chia bài 1,8 giây, chuyển lượt 0,45 giây và công bố kết quả theo từng bước. Backend quyết định thời gian; đồng hồ 180 giây chỉ bắt đầu khi người chơi được hành động. Trong chuyển tiếp, giao diện hiển thị lý do chờ và khóa thao tác game/quản lý. Chủ phòng vẫn xác nhận ván hoặc vòng tiếp theo.

Reload hoặc quay lại tab không chạy lại hiệu ứng đã bỏ lỡ. Chế độ giảm chuyển động giữ nguyên nhịp của bàn nhưng bỏ chuyển động trang trí. API tự build package contracts trước build, typecheck và test; không cần chạy thủ công thêm bước này.
