import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Health check (đặt TRƯỚC phần đăng nhập để Render kiểm tra được)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// (Tuỳ chọn) Khoá toàn bộ web bằng mật khẩu — chỉ bật khi có APP_PASSWORD.
// Nên bật, vì URL Render là public: ai biết link đều dùng được API key của bạn.
const APP_USERNAME = process.env.APP_USERNAME || 'admin';
const APP_PASSWORD = process.env.APP_PASSWORD;

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

app.use((req, res, next) => {
  if (!APP_PASSWORD) return next();
  const [scheme, encoded] = (req.headers.authorization || '').split(' ');
  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString();
    const idx = decoded.indexOf(':');
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);
    if (safeEqual(user, APP_USERNAME) && safeEqual(pass, APP_PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="HipNè"');
  return res.status(401).send('Cần đăng nhập để sử dụng.');
});

// YouTube oEmbed proxy to bypass any CORS restrictions in browser
app.get('/api/youtube-info', async (req, res) => {
  try {
    const url = req.query.url as string;
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch YouTube info' });
    }
    const data = await response.json();
    return res.json(data);
  } catch (error: any) {
    console.error('YouTube info fetch error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// DeepSeek API proxy — key/endpoint/model đọc hoàn toàn từ biến môi trường (.env / Render)
app.post('/api/deepseek', async (req, res) => {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) {
      return res.status(500).json({
        error: 'Server chưa cấu hình DEEPSEEK_API_KEY. Hãy thêm vào file .env (local) hoặc Environment (Render).',
      });
    }

    const apiUrl = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';
    const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    const temperature = Number(process.env.DEEPSEEK_TEMPERATURE ?? 0.4);

    const { prompt, systemInstruction } = req.body;
    // Giới hạn trần để tránh bị lạm dụng
    const maxTokens = Math.min(Math.max(Number(req.body.maxTokens) || 2000, 1), 8000);

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Thiếu nội dung prompt.' });
    }

    const messages: Array<{ role: string; content: string }> = [];
    if (typeof systemInstruction === 'string' && systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    let endpoint = apiUrl.trim().replace(/\/+$/, '');
    if (!endpoint.endsWith('/chat/completions')) {
      endpoint += '/chat/completions';
    }

    const dsResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number.isFinite(temperature) ? temperature : 0.4,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!dsResponse.ok) {
      const errText = await dsResponse.text();
      let parsedErr: any;
      try {
        parsedErr = JSON.parse(errText);
      } catch {
        parsedErr = { error: errText };
      }
      return res.status(dsResponse.status).json({
        error: parsedErr?.error?.message || parsedErr?.error || `DeepSeek API error (${dsResponse.status})`,
      });
    }

    const data = await dsResponse.json();
    return res.json(data);
  } catch (error: any) {
    console.error('DeepSeek proxy error:', error);
    return res.status(500).json({
      error: error.message || 'Lỗi kết nối tới DeepSeek API',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();