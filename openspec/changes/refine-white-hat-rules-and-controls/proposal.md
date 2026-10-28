# Change: refine-white-hat-rules-and-controls

## Trạng thái / Approval

Ngày 2026-10-28. Thay đổi normal, có thiết kế bổ sung vì thay luật giữa lượt và bố cục toàn màn chơi. Sau khi xem bộ đề xuất, người dùng xác nhận cả ba lựa chọn: mọi giai đoạn khi còn sống, token giữ dấu, kết thúc sớm không có phe thắng và công bố role/từ. Đã triển khai, kiểm chứng và đối chiếu spec trong phạm vi đã trình bày; xem [verification.md](verification.md). Chờ nghiệm thu trước archive.

Approval của các change `add-white-hat-game` và `redesign-white-hat-secret-party` chỉ áp dụng cho phạm vi cũ. Change này thay quy tắc chờ đồng loạt 30 giây và giới hạn giai đoạn đoán trong hai change đó. Các quy tắc dưới đây được xác nhận trong lần thay đổi này.

## Summary / Problem

Người dùng cần mũ trắng chủ động lộ diện đoán ngay, tránh chờ 30 giây vô ích khi hết quyền đoán, ngăn mô tả quá dài/lặp/lộ từ, và nhìn thấy thao tác rõ ràng trên một màn hình desktop. Người chơi cần tự chọn nhân vật; quản trò cần dừng riêng ván hiện tại mà vẫn giữ phòng.

Bằng chứng lúc bắt đầu thay đổi:

- `WhiteHatEngine.canGuess` chỉ cho mũ trắng sống đoán trong discussion/intermission. Sau vote, chỉ mũ trắng vừa bị loại có quyền đoán; engine luôn tạo cửa sổ 30 giây, kể cả không có ai được đoán.
- `describe` dùng validator văn bản chung 1–80 code point, không kiểm tra trùng lịch sử hay từ dân thường.
- Giao diện có board avatar lớn, thao tác ở sidebar, chat/lịch sử nối xuống dưới; mô tả nhỏ và bị ẩn khi vote.
- Avatar lấy theo thứ tự thành viên; chưa có lựa chọn được server lưu. Quản trò có đóng phòng/xóa dữ liệu, chưa có kết thúc riêng một ván.

## Mục tiêu và phạm vi

1. Mũ trắng còn sống và chưa dùng quyền đoán được lộ diện, gửi một đáp án ngay trong mọi giai đoạn đang chơi. Gửi đáp án mới công khai role; mở/hủy hộp xác nhận chưa công khai.
2. Sau khi chốt loại người qua vote, chỉ mở 30 giây nếu còn mũ trắng sống chưa đoán hoặc mũ trắng vừa bị vote loại còn quyền đoán cuối. Cả hai nhóm được đoán. Không có ai đủ điều kiện thì xét thắng/chuyển nghỉ vòng ngay.
3. Mô tả dài 1–15 ký tự Unicode sau chuẩn hóa, không trùng nguyên mô tả đã được chấp nhận ở bất cứ vòng nào trong cùng ván, không chứa từ riêng lẻ trùng từ trong đáp án dân thường.
4. Màn chơi desktop vừa viewport, khu hành động ở giữa, mô tả nổi trên thẻ nhân vật cả trong vote. Chat/lịch sử/chi tiết quản trò qua bảng mở theo nhu cầu.
5. Thành viên tự chọn một trong 12 avatar hiện có; mọi người thấy cùng lựa chọn, giữ qua reload/reconnect và ván mới trong cùng phòng.
6. Quản trò được xác nhận kết thúc ván sớm: không có phe thắng, công bố role/hai từ, giữ phòng và thành viên để chuẩn bị ván mới.

## Rà soát yêu cầu

