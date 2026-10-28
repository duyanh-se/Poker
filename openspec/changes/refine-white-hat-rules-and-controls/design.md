# Design: refine-white-hat-rules-and-controls

## Context và quyết định

Giữ Nest/Next/React/Socket.IO/Zustand, RAM-only và engine độc lập transport. Phạm vi nằm trong WhiteHat engine/service, routing realtime hiện có, contract Mũ Trắng và lớp hiển thị WhiteHat. Không tạo hệ thống avatar chung cho ba game, không thay kiến trúc.

Đã đọc `AI_PROJECT_WORKFLOW.md`, living specs rooms/realtime/table-experience, hai change Mũ Trắng hiện có, engine/service/gateway/contracts, controls/table/pieces/CSS và tests tương ứng. Các living specs chưa có capability white-hat; dùng change đã triển khai và kiểm chứng làm căn cứ, không archive thay người dùng.

## Mô tả và validation

Tách validation mô tả khỏi `whiteHatText` đang dùng cho cả cấu hình và guess. Dùng cùng normalization NFKC/trim/gộp whitespace; giới hạn riêng 1–15 code point. Chuẩn so sánh dùng `wordKey` hiện có, giữ dấu. Tách token bằng chữ/số Unicode sau normalization, dấu câu là ranh giới.

Trình tự tại engine: xác minh actor/lượt → văn bản và độ dài → trùng nguyên mô tả ở mọi vòng → giao token với từ dân thường → ghi mô tả → chuyển lượt. Chỉ so những bản ghi `text !== null`; lịch sử mới khởi tạo khi ván mới bắt đầu. Nếu bất kỳ bước nào lỗi, không mutate state/deadline.

Client có bộ đếm 0/15, helper và lỗi gần input; kiểm tra độ dài và trùng lịch sử công khai trước khi gửi để phản hồi sớm. Kiểm tra token từ dân thường chỉ tại server. Không đưa civilianWord hay token cấm vào snapshot của người không có quyền; lỗi loại này chung, không echo token. Phản hồi server vẫn là nguồn quyết định cuối cùng. Không áp HTML maxLength=15 như nguồn duy nhất vì UTF-16 khác code point.

## Đoán chủ động và state machine

`canGuess` cho participant không departed, role white-hat, chưa guessed, ván active, nếu còn sống ở mọi stage hoặc thuộc tập quyền đoán cuối vừa nhận. Không thêm bước lộ role riêng: xác nhận gửi guess đồng thời tiêu quyền và công khai role. Đúng → finish như hiện tại. Sai → chết và điều hòa lại stage:

| Stage khi sai                       | Kết quả nếu chưa kết thúc                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| description, chính người đang mô tả | Bỏ lượt người đó, chuyển người sống kế tiếp; không tạo mô tả giả                                           |
| description, người khác đang mô tả  | Giữ actor, turnId và deadline hiện tại                                                                     |
| voting/revote/tie-break             | Hủy ballot đang mở, candidate/selected tạm; về discussion, quản trò mở vote mới với K hợp lệ               |
| discussion/intermission             | Giữ stage và xét điều kiện thắng hiện có                                                                   |
| last-guess                          | Xóa quyền đoán đã dùng; giữ deadline chung cho người còn quyền, giải quyết ngay nếu hết người đủ điều kiện |

Khi có người rời phòng áp dụng cùng nguyên tắc bảo toàn quyền của người khác, đồng thời thu hồi quyền của người rời. Không trì hoãn snapshot để chạy hiệu ứng.

## Cửa sổ sau vote

Sau khi loại đồng thời, tập ứng viên đoán gồm mũ trắng còn sống chưa đoán và mũ trắng vừa bị vote loại chưa đoán/chưa departed. Nếu tập rỗng: không tạo timer, chuyển intermission rồi xét thắng ngay. Nếu có: tạo một deadline tuyệt đối now+30s, hoãn thắng theo phe tới khi giải quyết quyền đoán.

Phân biệt hai loại quyền: sống có thể bỏ qua và tiếp tục chơi; vừa bị vote loại chỉ giữ quyền đến hết cửa sổ. Timeout không đặt alive=false/guessed=true cho mũ trắng sống ở cửa sổ bình thường. Khi chỉ còn mũ trắng và không có đáp án đúng, kết thúc trao thắng cho dân thường sau chính cửa sổ hiện tại; không mở thêm cửa sổ thứ hai.

Nếu mọi quyền đã dùng/bị thu hồi, hoàn tất sớm. Đoán đúng và dừng sớm đều đóng cửa sổ ngay. Reconnect không đổi deadline. Không đưa danh sách hoặc số người đủ điều kiện vào snapshot công khai; gửi `canGuess` riêng từng viewer. UI chỉ ghi chung đang chờ quyết định đoán, không định danh người chưa lộ diện.

## Kết thúc sớm và contract

