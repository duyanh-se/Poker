# Poker Texas Hold'em — Project Discovery

## Project summary

Ứng dụng web chơi No-Limit Texas Hold'em trực tuyến cho nhóm bạn, lớp học hoặc nội bộ công ty. Mỗi phòng là một bàn riêng tối đa chín người; chip chỉ phục vụ giải trí và toàn bộ dữ liệu chỉ tồn tại trong phiên backend đang chạy.

Người chơi vào bằng tên hiển thị, mã phòng và mật khẩu. Chủ phòng cũng là người chơi và quản lý chip, pause, kick, chuyển chủ hoặc đóng phòng.

## Scope đã chốt

- Bàn chơi liên tục, 2–9 người, No-Limit Texas Hold'em.
- Blind và ante đặt khi tạo phòng, giữ cố định đến khi đóng phòng.
- Chỉ chủ phòng cấp chip; không giới hạn số chip hay số lần cấp.
- Thời gian mỗi lượt tối đa 180 giây.
- Giao diện tiếng Việt cho desktop và điện thoại ngang, có animation và chế độ che bài.
- Hiển thị thứ hạng bài, tổ hợp hiện tại và giải thích showdown.

## Ngoài phạm vi

- Tiền thật, thanh toán, nạp/rút hoặc đổi chip.
- Tài khoản, lịch sử lâu dài, khôi phục phòng sau restart, tournament, bot và gợi ý chiến thuật/xác suất.
- Voice/video, ứng dụng native và quản trị doanh nghiệp.

## Rủi ro được chấp nhận

Restart backend, đóng phòng hoặc chủ rời mà chưa chuyển quyền sẽ xóa dữ liệu phiên. Nickname chỉ là danh tính trong phiên và không ngăn thông đồng ngoài hệ thống.
