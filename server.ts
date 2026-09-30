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

// ---------------------------------------------------------------------------
// (Tuỳ chọn) Khoá web bằng mật khẩu — chỉ bật khi có APP_PASSWORD.
// Đăng nhập 1 lần, máy đó được nhớ 1 năm (cookie ký HMAC, HttpOnly).
// Đổi APP_PASSWORD => mọi máy bị đăng xuất.
// ---------------------------------------------------------------------------
const APP_PASSWORD = process.env.APP_PASSWORD;
const COOKIE_NAME = 'ath_auth';
const COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
const SESSION_SECRET = crypto
  .createHash('sha256')
  .update(`${APP_PASSWORD ?? ''}|${process.env.SESSION_SECRET ?? ''}`)
  .digest();

app.set('trust proxy', 1); // Render đứng sau proxy HTTPS

function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signToken(expiresAt: number) {
  const payload = String(expiresAt);
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string | undefined) {
  if (!token) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return safeEqual(sig, expected) && Number(payload) > Date.now();
}

function getCookie(req: express.Request, name: string) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > -1 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

// Chống dò mật khẩu: tối đa 10 lần sai / 15 phút / IP
const failedLogins = new Map<string, { count: number; resetAt: number }>();

function loginPage(error = '') {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Đăng nhập</title>
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f7fb;font-family:system-ui,sans-serif}
form{background:#fff;padding:32px;border-radius:24px;box-shadow:0 10px 30px #0001;width:min(340px,90vw)}
h1{margin:0 0 4px;font-size:20px;color:#1d4ed8}p{margin:0 0 20px;font-size:12px;color:#94a3b8}
input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid #e2e8f0;border-radius:14px;font-size:14px}
button{width:100%;margin-top:12px;padding:12px;border:0;border-radius:14px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
.err{color:#dc2626;font-size:12px;margin-top:10px}
</style></head><body>
<form method="POST" action="/login">
<h1>ATH - CONTENT GEN</h1><p>Nhập mật khẩu. Máy này sẽ được ghi nhớ.</p>
<input type="password" name="password" placeholder="Mật khẩu" autofocus required>
<button type="submit">Đăng nhập</button>
${error ? `<div class="err">${error}</div>` : ''}
</form></body></html>`;
}

if (APP_PASSWORD) {
  app.get('/login', (_req, res) => res.type('html').send(loginPage()));

  app.post('/login', express.urlencoded({ extended: false }), (req, res) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();
    const rec = failedLogins.get(ip);
    if (rec && rec.resetAt > now && rec.count >= 10) {
      return res.status(429).type('html').send(loginPage('Sai quá nhiều lần. Thử lại sau 15 phút.'));
    }

    if (typeof req.body.password === 'string' && safeEqual(req.body.password, APP_PASSWORD)) {
      failedLogins.delete(ip);
      res.cookie(COOKIE_NAME, signToken(now + COOKIE_MAX_AGE_MS), {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure,
        maxAge: COOKIE_MAX_AGE_MS,
      });
      return res.redirect('/');
    }

    failedLogins.set(ip, {
      count: rec && rec.resetAt > now ? rec.count + 1 : 1,
      resetAt: rec && rec.resetAt > now ? rec.resetAt : now + 15 * 60 * 1000,
    });
    return res.status(401).type('html').send(loginPage('Sai mật khẩu.'));
  });

  app.get('/logout', (_req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/login');
  });

  app.use((req, res, next) => {
    if (verifyToken(getCookie(req, COOKIE_NAME))) return next();
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Chưa đăng nhập. Hãy tải lại trang để đăng nhập.' });
    }
    return res.redirect('/login');
  });
}

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

// Tự ping mỗi 3 phút để Render (gói Free) không cho service "ngủ" sau 15 phút không có request.
// RENDER_EXTERNAL_URL do Render tự cung cấp; có thể ghi đè bằng SELF_PING_URL.
function startKeepAlive() {
  const base = process.env.SELF_PING_URL || process.env.RENDER_EXTERNAL_URL;
  if (process.env.NODE_ENV !== 'production' || !base) return;
  const url = `${base.replace(/\/+$/, '')}/api/health`;
  const INTERVAL_MS = 3 * 60 * 1000;
  setInterval(async () => {
    try {
      const r = await fetch(url);
      console.log(`[keep-alive] ${r.status}`);
    } catch (e: any) {
      console.warn('[keep-alive] failed:', e.message);
    }
  }, INTERVAL_MS);
  console.log(`[keep-alive] ping ${url} mỗi 3 phút`);
}

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
    startKeepAlive();
  });
}

startServer();