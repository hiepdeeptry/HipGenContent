import { TargetLanguage } from '../types.ts';

export interface DeepSeekRequestOptions {
  prompt: string;
  systemInstruction?: string;
  maxTokens?: number;
}

/**
 * Gọi DeepSeek thông qua backend proxy (/api/deepseek).
 * API Key, endpoint, model, temperature đều nằm ở server (.env) —
 * trình duyệt KHÔNG bao giờ nhìn thấy key.
 */
export async function callDeepSeek(options: DeepSeekRequestOptions): Promise<string> {
  const { prompt, systemInstruction, maxTokens = 2500 } = options;

  const res = await fetch('/api/deepseek', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, systemInstruction, maxTokens }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Lỗi máy chủ (HTTP ${res.status})`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Không nhận được phản hồi từ DeepSeek API');
  return content.trim();
}

/**
 * Xóa các ký hiệu nhiễu thường có trong transcript:
 *  - Thẻ trong ngoặc vuông: [music], [hắng giọng], [odkašlání], [...]
 *  - Dấu chuyển người nói: >> và <<
 * Sau đó dọn khoảng trắng thừa nhưng vẫn giữ nguyên xuống dòng / đoạn văn.
 */
export function cleanNoiseMarkers(text: string): string {
  if (!text) return '';
  return text
    .replace(/\[[^\]\n]*\]/g, '')
    .replace(/>{2,}|<{2,}/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractTranslationTag(text: string): string {
  if (!text) return '';
  const match = text.match(/<translation>([\s\S]*?)<\/translation>/i);
  let out = match && match[1] ? match[1] : text;
  // Gỡ mọi thẻ <translation> còn sót (kể cả khi thiếu thẻ đóng do bị cắt)
  out = out.replace(/<\/?translation>/gi, '');
  out = out.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
  return cleanNoiseMarkers(out);
}

export async function translateTitle(
  originalTitle: string,
  targetLang: TargetLanguage
): Promise<string> {
  const systemInstruction = `Bạn là dịch giả chuyên nghiệp. Nhiệm vụ của bạn là dịch TIÊU ĐỀ video sau sang ${targetLang.instructionName}.

QUY TẮC DỊCH NGUYÊN NGHĨA:
1. DỊCH CHÍNH XÁC NGUYÊN NGHĨA: Bảo toàn 100% ý nghĩa gốc, ngữ điệu và cấu trúc câu của tiêu đề gốc.
2. TUYỆT ĐỐI KHÔNG bóp méo ý nghĩa, KHÔNG bịa chuyện, KHÔNG thêm thắt từ ngữ giật gân sai khác bản gốc.
3. BẮT BUỘC dịch 100% sang ${targetLang.instructionName}. Tuyệt đối KHÔNG dịch sang ngôn ngữ khác.
4. CHỈ XUẤT DUY NHẤT một dòng tiêu đề đã dịch. Không dùng dấu ngoặc kép, không có lời dẫn.`;

  const prompt = `Tiêu đề gốc:\n${originalTitle}`;

  const result = await callDeepSeek({
    prompt,
    systemInstruction,
    maxTokens: 250,
  });

  return result.replace(/^["'“”«»]+|["'“”«»]+$/g, '').trim();
}

export async function translateStoryChunk(
  textChunk: string,
  targetLang: TargetLanguage
): Promise<string> {
  const systemInstruction = `Bạn là một DỊCH GIẢ VĂN HỌC BẢN ĐỊA XUẤT SẮC (Master Literary Translator), chuyên về kể chuyện (storytelling).

QUY TẮC NGÔN NGỮ ĐÍCH:
- Dịch DUY NHẤT sang: ${targetLang.instructionName}.
- TUYỆT ĐỐI KHÔNG để sót từ tiếng Anh, KHÔNG dịch sang ngôn ngữ khác.

PHONG CÁCH & BẢN ĐỊA HÓA (LOCALIZATION):
- Dịch mượt mà, truyền cảm. Chuyển đổi linh hoạt các thành ngữ (idioms) sang cách diễn đạt chuẩn của người bản xứ.
- Lược bỏ đại từ chủ ngữ (Pro-drop) nếu ngôn ngữ đích cho phép, giúp câu văn tự nhiên, bớt lặp từ.
- Xử lý NGÔI XƯNG (POV) cực kỳ cẩn thận: Phân biệt rõ lời thoại trực tiếp (ngôi thứ 1) và lời kể chuyện (ngôi thứ 3).
- LOẠI BỎ hoàn toàn các thẻ âm thanh: [music], [applause], [Laughter]...

QUY TẮC ĐẦU RA (CRITICAL):
- KHÔNG giải thích, KHÔNG chào hỏi.
- BẮT BUỘC đặt TOÀN BỘ nội dung bản dịch bên trong cặp thẻ XML: <translation> [Nội dung dịch] </translation>.`;

  const prompt = `YÊU CẦU: Dịch đoạn văn bản trong thẻ <source_text> sang ${targetLang.instructionName}:\n<source_text>\n${textChunk}\n</source_text>`;

  const raw = await callDeepSeek({
    prompt,
    systemInstruction,
    maxTokens: 8000,
  });

  return extractTranslationTag(raw);
}

export async function generateYouTubeDescription(
  storyContext: string,
  targetLang: TargetLanguage
): Promise<string> {
  const systemInstruction = `Bạn là chuyên gia sáng tạo nội dung YouTube hàng đầu. Dựa trên nội dung câu chuyện/video sau, hãy viết một phần MÔ TẢ (Description) video YouTube vô cùng HẤP DẪN, TỰ NHIÊN và KỊCH TÍNH bằng ${targetLang.instructionName}.

QUY TẮC BẮT BUỘC VỀ NGÔN NGỮ ĐÍCH:
- TOÀN BỘ mô tả PHẢI 100% được viết bằng ${targetLang.instructionName}.
- TUYỆT ĐỐI KHÔNG xuất bằng bất kỳ ngôn ngữ nào khác ngoài ${targetLang.instructionName}.

BỐ CỤC BẮT BUỘC (PHẢI TÁCH ĐOẠN RÕ RÀNG BẰNG DÒNG TRỐNG GIỮA CÁC ĐOẠN):
Mô tả phải gồm đúng 4 phần tách bạch, mỗi phần ngăn cách bằng 1 dòng trống:

1. [HOOK MỞ ĐẦU]: 1-2 câu giật gân, cuốn hút gây tò mò tột độ. Sử dụng từ IN HOA và Emoji sinh động để nhấn mạnh.
(Cách 1 dòng trống)
2. [TÓM TẮT CÂU CHUYỆN]: 2-4 câu súc tích kể về tình huống kịch tính nhất của câu chuyện mà không tiết lộ cái kết.
(Cách 1 dòng trống)
3. [KÊU GỌI HÀNH ĐỘNG - CTA]: Lời kêu gọi khán giả bấm Like, Chia sẻ, Đăng ký kênh (Subscribe) và bình luận cảm xúc bằng ${targetLang.instructionName}.
(Cách 1 dòng trống)
4. [HASHTAGS]: 4-6 hashtags chuẩn SEO có liên quan nhất (ví dụ: #Story #Viral #Trending...).

QUY ĐỊNH HÌNH THỨC:
- TUYỆT ĐỐI KHÔNG dính liền các phần thành một khối chữ. BẮT BUỘC PHẢI XUỐNG DÒNG VÀ CÁCH DÒNG RÕ RÀNG.
- KHÔNG dùng cú pháp Markdown như ** hay ## hay các tiêu đề mục dạng [HOOK].
- Độ dài vừa phải từ 450 đến 850 ký tự.
- Chỉ xuất nội dung mô tả thuần túy.`;

  const prompt = `Nội dung câu chuyện:\n${storyContext.slice(0, 4500)}`;

  const desc = await callDeepSeek({
    prompt,
    systemInstruction,
    maxTokens: 1000,
  });

  return desc.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
}

export async function generateSeoTags(
  storyContext: string,
  targetLang: TargetLanguage
): Promise<string> {
  const systemInstruction = `Bạn là chuyên gia SEO YouTube hàng đầu. Dựa trên nội dung câu chuyện sau, hãy tạo danh sách từ khóa/tags YouTube chất lượng cao nhất bằng ${targetLang.instructionName}.

QUY TẮC BẮT BUỘC:
- 100% từ khóa PHẢI bằng ${targetLang.instructionName}.
- Từ khóa bám sát câu chuyện, tự nhiên, là những cụm từ người dùng ${targetLang.name} hay tìm kiếm trên YouTube.
- GIỚI HẠN ĐỘ DÀI: TỐI ĐA 400 KÝ TỰ (từ 250 đến tối đa 400 ký tự). TUYỆT ĐỐI KHÔNG ĐƯỢC VƯỢT QUÁ 400 KÝ TỰ.
- Định dạng: Các từ khóa cách nhau bằng dấu phẩy và khoảng trắng ", ".
- Một dòng duy nhất, KHÔNG dùng dấu #, KHÔNG có lời giải thích.
Chỉ xuất duy nhất chuỗi tags.`;

  const prompt = `Nội dung câu chuyện:\n${storyContext.slice(0, 3500)}`;

  let tags = await callDeepSeek({
    prompt,
    systemInstruction,
    maxTokens: 300,
  });

  tags = tags.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  // Ensure no leading # and ensure it doesn't exceed 400 chars
  if (tags.length > 400) {
    const lastComma = tags.slice(0, 400).lastIndexOf(',');
    if (lastComma > 250) {
      tags = tags.slice(0, lastComma).trim();
    } else {
      tags = tags.slice(0, 400).trim();
    }
  }

  return tags;
}