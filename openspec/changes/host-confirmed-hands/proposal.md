# Change: host-confirmed-hands

## Summary

Chuyển bàn chơi sang mô hình từng ván do chủ phòng xác nhận. Khi một ván đang chạy, không có thao tác quản trị hoặc cấp chip nào được thực hiện. Sau kết quả ván, bàn chờ chủ phòng bắt đầu ván tiếp theo. Giao diện phải hiển thị rõ Dealer, Small Blind và Big Blind.

## Problem / Purpose

Tự động chia ván tiếp theo và các nút quản trị trong ván làm người chơi khó theo dõi trạng thái, đồng thời cho phép thay đổi bàn trong lúc cược. Ký hiệu vị trí hiện không đủ rõ để hiểu blind và thứ tự hành động.

## Goals

- Khóa cấp chip, pause, đóng phòng, kick, chuyển chủ và rời bàn chủ động trong lúc ván chạy.
- Không tự bắt đầu ván mới; chỉ chủ phòng được bắt đầu ván kế tiếp khi bàn đang chờ.
- Hiển thị rõ D, SB và BB tại đúng ghế.

## Non-goals

- Không thay đổi luật cược, timeout, showdown, side pot, quyền bài riêng hoặc giới hạn chín ghế.
- Không thêm lịch sử ván hoặc persistence.

## Acceptance criteria

- Trong phase `running` hoặc `pause-pending`, backend từ chối mọi command quản trị và cấp chip bằng lỗi ổn định.
- Kết thúc ván chuyển sang `waiting` và giữ kết quả cho đến khi host gửi `room:start`.
- Không còn timer tự chia ván sau kết quả.
- UI không hiển thị các control quản trị khi ván chạy.
- Mỗi snapshot đang chơi có dữ liệu vị trí blind; UI hiển thị D, SB, BB ở các ghế phù hợp.
