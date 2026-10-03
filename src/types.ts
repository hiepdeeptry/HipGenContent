export interface ChunkTranslation {
  chunkIndex: number;
  originalText: string;
  translatedText: string;
  charCount: number;
}

export interface GenerationResult {
  id: string;
  timestamp: string;
  originalText: string;
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeOriginalTitle?: string;
  youtubeTranslatedTitle?: string;
  thumbnailUrl?: string;
  targetLanguage: string;
  chunks: ChunkTranslation[];
  fullTranslation: string;
  youtubeDescription: string;
  seoTags: string;
}

export type SessionStatus = 'running' | 'done' | 'error';

export interface SessionItem {
  id: string;
  title: string;
  titleEdited?: boolean; // true khi người dùng tự đổi tên -> không bị ghi đè bởi tên tự động
  timestamp: string; // Formatted e.g. "09:19:09 • 30/9/2026"
  createdAt: number;
  status?: SessionStatus; // thiếu = 'done' (tương thích phiên cũ)
  step?: string; // bước đang chạy, ví dụ "Đang dịch văn học (1/3 phần hoàn tất)..."
  error?: string;
  data: GenerationResult;
}

export interface TargetLanguage {
  id: string;
  name: string;
  instructionName: string;
}