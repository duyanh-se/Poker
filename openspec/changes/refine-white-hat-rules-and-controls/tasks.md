# Tasks

## 1. Chuẩn bị và approval

- [x] Đọc workflow, living specs, hai change Mũ Trắng, implementation và tests liên quan.
- [x] Rà ambiguity, ngoại lệ giữa lượt, privacy, timeout, retry và quyền thao tác.
- [x] Tạo proposal/design/spec deltas/tasks với phương án mặc định cần duyệt.
- [x] Chốt ba lựa chọn còn mở và nhận approval cho bộ tài liệu cụ thể này.

## 2. Validation mô tả

- [x] Thêm regression tests thất bại cho 15/16 code point, Unicode normalization và invalid không chuyển lượt/reset timer.
- [x] Tách validator mô tả khỏi validator từ cấu hình/guess và giới hạn 1–15 ký tự.
- [x] Kiểm tra trùng nguyên mô tả toàn ván, kể cả vòng trước và người đã bị loại/bỏ cuộc.
- [x] Kiểm tra token từ dân thường trên server, giữ dấu, thông báo không echo bí mật.
- [x] Thêm bộ đếm/helper/lỗi input và validation công khai phía client; giữ phản hồi server làm quyết định cuối.

## 3. Lộ diện và cửa sổ 30 giây

- [x] Thêm tests cho canGuess mọi giai đoạn, một lần đoán và chỉ role hợp lệ.
- [x] Bổ sung đoán chủ động, chuyển actor khi tự đoán sai và giữ deadline của actor khác.
- [x] Hủy đúng vote/runoff/tie-break đang mở khi mũ trắng đoán sai, giữ lịch sử đã chốt.
- [x] Mở cửa sổ chỉ khi có người đủ quyền; cho người sống và người vừa bị vote loại cùng đoán.
- [x] Bảo toàn mũ trắng sống khi bỏ qua cửa sổ; hết quyền thì hoàn tất sớm; chỉ còn mũ trắng dùng đúng một cửa sổ cuối.
- [x] Bảo vệ reconnect, depart, stale timeout và cạnh tranh guess/vote/result bằng tests engine/service/gateway.

## 4. Kết thúc ván sớm

- [x] Bổ sung contract kết quả cancelled, không winner và lý do moderator-ended.
- [x] Thêm engine/service/facade/gateway command end-match có quyền quản trò, IDs và idempotency.
- [x] Hủy deadline/quyền hành động, công bố role/từ và giữ phòng/lịch sử; kiểm tra khởi tạo lại với bộ từ mới.
- [x] Thêm nút, dialog xác nhận và màn kết thúc trung tính không ăn mừng.
- [x] Kiểm thử khách bị từ chối, lệnh cũ/lặp, kết thúc trong last-guess và race với timeout/guess.

## 5. Chọn avatar

- [x] Bổ sung avatarId member/snapshot, mặc định theo vị trí và bảo toàn qua ván mới/reconnect/chuyển quản trò.
- [x] Thêm set-avatar command chỉ sửa chính member của session, kiểm tra integer 0…11, đúng game và controlling socket.
- [x] Thêm picker 12 nhân vật dùng assets hiện có, trạng thái lựa chọn và xác nhận.
- [x] Dùng lựa chọn đồng nhất ở board/chat/history/management; cho phép trùng avatar.
- [x] Kiểm thử broadcast, malformed input, quyền sửa, không thay turn/deadline/phiếu và avatar không phụ thuộc role.

## 6. Bố cục một màn hình và thao tác trung tâm

- [x] Chuyển desktop thành sân nhân vật hai bên và khu hành động giữa; ưu tiên mô tả/vote/đoán/phân xử theo quyền thật.
- [x] Thu gọn header/progress/private word/cấu hình mặc định; đưa chat/lịch sử/chi tiết quản trò vào bảng mở theo nhu cầu.
- [x] Làm mô tả nổi bật, hiển thị cả khi vote và ghi rõ vòng nếu dùng clue vòng trước.
- [x] Giữ input/nút/focus/keyboard/reduced motion/mobile safe area và che từ khi blur/offline.
- [x] Cập nhật fixtures cũ có clue trùng và UI/E2E tests theo luật mới.
- [x] Kiểm chứng không cuộn/cắt trên 1280×720, 1366×768, 1440×900, 1920×1080 với 4/12 người, tên dài và các stage.
- [x] Kiểm tra mobile 320/390/430px, avatar picker, dialogs, chat dài/lịch sử nhiều vòng, ảnh chụp thực tế.

## 7. Verification, review và nghiệm thu

- [x] Chạy `npm run test` và xử lý mọi failure liên quan trong scope.
- [x] Chạy `npm run lint`.
- [x] Chạy `npm run typecheck`.
- [x] Chạy `npm run build`.
- [x] Chạy `npm run format:check`.
- [x] Chạy `npm run test:e2e`, gồm hồi quy Poker/Bài nói dối.
- [x] Xác minh rồi dừng mọi verification process do lượt làm việc tạo, không dừng server của người dùng.
- [x] Cập nhật README, ghi verification thực tế và đối chiếu từng acceptance criterion/spec scenario.
- [ ] Nhận human acceptance, sau đó archive và cập nhật living specs theo workflow.