| Lớp yêu cầu   | Trạng thái | Căn cứ                                                                             |
| ------------- | ---------- | ---------------------------------------------------------------------------------- |
| Mục tiêu      | Rõ         | Giảm chờ không cần thiết; hạn chế lộ/trùng mô tả; thao tác nhìn thấy ngay          |
| Người dùng    | Rõ         | Người chơi tự mô tả/vote/đoán/chọn avatar; quản trò điều hành và dừng ván          |
| Chức năng     | Đã chốt    | Giai đoạn được đoán, chuẩn so sánh tiếng Việt và kết quả khi dừng sớm              |
| Phi chức năng | Đã chốt    | Desktop từ 1280×720, tối đa 12 người; quyền server, reconnect và truy cập bàn phím |
| Chuyển đổi    | Rõ         | Dùng RAM/session/assets có sẵn; deploy API và Web cùng nhau; không migration       |

| Đã biết                                                  | Quyết định đã xác nhận                                                                         |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 15 ký tự, cấm trùng toàn ván, cấm từ trong từ dân thường | Cách xử lý dấu tiếng Việt: người dùng đã xác nhận quy tắc bên dưới                             |
| Muốn đoán ngay, chỉ chờ khi có mũ trắng                  | Có cho đoán trong description/voting/revote/tie-break: người dùng đã xác nhận quy tắc bên dưới |
| Quản trò dừng ván sớm                                    | Công bố role/từ sau dừng: người dùng đã xác nhận quy tắc bên dưới                              |

## Quy tắc và giả định đã chốt

- **Đoán chủ động:** mọi giai đoạn active, gồm description, discussion, voting, revote, tie-break, last-guess, intermission; không giới hạn vào lượt mô tả của mũ trắng. Mỗi người vẫn chỉ một lần đoán; sai bị loại, đúng thắng riêng ngay.
- **So sánh mô tả:** chuẩn hóa NFKC, bỏ khoảng trắng đầu/cuối, gộp khoảng trắng liên tiếp, không phân biệt hoa/thường, giữ dấu tiếng Việt. Độ dài đếm code point sau chuẩn hóa, gồm khoảng trắng và dấu câu; không đổi giới hạn 80 của từ cấu hình/đáp án đoán.
- **Cấm trùng:** so toàn bộ mô tả với toàn bộ mô tả cũ, kể cả của chính mình và người đã bị loại/bỏ cuộc; bỏ lượt timeout không tạo từ trùng. Không cấm lặp từng từ giữa hai mô tả khác nhau.
- **Từ dân thường:** tách từ theo chuỗi chữ/số Unicode, dấu câu và khoảng trắng là ranh giới. Với `cà phê`, `CÀ!` và `phê sữa` bị từ chối; `cá` và `càng` không bị cấm chỉ vì gần giống. Không so với từ gián điệp.
- **30 giây:** mũ trắng sống không đoán trong cửa sổ bình thường vẫn tiếp tục sống và giữ quyền đoán; người vừa bị vote loại hết 30 giây thì mất quyền đoán cuối. Khi chỉ còn mũ trắng, dùng chính cửa sổ đó làm cơ hội cuối; không ai đúng thì dân thường thắng, không cộng thêm một cửa sổ 30 giây nữa. Nếu toàn bộ quyền đoán đã dùng hoặc bị hủy do rời phòng, giải quyết cửa sổ ngay.
- **Dừng sớm:** không gán phe thắng, không chạy hiệu ứng ăn mừng; công bố đầy đủ như cuối ván, giữ lịch sử tới khi bắt đầu ván mới. Phải nhập/lưu lại hai từ cho ván sau.
- **Avatar:** chọn từ atlas 12 nhân vật hiện có, cho phép hai người chọn cùng nhân vật; thay đổi chỉ cho chính mình, kể cả trong ván và khi đã bị loại. Không upload ảnh và không lưu qua phòng khác/API restart.
- **Một màn hình:** màn chơi chính và cấu hình mặc định vừa các viewport desktop 1280×720, 1366×768, 1440×900, 1920×1080 ở zoom 100%. Bảng chat/lịch sử/quản lý có thể cuộn nội dung dài bên trong. Mobile và khi zoom lớn vẫn cuộn để giữ nội dung và cỡ chữ sử dụng được.

## Thiết kế hành vi và tương thích

Xem [design.md](design.md) và các spec delta. Giữ theme Secret Party, 12 tài nguyên nhân vật, từ riêng tự che, quyền đoán một lần, điều kiện thắng thông thường, vote kín/K/bầu lại, session và thời gian server. Chỉ điều chỉnh vote đang mở khi mũ trắng tự loại do đoán sai để không giữ phiếu/ứng viên không hợp lệ.

