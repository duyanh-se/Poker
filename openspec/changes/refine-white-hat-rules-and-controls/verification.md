# Verification: refine-white-hat-rules-and-controls

Ngày 2026-10-28. Đã triển khai và kiểm chứng các yêu cầu được xác nhận. Chờ người dùng nghiệm thu; chưa archive hoặc thay living specs.

## Kết quả

- Mũ trắng còn sống được lộ diện và đoán trong mọi giai đoạn. Một lần đoán, đúng thắng ngay, sai bị loại; chuyển lượt/hủy lượt vote chưa chốt đúng khi danh sách sống đổi.
- Sau vote chỉ mở 30 giây khi còn quyền đoán hợp lệ, gồm mũ trắng sống và người vừa bị vote loại. Bỏ qua cửa sổ bình thường không loại mũ trắng sống; chỉ còn mũ trắng dùng đúng một cơ hội cuối.
- Mô tả 1–15 code point sau NFKC/trim/gộp khoảng trắng, cấm trùng nguyên mô tả toàn ván và cấm token trùng từ dân thường. So sánh bỏ qua hoa/thường nhưng giữ dấu. Server từ chối không ghi lịch sử/chuyển lượt/reset deadline hoặc echo token bí mật. Từ cấu hình/đáp án đoán vẫn tối đa 80 ký tự.
- Khu thao tác desktop ở giữa, avatar hai bên; mô tả nổi bật cả khi vote và có nhãn vòng nếu dùng mô tả cũ. Chat, lịch sử, bí mật quản trò và danh sách lựa chọn dài mở trong bảng riêng; bản nháp chat giữ khi đóng/mở. Rút gọn danh sách người thắng dài; vẫn công bố đầy đủ role trên board.
- Chọn một trong 12 avatar sẵn có, cho phép trùng, chỉ sửa chính thành viên của session. Đồng bộ snapshot và giữ qua reconnect/ván mới/chuyển quản trò trong cùng phòng; không đổi turn/deadline/phiếu.
- Quản trò có xác nhận kết thúc riêng ván active. Kết quả `cancelled`, `winner: null`, không ăn mừng; công bố role/hai từ, hủy deadline/quyền đoán, giữ phòng và yêu cầu lưu bộ từ cho ván mới.

## Checks đã chạy

| Lệnh                                                     | Kết quả                                                              |
| -------------------------------------------------------- | -------------------------------------------------------------------- |
| `npm run test`                                           | PASS: 135 API + 113 web = 248 tests                                  |
| `npm run test --workspace=@poker/web -- white-hat-table` | PASS: 13 tests, chạy lại sau chỉnh sửa UI cuối                       |
| `npm run lint`                                           | PASS trên mã cuối                                                    |
| `npm run typecheck`                                      | PASS: API, web, contracts trên mã cuối                               |
| `npm run build`                                          | PASS: API, production web/standalone, contracts trên mã cuối         |
| `npm run format:check`                                   | PASS                                                                 |
| `npm run test:e2e`                                       | PASS: toàn bộ 64 tests, gồm Poker/Bài nói dối và portrait live       |
| `npm run test --workspace=@poker/e2e -- white-hat`       | PASS: 3 tests sau bổ sung kiểm tra và sửa màn phân xử hòa ở 1280×720 |

Business rules được kiểm tra theo hướng test thất bại trước khi sửa rồi chạy lại đạt. Các fixture cũ lặp một mô tả được đổi thành gợi ý khác nhau hợp lệ, không nới validator để giữ tests.

Một lượt E2E bị gián đoạn gần 8 giờ theo timestamp nhật ký và hết timeout ở ca 12 người, trong khi 63 ca còn lại đạt. Đã chạy lại liên tục toàn bộ suite và đạt 64/64. Sau đó bổ sung assert riêng cho quản trò phân xử trên laptop, tái hiện overflow, sửa bằng khối quản trò gọn và chạy lại đủ ba ca Mũ Trắng đạt. Không tăng timeout để che lỗi bố cục.

