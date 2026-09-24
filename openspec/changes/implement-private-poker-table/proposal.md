# Change: implement-private-poker-table

## Summary

Triển khai phiên bản đầu của bàn Poker Texas Hold'em riêng tư theo các living specs đã phê duyệt: tạo/vào phòng bằng mã và mật khẩu, phiên khách tạm thời, điều hành phòng, cấp chip giải trí, bàn No-Limit realtime, luật showdown/side pot và giao diện tiếng Việt cho desktop cùng điện thoại ngang.

## Problem / Purpose

Repository hiện chỉ có bootstrap gồm trang tĩnh, health check và Socket.IO transport không có event. Người dùng chưa thể tạo phòng, mời bạn, nhận chip, chơi một ván hoặc xem trạng thái bàn. Cần hiện thực các quy tắc đã được chốt trong `session-access`, `rooms`, `chips`, `poker`, `realtime` và `table-experience`.

## Goals

- Cung cấp luồng tạo phòng và tham gia phòng kín bằng tên hiển thị, mã phòng và mật khẩu.
- Giữ toàn bộ room, session, seat, chip và hand trong RAM của một API process.
- Cung cấp quyền host, cấp chip, pause/resume, kick, chuyển host, rời và đóng phòng.
- Triển khai luật No-Limit Texas Hold'em cho 2–9 người: blind/ante, vòng cược, all-in, side pot, showdown, chip lẻ và heads-up.
- Đồng bộ realtime bằng Socket.IO snapshots đã lọc thông tin riêng, deadline lượt và xử lý reconnect/idempotency.
- Xây dựng giao diện tiếng Việt có bàn chơi, điều khiển hợp lệ, giấu bài, trợ giúp tổ hợp, animation không chặn thao tác, hỗ trợ desktop và điện thoại ngang.
- Thêm kiểm thử domain, integration, UI và E2E để chứng minh các quy tắc observable trong living specs.

## Non-Goals

- Không có tài khoản lâu dài, lịch sử ván, database, Prisma, migration hoặc khôi phục sau restart.
- Không có tiền thật, nạp/rút, mua bán chip, giải đấu, bot, gợi ý chiến thuật, odds hoặc mô phỏng xác suất.
- Không có voice/video, quản trị doanh nghiệp, danh sách phòng công khai hay chia sẻ danh tính giữa thiết bị.
- Không thêm worker, Redis, message broker, microservice, external analytics hay storage.

## User / Business Impact

Người chơi có thể mở một bàn kín trong lớp, công ty hoặc nhóm bạn, mời tối đa tám người khác và chơi liên tục trong trình duyệt. Chủ phòng điều hành đúng phạm vi đã duyệt. Restart API hoặc đóng phòng xóa toàn bộ phiên; đây là hành vi sản phẩm có chủ đích và được hiển thị rõ trong UI.

## Proposed Change

Backend trở thành nguồn quyết định duy nhất của game state. HTTP chỉ xử lý tạo/vào phòng và khôi phục phiên; Socket.IO nhận command đã xác thực, kiểm tra quyền và phát snapshot lọc theo người nhận. Luật poker là domain TypeScript thuần không phụ thuộc NestJS hay Socket.IO. Frontend dùng Next.js, Zustand và `socket.io-client` để hiển thị snapshot, gửi ý định và giữ các preference UI cục bộ.

## Compatibility

- Existing behavior preserved: `GET /health`, Swagger, Docker topology và RAM-only deployment giữ nguyên.
- Breaking change: Socket.IO gateway không còn là transport trống; client mới giao tiếp tại namespace game bằng contract được mô tả trong design.
- Migration requirements: none. Chưa có dữ liệu game hoặc public client cần migrate.

## Assumptions

- Mã phòng dùng tám ký tự base32 dễ đọc và mật khẩu lời mời dùng mười sáu ký tự ngẫu nhiên; mật khẩu chỉ được trả khi tạo phòng và được lưu hash trong RAM.
- Tên hiển thị dài 1–24 ký tự sau trim, chuẩn hóa Unicode và so sánh không phân biệt hoa/thường trong một phòng.
- Không có spectator: một người vào phòng luôn nhận ghế trống hoặc bị từ chối khi đã đủ chín ghế.
- Session là cookie opaque ngẫu nhiên, `HttpOnly`, `SameSite=Lax`, chỉ `Secure` ở production; mất cookie đồng nghĩa mất khả năng lấy lại ghế.
- `socket.io-client@4.8.1` là dependency runtime mới duy nhất cần thiết cho web; hashing/password và random sử dụng Node.js `crypto`.
- Tám giây hiển thị kết quả được điều phối bằng timer backend; người chơi mới chỉ tham gia từ ván sau.

## Risks

- Engine No-Limit có nhiều tình huống biên về quyền raise, side pot, chip lẻ và thay đổi heads-up; giảm rủi ro bằng pure domain tests và integration tests nhiều client.
- Một process RAM-only sẽ mất tất cả room khi restart; UI và README phải nêu rõ giới hạn này.
- Cookie/session và Socket.IO có thể làm lộ quyền ghế nếu kiểm tra origin, member và private snapshot thiếu chặt chẽ; mọi command phải được backend xác thực.
- UX chín ghế trên điện thoại ngang có thể quá chật; cần test viewport và ưu tiên thông tin của người chơi hiện tại.
- Trong giới hạn hiện tại, nickname và mật khẩu không ngăn thông đồng hoặc người bị kick quay lại bằng một browser session mới nếu vẫn biết lời mời.

## Acceptance Criteria

- [ ] Một người tạo phòng với cấu hình blind/ante hợp lệ, nhận mã/mật khẩu và tự trở thành host có ghế.
- [ ] Người khác chỉ vào được bằng mã, mật khẩu và tên chưa trùng; không có room listing hoặc private-card leak.
- [ ] Host có thể cấp chip, bắt đầu/pause/resume, kick, chuyển host và đóng phòng theo quyền và timing trong specs.
- [ ] Bàn chơi ván No-Limit 2–9 người đúng rules về vị trí, betting, timeout, disconnect, all-in, side pot, showdown, ties và odd chips.
- [ ] Command lặp/cũ không áp dụng hai lần; reconnect nhận snapshot hiện tại đã lọc.
- [ ] UI tiếng Việt cho phép tạo/vào phòng, chơi, giấu bài, đọc tổ hợp/rules và hoạt động ở desktop/điện thoại ngang.
- [ ] API restart hoặc room close làm room biến mất và client nhận được thông báo phù hợp.
- [ ] Unit, integration, frontend, E2E, lint, typecheck và build pass; Docker runtime routing được kiểm tra nếu Docker daemon có sẵn.