Việc có/bỏ cửa sổ 30 giây cho phép suy luận có còn quyền đoán mũ trắng hay không. Đây là thay đổi có chủ đích theo yêu cầu và thay quy tắc chờ đồng loạt chống suy luận cũ. Không gửi thêm role, số role còn sống hoặc từ bí mật cho người chơi.

Không thay gameplay/giao diện Poker hay Bài nói dối; không refactor ngoài phạm vi, thêm dependency, dịch vụ, tài khoản, điểm hay lưu trữ lâu dài. Contract Mũ Trắng bổ sung avatar và kết quả dừng sớm, cần cập nhật đồng thời API/Web/tests.

## Rủi ro và ngoại lệ đã rà

- Đoán sai đúng lúc đang là người mô tả phải chuyển lượt, không kẹt actor đã bị loại; nếu người khác đang mô tả thì giữ nguyên deadline của họ.
- Đoán sai giữa vote/bầu lại/phân xử phải hủy lượt bầu chưa chốt, bỏ các lựa chọn tạm và quay lại discussion với danh sách sống mới, trừ khi ván đã có kết quả/cơ hội cuối. Giữ lịch sử các đợt bầu đã công khai.
- Timeout, vote cuối, đoán đúng và dừng ván có thể đến sát nhau; chỉ lệnh hợp lệ đầu tiên theo trạng thái server có hiệu lực. Retry không lặp kết quả; timeout cũ vô hiệu sau chuyển trạng thái.
- Validator từ cấm phải chạy ở server; không gửi đáp án/tập từ cấm xuống client. Thông báo lỗi không nhắc lại từ bí mật hay token vi phạm. Việc chấp nhận/từ chối vẫn có thể tạo suy luận vốn có của luật kiểm tra này.
- Lỗi mô tả không ghi lịch sử, không chuyển lượt, không reset deadline. Đổi avatar không đổi lượt/deadline/lựa chọn vote.
- Dừng ván trong last-guess hủy quyền đoán; lệnh đoán cũ không thể tạo người thắng sau khi đã dừng.
- Nội dung chat/lịch sử nhiều vòng hoặc tên dài không được đẩy nút chính ra ngoài viewport; dialog phải giữ focus và đóng được bằng bàn phím.

## Acceptance criteria

- [x] Mũ trắng được lộ diện/đoán ngay trong mọi giai đoạn active; chỉ role hợp lệ được server chấp nhận, một lần/người.
- [x] Sau vote có quyền đoán thì đúng một cửa sổ 30 giây cho người sống và người vừa bị vote loại; không có thì bỏ qua ngay.
- [x] Timeout cửa sổ bình thường không loại mũ trắng còn sống; quyền đoán cuối và trường hợp chỉ còn mũ trắng xử lý đúng.
- [x] Mô tả 15 ký tự được nhận, 16 bị từ chối; kiểm tra Unicode, hoa/thường, khoảng trắng, lịch sử mọi vòng và token từ dân thường.
- [x] Desktop tối đa 12 người không cuộn trang, không cắt nội dung; nhập mô tả, vote/phân xử và đoán ở giữa, chọn được avatar khi vote mà không bị che.
- [x] Mô tả nổi bật trên thẻ nhân vật, vẫn đọc được khi vote và người đó đã bị loại; lịch sử ván vẫn truy cập được.
- [x] Chọn avatar đồng bộ tới mọi người, bền qua reconnect/ván mới; không sửa được avatar người khác và không lộ role.
- [x] Chỉ quản trò dừng được ván active sau xác nhận; không phe thắng, công bố role/từ, hủy deadline và vẫn dùng lại được phòng.
- [x] Tests, lint, typecheck, build, format và E2E đạt; có ảnh desktop/mobile thực tế, cleanup mọi server kiểm thử được tạo.
- [ ] Người dùng nghiệm thu, sau đó archive (spec compliance đã đạt).

## Open questions

Không còn câu hỏi mở: người dùng đã xác nhận mọi giai đoạn khi còn sống, giữ dấu, công bố đầy đủ khi dừng sớm.
