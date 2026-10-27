# Design: Secret Party cho Mũ Trắng

## Design read và audit

Đọc brief là một cuộc thay mới hoàn toàn giao diện party game dành cho nhóm bạn, theo ngôn ngữ đồ chơi có chiều sâu và nhân vật hoạt hình. Dials: variance 8, motion 6, density 5. Áp dụng phần audit/overhaul của design-taste-frontend; không áp dụng bố cục landing page/marketing cho luồng chơi nhiều bước. ui-ux-pro-max có kết quả phù hợp ở style Tactile Digital / Deformable UI; bỏ kết quả landing/brutalism không phù hợp.

Hiện tại: nền #0b1114, surface #141e23, gold #e6be77, font hệ thống Segoe UI, nhiều card khung viền giống nhau, avatar chữ cái, điều khiển checkbox dạng form và hai cột board/sidebar. Chat/dialog dùng style chung của bàn bài. Logic gameplay, nhãn thao tác tiếng Việt, focus dialog và che từ đang hoạt động tốt.

Loại bỏ toàn bộ ngôn ngữ hình ảnh đó trong Mũ Trắng. Giữ hành động, quyền, nhãn form, dữ liệu và semantics truy cập; bố cục và assets mới được xây riêng. Không đổi URL hoặc thiết kế của game khác.

## Hệ thống hình ảnh đã chọn

| Token                   | Giá trị               |
| ----------------------- | --------------------- |
| Backdrop                | #EAF1FF               |
| Surface                 | #FDFEFF               |
| Primary / primary text  | #2855F8 / #FFFFFF     |
| Ink / secondary ink     | #182343 / #526581     |
| Coral accent            | #FF7750, dùng chữ ink |
| Sunny accent            | #FFD75E, dùng chữ ink |
| Border                  | #C6D8F4               |
| Public connected status | #168A50, kèm nhãn chữ |

Font mới: Nunito Sans tự host, Latin/Vietnamese, weight 400–900; tiêu đề 800–900, thân bài 400–600, tối thiểu 16px cho input. Fallback sans-serif khi font chưa tải. Không dùng font hiện tại làm font chính. Surface bo 24px, card nhân vật 20px, input 14px, nút bo 16–20px; đổ bóng xanh nhẹ và cạnh dưới nút 4px để tạo cảm giác nhấn. Focus có viền rõ, không chỉ dựa vào màu.

Assets cục bộ: mascot mũ trắng trung tính và atlas 12 avatar nhân vật không mang dấu hiệu phe, tạo bằng imagegen theo concept. Nền trời/mây dựng bằng hình học CSS đơn giản. Chọn avatar ổn định từ thứ tự thành viên công khai, tuyệt đối không dùng role/word/khả năng đoán để chọn hình hoặc màu. Lưu trong public/white-hat; đặt kích thước trước để không nhảy layout. Icon UI dùng ký hiệu/hình học đơn giản; không cài thư viện mới. Không hiển thị ảnh mockup nguyên tấm như giao diện sản phẩm.

## Bố cục theo giai đoạn

| Giai đoạn               | Hiển thị mới                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lobby                   | Banner party với mascot, đội hình avatar và chỗ trống cho khách; quản trò có bảng chuẩn bị sáng với hai từ, role, K và nút lưu/bắt đầu rõ ràng. Người chơi thấy trạng thái chờ quản trò.      |
| Mô tả                   | Nhân vật đến lượt được spotlight và nhãn “Lượt của bạn”/tên người đang mô tả; ô nhập là khu hành động chính, các mô tả trước hiện thành bong bóng có tên.                                     |
| Thảo luận               | Board giữ các nhân vật và lời mô tả, hướng dẫn ngắn; quản trò có nút mở vote, mũ trắng có thao tác đoán đúng như quyền hiện có.                                                               |
| Vote / bầu lại          | Card nhân vật chọn được, checkbox ẩn về thị giác nhưng còn trong accessibility tree, dấu chọn nổi, bộ đếm chọn K và số người đã gửi; tự khóa phiếu sau gửi. Bầu lại chỉ hiện ứng viên hợp lệ. |
| Quản trò phân xử        | Nhóm hòa được làm nổi, các suất đã chốt là badge riêng; chọn đúng số suất còn lại, nhãn nút giữ “Chốt người bị loại”.                                                                         |
| Đoán cuối               | Countdown 30 giây nổi bật cho tất cả, panel đoán chỉ hiện cho người có quyền; không đổi nội dung/trang trí dựa trên role bị loại chưa công khai.                                              |
| Kết quả vòng            | Trạng thái bị loại bằng nhãn và thẻ giảm nhấn mạnh; phiếu đã chốt mở thành kết quả dễ đọc, vẫn giấu role. Quản trò có nút vòng tiếp, mũ trắng còn sống có quyền đoán nếu hợp lệ.              |
| Kết thúc                | Bảng chiến thắng với nhân vật/mascot và tên người/phe thắng thật; công bố hai từ và role theo snapshot, hiệu ứng confetti ngắn duy nhất. Chuẩn bị ván mới vẫn cần lưu bộ từ mới.              |
| Người bị loại / offline | Trạng thái rõ ràng, vẫn đọc được board/lịch sử; chat/hành động khóa đúng quyền. Offline không làm lộ từ hoặc reset deadline.                                                                  |