Thêm `white-hat:end-match` với commandId và action IDs hiện hành. Room service xác minh session/controlling socket/quản trò và ván active; engine chuyển finished với kết quả hủy do quản trò, không winner. Bổ sung loại kết quả `cancelled` vào contract (giữ các kết quả thắng hiện có, cập nhật tất cả consumers WhiteHat). WinnerMemberIds rỗng và có lý do `moderator-ended`; không bịa một role làm người thắng.

Lệnh cần match/round/turn hiện hành để chống tác động vào ván khác; không bị khóa chỉ vì deadline của một lượt vừa hết nếu giai đoạn vẫn còn hiện hành. Thứ tự thực thi server quyết định khi cạnh tranh với timeout/guess. Đã finished thì không áp dụng lại; gateway giữ idempotency cho retry thành công. `enter('finished')` đổi turn và bỏ deadline/actor, gateway bỏ timer; callback cũ chỉ no-op.

Snapshot finished công bố hai từ và roles, trả chat/quản lý giữa các ván như flow hiện có, giữ lịch sử. Từ chuẩn bị vẫn trống, quản trò phải cấu hình mới. Giao diện có nút “Kết thúc ván” riêng với “Đóng phòng”, chỉ quản trò thấy khi active. Dialog xác nhận nêu không ai thắng, công bố role/từ, giữ phòng; chỉ gửi sau xác nhận. Màn kết thúc dùng trạng thái trung tính và không confetti.

## Avatar và realtime

Thêm `avatarId` số nguyên 0…11 vào member WhiteHat và public player snapshot. Khởi tạo theo vị trí người chơi để giữ mặc định 12 nhân vật khác nhau. Avatar không thuộc engine/role; giữ ở member nên không đổi khi ván mới bắt đầu hoặc chuyển quản trò.

Thêm `white-hat:set-avatar` nhận commandId và avatarId. Chỉ lấy member từ session, không nhận target memberId; xác minh đúng game, giá trị nguyên trong danh mục và session đang điều khiển. Đổi avatar hợp lệ tăng version, broadcast snapshot, không thay match/round/turn/deadline/vote. Cho phép trong lobby, ván active, khi bị loại và sau finish. Mọi lần render board/chat/history/management dùng cùng avatarId; tạm fallback theo vị trí cho fixture/client chưa có trường.

Picker 12 nút có tên truy cập được, trạng thái selected và nút xác nhận. Có nút “Chọn nhân vật” của chính mình, không biến click chọn avatar trong vote thành mở picker. Không thêm tài nguyên ảnh hay dependency. Trùng avatar được phép; định danh vẫn bằng memberId/tên.

## Bố cục và hierarchy

Giữ hệ màu, Nunito Sans, mascot và atlas Secret Party. Audit hiện tại cho thấy avatar vuông lớn, sidebar dài và mô tả 12px gây cuộn; sửa tỷ lệ và vị trí, không thay toàn bộ ngôn ngữ hình ảnh.

Desktop >=1280px, chiều cao >=720px: shell theo viewport `100dvh`, header/progress gọn, vùng chơi chia cột trái – trung tâm – phải. Các thẻ nhân vật bố trí hai bên; với 12 người mỗi bên 2 cột × 3 hàng. Trung tâm ưu tiên clock/hướng dẫn/người cần thao tác, từ riêng gọn và form đang hợp lệ. Vote vẫn chọn trực tiếp trên thẻ, trạng thái K và xác nhận nằm giữa; không mở modal chặn board khi đang chọn.

| Vùng                 | Nội dung                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| Header               | Thương hiệu gọn, mã phòng, chọn nhân vật, chat, lịch sử, luật, quản lý                       |
| Tiến trình           | Vòng/giai đoạn và trạng thái kết nối ngắn                                                    |
| Hai bên              | Tên, avatar vừa đủ, trạng thái, mô tả nổi bật và checkbox vote                               |
| Giữa                 | Countdown, hành động chính của viewer; quản trò có cấu hình/chuyển giai đoạn/phân xử phù hợp |
| Bảng mở theo nhu cầu | Chat, lịch sử đầy đủ, role/từ của quản trò và quản lý phòng                                  |

Mô tả dùng surface có tương phản, 16–18px/đậm, đủ hai dòng cho 15 ký tự; tên và trạng thái có hierarchy thấp hơn. Hiện mô tả mới nhất của người đó trong ván cùng nhãn vòng khi là vòng trước; full history vẫn giữ toàn bộ bản ghi, timeout ghi nhãn bỏ lượt. Trong vote/bầu lại vẫn hiện mô tả; không làm thẻ mờ tới mức khó đọc khi bị loại. Không hiển thị clue bằng pseudo-content hoặc tooltip duy nhất.

Khi viewer có hai quyền đồng thời (mô tả/vote và đoán mũ trắng), hành động stage là chính; nút “Lộ diện và đoán” rõ ở trung tâm mở form/dialog đoán, không ép hai form dài cùng cột. Nút này luôn truy cập được khi `canGuess`, không chờ đến khoảng nghỉ.