## Đối chiếu yêu cầu và ngoại lệ

| Phạm vi           | Bằng chứng                                                                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Validation        | Engine tests: 15/16 code point, emoji, NFKC, hoa/thường, khoảng trắng, trùng vòng trước, dấu và ranh giới token; UI/API thật từ cấm bị từ chối rồi sửa gửi lại được                                        |
| Quyền đoán        | Các stage, đoán đúng/sai, actor đang mô tả, vote/runoff/phân xử bị hủy đúng, quyền đoán sau vote, một cửa sổ khi chỉ còn mũ trắng, rời phòng và callback cũ                                                |
| Dừng sớm          | Service/gateway: guest bị từ chối, IDs cũ, controlling socket cũ, retry một lần, deadline vừa hết, cancel trước/sau thắng, timer dọn, phòng dùng lại được                                                  |
| Avatar            | Service/gateway/UI/E2E: integer 0…11, sai dữ liệu/quyền bị chặn, broadcast, avatar giữ sau reload/ván mới/chuyển quản trò và không phụ thuộc thông tin bí mật                                              |
| Desktop           | 1280×720, 1366×768, 1440×900, 1920×1080; 12 người tên dài, người mũ trắng vừa vote vừa có quyền đoán; assert scrollHeight và bounds thẻ/sidebar/nút thật, không scrollIntoView để qua tiêu chí desktop     |
| Stage / kết quả   | Luồng 4 người đi đủ mô tả, thảo luận, vote, bầu lại, phân xử, đoán cuối, reload và thắng; ca quản trò phân xử/chờ đoán ở 1280×720; kết thúc sớm 12 người công bố role và cấu hình ván mới vẫn vừa màn hình |
| Mobile / truy cập | 320/390/430px, bàn phím Space chọn vote, focus trả về sau dialog, Escape đóng bảng, reduced motion, không tràn ngang; chat không che input và không mất bản nháp                                           |
| Privacy / hồi quy | Snapshot vẫn lọc từ/role; từ riêng không có trong DOM khi đang che/offline; Poker/Bài nói dối giữ hành vi và qua E2E                                                                                       |

Spec compliance đã đối chiếu proposal/design/ba spec delta/tasks. Không có thay đổi dependency, migration, env, lưu trữ hoặc dịch vụ ngoài. Cửa sổ có điều kiện chủ đích thay luật chờ đồng loạt cũ; không thêm danh tính/số mũ trắng sống vào public snapshot.

## Ảnh thật của implementation

- [Vote 12 người ở 1280×720](screenshots/vote-1280x720.png)
- [Vote desktop 1920×1080](screenshots/vote-1920x1080.png)
- [Vote mobile 320px](screenshots/vote-mobile-320.png)
- [Quản trò phân xử ở 1280×720](screenshots/tie-break-1280x720.png)
- [Kết thúc sớm, công bố 12 role](screenshots/cancelled-12-players.png)

Ảnh lấy từ Playwright chạy ứng dụng thật; đã mở kiểm tra desktop, mobile và màn phân xử/kết thúc. Không dùng ảnh concept thay evidence.

## Cleanup và rollout

Playwright dùng riêng 3100/3101 và không tái sử dụng server của người dùng. Kiểm tra OS sau lượt cuối xác nhận hai cổng đều không có listener và không còn tiến trình server/Playwright kiểm thử của workspace. Không dừng server khác. Các compiler/test runner đều kết thúc; generated `next-env.d.ts` và `tsconfig.tsbuildinfo` được trả về nội dung ban đầu.

README đã cập nhật luật và thao tác. `.gitignore` chỉ thêm ngoại lệ để bộ tài liệu change này được theo dõi. Deploy API và Web cùng nhau vì contract Mũ Trắng bổ sung avatar và kết quả hủy; không cần migration hoặc biến môi trường mới. Chưa deploy lên dịch vụ ngoài.

Phần còn lại: human acceptance, sau đó archive và cập nhật living specs theo workflow.
