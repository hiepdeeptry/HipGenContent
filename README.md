
Dịch truyện, dịch tiêu đề YouTube, tạo mô tả & SEO tags bằng DeepSeek.
API Key nằm ở **server** (biến môi trường), giao diện không có phần cài đặt API.

## Chạy local
1. `npm install`
2. `cp .env.example .env` rồi điền `DEEPSEEK_API_KEY`
3. `npm run dev` → http://localhost:3000

## Deploy Render
- Build: `npm install && npm run build`
- Start: `npm start`
- Environment: `DEEPSEEK_API_KEY` (bắt buộc), `APP_PASSWORD` (khuyên dùng), `NODE_VERSION=22`