Không giấu overflow để che lỗi. Thu gọn nội dung phụ, khoảng cách và avatar theo chiều cao; test bounding box thực của tất cả thẻ/nút. Desktop không có page scroll hoặc scroll vùng chơi chính ở các kích thước đã nêu. Bảng nội dung dài có scroll riêng, đóng được bằng Escape, focus trap/return focus dùng `Panel`. Ở chiều cao/chiều rộng thấp hơn hoặc zoom lớn, cho cuộn thích ứng. Mobile giữ input >=16px, nút >=44px, safe area, focus không bị dock che và không tràn ngang.

Đã tra ui-ux-pro-max: kết quả phù hợp về visible focus/focus không bị overlay che và React dialog focus/controlled form. Kết quả tìm visual hierarchy ban đầu không phù hợp nên không áp dụng như căn cứ thiết kế; dùng audit thực tế và yêu cầu người dùng cho vị trí trung tâm.

## Kiểm chứng và rollout

### Phản hồi nghiệm thu giao diện, 2026-10-28

Người dùng yêu cầu rà toàn bộ màu chữ/nền Mũ Trắng, làm phần chọn nhân vật đẹp/rõ hơn và chat/lịch sử dễ đọc hơn. Đây là hoàn thiện các bề mặt đã được duyệt trong change hiện tại, gồm yêu cầu Secret Party sáng, avatar đủ quan sát và toàn bộ dialog được cô lập khỏi theme bàn bài. Không mở rộng luật, API, dữ liệu hay tính năng ngoài phạm vi đó.

Audit ứng dụng thật ở 23 màn/trạng thái, 587 mẫu chữ cho thấy `.panel header` toàn cục áp nền `#152024` vào header lồng của chat/history, khiến chữ ink chỉ có tương phản khoảng 1.08:1. Bộ chọn avatar bị track grid co theo nhãn số vì kế thừa `justify-content:center`, làm hình thu rất nhỏ. Chat dùng nội dung 12px/tên 11px/input 14px; trạng thái người bị loại đạt khoảng 4.41:1, dưới mục tiêu chữ thường 4.5:1.

Hướng sửa: cô lập header lồng và token nền/chữ trong Mũ Trắng, giữ cobalt/ink và nền sáng; làm nhãn phụ dễ đọc, giữ focus/selected/disabled có nghĩa rõ. Avatar picker có preview lớn, tên hiển thị “Nhân vật 01…12”, dấu chọn + trạng thái “Đang dùng/Đang chọn”, tile kích thước tường minh, grid thích ứng và nút lưu luôn dễ tìm. Chat tăng nội dung/input lên 16px, tên 14px, phân biệt tin của mình/người khác và dùng `sentAt` có sẵn; bỏ header tối/khung lồng gây nhiễu, giữ bản nháp và logic đọc/cuộn hiện có. Lịch sử giữ hai nhóm hiện có, làm rõ vòng, tác giả, mô tả, tổng phiếu/ai bầu ai và lượt đoán thành các khu có nhãn riêng; chữ chính 16px, metadata 14px. Không thêm timestamp/vòng cho guess khi snapshot không cung cấp.

Kiểm chứng lại ảnh và computed colors ở các bề mặt lobby/config, mô tả, discussion, vote/revote/tie-break, last-guess/read-only, finish, picker, chat/history rỗng/có dữ liệu, bí mật quản trò, luật, quản lý và lời mời. Kiểm tra normal/hover/focus/selected/disabled, desktop 1280×720 và mobile 320/390/430; giữ nguyên tiêu chí màn chơi desktop không cuộn. So sánh màu theo [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) và [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html), không coi màu disabled hoặc đồ trang trí là lỗi chữ bắt buộc.

TDD cho luật: mô tả Unicode 15/16, trùng khác hoa/khoảng trắng/NFKC/toàn ván, token có dấu/câu/ranh giới, invalid không mutate; đoán ở mọi stage, vote sai hủy đúng và actor sai chuyển đúng; cửa sổ có/không quyền, timeout không giết người sống, chỉ mũ trắng không chờ hai lần; dừng trước/sau deadline và đua kết quả.

Service/gateway kiểm tra lọc bí mật, các quyền chủ/khách, stale/retry/expired socket, avatar malformed/self-only/đồng bộ/không đổi deadline và room reuse sau cancel. Sửa fixture cũ gửi lặp cùng mô tả: tạo clue khác nhau hợp lệ, không nới rule để giữ tests.

UI/E2E chạy 4 và 12 người: mô tả/vote/đoán/cancel/avatar/reload/keyboard, 1280×720/1366×768/1440×900/1920×1080 và mobile 320/390/430px. Assert cả scrollHeight và vị trí thực của nút/thẻ; không dùng scrollIntoView để làm qua tiêu chí desktop. Chụp/xem ảnh thực tế. Chạy toàn bộ checks và hồi quy hai game còn lại; Playwright dùng 3100/3101, xác minh/dừng đúng tiến trình workspace đã tạo. Deploy API/Web cùng nhau, không migration/env mới. Chờ nghiệm thu trước archive.
