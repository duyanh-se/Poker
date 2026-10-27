# Verification: Secret Party

Ngày 2026-10-27. Concept đã được người dùng duyệt; giao diện đã triển khai và kiểm chứng. Chờ nghiệm thu, chưa archive.

## Đã thay đổi

Thay hoàn toàn lớp hiển thị Mũ Trắng bằng Secret Party: nền trời sáng, cobalt/coral, typography Nunito Sans cục bộ, mascot và 12 avatar 3D trung tính, sân chọn nhân vật, progress vòng, đồng hồ server, hồ sơ từ bí mật, chat, quản trò, lịch sử, dialog và màn thắng. Avatar lấy theo thứ tự thành viên công khai, không theo role. Các theme/token cũ không được dùng trong feature; màu chữ phụ và scrollbar được cô lập để không kế thừa theme bàn bài.

Nút vote di động có action dock, tên dài xuống dòng; mô tả/đoán ưu tiên ô nhập. Dialog gọn theo nội dung, dạng bottom sheet trên mobile. Giữ nguyên luật, snapshot, sự kiện lệnh, deadline, quyền, reconnect và backend. Poker/Bài nói dối và trang vào phòng chung giữ giao diện cũ. Không thêm dependency hoặc điểm/XP/phần thưởng.

## Checks đã chạy

| Lệnh                                               | Kết quả                                        |
| -------------------------------------------------- | ---------------------------------------------- |
| `npm run test`                                     | PASS: 115 API + 108 web = 223 tests            |
| `npm run lint`                                     | PASS, không còn warning                        |
| `npm run typecheck`                                | PASS: API, web, contracts                      |
| `npm run build`                                    | PASS: API, contracts, production web           |
| `npm run build --workspace=@poker/web`             | PASS sau chỉnh CSS/dialog cuối                 |
| `npm run format:check`                             | PASS                                           |
| `npm run test:e2e`                                 | PASS: toàn bộ 63 tests                         |
| `npm run test --workspace=@poker/e2e -- white-hat` | PASS: 2 tests sau chỉnh tương phản/dialog cuối |

Ba test mới bổ sung bảo vệ việc reset lựa chọn khi bầu lại, avatar không đổi theo thông tin riêng và không phát lại thắng sau restore. Test trình duyệt mới chạy 1 quản trò + 12 phiên người chơi thật với tên dài, 12 avatar khác nhau, mô tả/vote thực, chọn bằng Space, reduced motion, không tràn ngang/chồng thẻ, nút chạm >=44px và chat không bị dock che.

Luồng bốn người chạy đủ cấu hình, mô tả, vote, bầu lại, phân xử, quyền đoán cuối, reload giữ deadline, xác nhận đoán và công bố người thắng. Kiểm tra các viewport 320/360/390/430/1280/1440px; xem ảnh lobby, mô tả, vote, đoán cuối, dialog, luật và kết quả. Các ca hồi quy Poker/Bài nói dối cũng đạt.

Kiểm tra tương phản: chữ trắng trên nút cobalt 5.61:1; chữ ink trên coral 5.89:1; chữ phụ trên surface 5.88:1. Font tiếng Việt/Latin lưu local; PNG có alpha thật. Bản standalone có đủ ảnh/font và smoke test HTTP trên cổng 3102 đã xác minh checksum 4 tài nguyên, cùng Next Image trả WebP tối ưu thành công (118,648 bytes cho atlas ở w=640).

## Ảnh giao diện thực tế

Các ảnh dưới đây chụp từ giao diện đã triển khai bằng Playwright, không phải ảnh concept:

- [Vote desktop](screenshots/vote-desktop.png)
- [Vote mobile 320px](screenshots/vote-mobile.png)
- [Lobby quản trò](screenshots/lobby-desktop.png)
- [Đủ 12 người chơi](screenshots/twelve-players.png)
- [Dialog xác nhận đoán](screenshots/guess-dialog.png)
- [Màn chiến thắng](screenshots/victory-desktop.png)

[Tài nguyên được lưu và prompt imagegen chính xác](production-assets.md). Tất cả ảnh production được tạo bằng built-in imagegen rồi lưu trong workspace; không dùng fallback CLI. Ảnh concept chỉ dùng tham chiếu thiết kế.

## Cleanup / nghiệm thu

API/Web E2E dùng riêng cổng 3100/3101. Production smoke dùng tiến trình Node sở hữu trực tiếp trên 3102 và dừng trong finally. Kiểm tra hệ điều hành sau cùng xác nhận cả 3100/3101/3102 đều trống. Server phát triển hiện có trên 3000 được giữ nguyên, không dừng. Generated next-env.d.ts và tsconfig.tsbuildinfo được trả về bản gốc, không đưa build metadata vào thay đổi.

Spec compliance đã rà với proposal/design/spec delta và các test trên. Còn nghiệm thu của người dùng trước khi archive và cập nhật living specs; không còn blocker triển khai hoặc kiểm chứng được biết.
