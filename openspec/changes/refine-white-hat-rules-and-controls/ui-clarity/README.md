# Rà soát và hoàn thiện giao diện Mũ Trắng

Ngày 2026-10-28. Hoàn thiện theo phản hồi nghiệm thu trong change `refine-white-hat-rules-and-controls`.

## Kết quả trực quan

| Bề mặt           | Trước                                | Sau                                                                                      |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| Chọn nhân vật    | [Ảnh cũ](before/avatar-desktop.png)  | [Desktop](after/avatar-desktop.png), [điện thoại](after/avatar-mobile.png)               |
| Chat             | [Ảnh cũ](before/chat-desktop.png)    | [Desktop](after/chat-desktop.png), [điện thoại](after/chat-mobile.png)                   |
| Lịch sử mô tả    | [Ảnh cũ](before/history-desktop.png) | [Desktop](after/history-desktop.png), [điện thoại](after/history-mobile.png)             |
| Lịch sử bỏ phiếu | —                                    | [Desktop](after/votes-desktop.png), [điện thoại](after/votes-mobile.png)                 |
| Màn chơi         | —                                    | [Chuẩn bị ván](after/lobby-desktop.png), [đến lượt mô tả](after/description-desktop.png) |

Ảnh lấy từ ứng dụng thật bằng Playwright với phòng/người chơi kiểm thử. Desktop 1280×720, ảnh điện thoại 390×844. Luồng E2E kiểm tra thêm chiều rộng 320/430 và màn chơi 12 người ở nhiều độ phân giải desktop.

## Những lỗi đã sửa

- Header tối từ CSS bàn bài toàn cục lọt vào chat và lịch sử. Cô lập header lồng trong theme Mũ Trắng, dùng chữ ink trên nền sáng.
- Ảnh trong picker bị grid co theo nhãn số. Đặt kích thước ảnh rõ ràng, preview lớn, tên nhân vật, dấu chọn và nhãn riêng cho nhân vật đang dùng/lựa chọn chưa lưu. 12 lựa chọn cùng nút lưu vừa laptop 1280×720; trên điện thoại danh sách cuộn và nút lưu cố định.
- Nội dung chat tăng từ 12 lên 16px, tên từ 11 lên 14px, input từ 14 lên 16px. Tin của bạn ở bên phải, nền xanh, có nhãn “Bạn”; tin người khác ở bên trái, nền nhạt. Giờ gửi dùng `sentAt` thật. Giữ bản nháp và cơ chế theo dõi cuộn hiện có.
- Lịch sử dùng chữ chính 16px, tên/nhãn vòng 14px; tự mở vòng có dữ liệu mới nhất. Hai nhóm hiện có phân biệt lời mô tả, tổng phiếu, ai bầu ai và lượt lộ diện/đoán bằng nhãn rõ ràng. Không thêm metadata mà snapshot không cung cấp.
- Làm đậm viền input, giữ màu coral khi hover, tăng cỡ/độ tương phản nhãn người bị loại. Selected/focus có dấu, viền hoặc outline ngoài màu sắc.

## Audit chữ và nền

Audit trước và sau cùng đi qua 23 màn/trạng thái: chuẩn bị/cấu hình, chọn nhân vật, chat rỗng/có dữ liệu, lịch sử rỗng/mô tả/phiếu/đoán, bí mật quản trò, lượt mô tả, thảo luận, vote đã chọn, phân xử hòa, đoán cuối/chế độ xem, xác nhận đoán, kết quả, luật, quản lý và lời mời. Có biến thể desktop/mobile cho picker/chat/history.

Đo computed color, nền kế thừa và alpha, cỡ/độ đậm chữ; gồm input và placeholder. So ngưỡng trước khi làm tròn. Chữ thường dùng 4.5:1, chữ lớn dùng 3:1 theo [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Disabled và phần trang trí được tách khỏi kết quả; nền có gradient/ảnh được đánh dấu để xem trực quan, không suy ra tỷ lệ từ một màu nền phẳng. Outline/viền cần thiết được xem riêng theo [W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

| Cặp chữ/nền               | Trước  | Sau     |
| ------------------------- | ------ | ------- |
| Tiêu đề chat/lịch sử lồng | 1.08:1 | 15.29:1 |
| Nhãn đầu lịch sử          | 1.83:1 | 9.00:1  |
| Nhãn người bị loại        | 4.41:1 | 5.23:1  |

- Trước: 587 mẫu chữ, ba cặp màu trên có lỗi, xuất hiện ở nhiều màn.
- Sau: 667 mẫu chữ, không còn mẫu chữ enabled trên nền phẳng dưới ngưỡng tương ứng. Số mẫu tăng do thêm nhãn/giờ gửi và thay cách trình bày.
- Viền input `#7186a8` trên nền `#f4f8ff`: 3.47:1. Nội dung placeholder: 5.57:1.
- Dữ liệu đo: [trước](before/measurements.json), [sau](after/measurements.json). Đây là audit các màn đã liệt kê, không phải chứng nhận tuân thủ WCAG toàn bộ sản phẩm.

## Kiểm thử liên quan

Thêm ba ca component cho avatar dùng/nháp, tin của mình/giờ gửi/plain text và vòng lịch sử mới nhất/phiếu/đoán. Thêm E2E kiểm tra kích thước 12 ảnh, picker không cuộn trên laptop, focus lựa chọn cuối không bị footer che trên mobile, nút lưu/input nằm trong viewport, tương phản header/bubble, nội dung 16px, bản nháp khi đóng/mở và không tràn ngang.

Kết quả các lệnh đầy đủ và cleanup được ghi trong [verification](../verification.md). Chờ người dùng nghiệm thu trước archive.