Thanh vòng có bốn mốc Mô tả → Thảo luận → Bỏ phiếu → Kết quả. Map description vào mốc 1; discussion vào 2; voting/revote/tie-break vào 3; last-guess/intermission/finished vào 4. Lobby là chuẩn bị trước thanh. Hiển thị roundNumber thật, không tạo điểm hoặc cấp độ.

Desktop: header thương hiệu và menu gọn, board 4 cột cho 4 hoặc từ 8 người, 3 cột cho nhóm trung gian, sidebar hành động/chat và lịch sử theo vòng gấp mở. Mobile 320–430px: header gọn, progress rút ngắn, board 2 cột ở 320px hoặc nhóm 4 người, tối đa 3 cột khi đủ chỗ. Tên dài xuống dòng; khu nhập mô tả/đoán được ưu tiên trước board. Nút xác nhận vote ở action dock có safe-area và khoảng đệm; xác nhận đoán ở dialog gọn theo nội dung, dạng bottom sheet trên điện thoại. Không thu nhỏ nguyên desktop xuống điện thoại.

## Chuyển động và độ chính xác

Press 120–180ms, chọn card 180–240ms, chuyển giai đoạn/spotlight 240–360ms, công bố kết quả tối đa 3 giây. Ưu tiên transform/opacity và CSS, không thêm thư viện animation. Không khóa điều khiển để chờ hiệu ứng. Không loop trang trí vô hạn, không tự bật âm thanh.

Hiệu ứng phụ thuộc stage/round/result và cờ live update có sẵn; reload/reconnect render trạng thái hiện tại, không phát lại chia từ hoặc ăn mừng cũ. prefers-reduced-motion bỏ chuyển động/bật nảy/confetti và giữ đủ trạng thái bằng chữ/viền. Đồng hồ dựa serverTime/deadlineAt hiện có, không có timer gameplay mới.

## Ranh giới triển khai

- Viết lại lớp markup/bố cục và CSS của feature white-hat, dùng namespace/token --wh-\* độc lập. Không dùng var(--bg), var(--surface), var(--gold) của bàn bài.
- Bọc toàn màn hình bằng nền sáng min-height 100dvh; kiểm soát font, nút, input, label, details, focus và backdrop trong phạm vi Mũ Trắng để CSS chung không lọt vào theme.
- Tách component trình bày: brand/mascot, progress, avatar board, secret card, actions, history/results và chat. Tái sử dụng session/store, quyền pháp lý của thao tác, server clock và focus management dialog; chat/dialog có style riêng hoàn chỉnh.
- Giữ nguyên event/payload/ID lệnh, nhãn form và accessible names của hành động chính để không làm đổi gameplay hoặc khả năng thao tác hiện có.
- Không thay public API, contracts, backend, deadline, luật hay dữ liệu lưu trữ. Không thêm tracking, điểm số hoặc phần thưởng.

## Kiểm chứng

Giữ và cập nhật kiểm thử privacy, K phiếu, đoán một lần/xác nhận, khóa offline và cấu hình quản trò. Mở rộng E2E chụp lobby, mô tả, vote, đoán cuối, kết quả và dialog ở 320/390/430/1280/1440px; kiểm tra 12 người/tên dài, bàn phím, reduced motion, reload và che từ khi blur. Kiểm tra contrast button/text và không tràn ngang. Chạy toàn bộ tests/lint/typecheck/build/format/E2E, kiểm tra ảnh thật và dừng đúng server kiểm thử.
