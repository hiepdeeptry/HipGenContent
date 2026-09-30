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

export interface SessionItem {
  id: string;
  title: string;
  timestamp: string; // Formatted e.g. "09:19:09 • 30/9/2026"
  createdAt: number;
  data: GenerationResult;
}

export interface TargetLanguage {
  id: string;
  name: string;
  instructionName: string;
}