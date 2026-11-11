# Image Text Checker — MVP

## Chạy ứng dụng
1. Giải nén thư mục.
2. Mở bằng VS Code.
3. Chạy `index.html` bằng Live Server.

Có thể mở trực tiếp `index.html` ở một số trình duyệt, nhưng Live Server được khuyến nghị.

## Tính năng
- Nhập Expected Text và chọn một ảnh (PNG/JPG/WEBP/BMP, tối đa 15 MB).
- OCR bằng Tesseract.js trong trình duyệt, hỗ trợ English + Vietnamese.
- So sánh toàn bộ văn bản theo đúng thứ tự.
- Chuẩn hóa khoảng trắng và xuống dòng; giữ nguyên chữ hoa/thường và dấu câu.
- Highlight token thiếu/khác ở Expected và token thừa/khác ở OCR.
- Similarity, copy nội dung/báo cáo và xuất TXT.

## Quyền riêng tư và giới hạn
- Ảnh được xử lý trong trình duyệt, không gửi lên backend của ứng dụng.
- Lần đầu sử dụng cần Internet để tải Tesseract.js và dữ liệu ngôn ngữ từ CDN.
- Đây chưa phải bản offline hoàn toàn. Để chạy offline, cần tải và self-host thư viện cùng traineddata.
- OCR có thể nhận sai ký tự, đặc biệt với ảnh mờ, font lạ, chữ nhỏ hoặc bố cục phức tạp.
- Similarity là chỉ số so khớp ký tự, không phải xác suất OCR đúng.
