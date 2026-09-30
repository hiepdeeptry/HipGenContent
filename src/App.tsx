/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GenerationResult,
  SessionItem,
  TargetLanguage,
  ChunkTranslation,
} from './types.ts';
import { TARGET_LANGUAGES } from './constants/languages.ts';
import {
  extractYouTubeVideoId,
  fetchYouTubeInfo,
  YouTubeInfo,
  getYouTubeThumbnails,
} from './services/youtube.ts';
import {
  translateTitle,
  translateStoryChunk,
  generateYouTubeDescription,
  generateSeoTags,
} from './services/deepseek.ts';
import { Sidebar } from './components/Sidebar.tsx';
import { ThumbnailModal } from './components/ThumbnailModal.tsx';
import {
  Sparkles,
  Link as LinkIcon,
  Copy,
  Check,
  Download,
  Eye,
  Rocket,
  Loader2,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Video,
  Hash,
  Share2,
} from 'lucide-react';

// Storage Keys
const LEGACY_STORAGE_KEY_SETTINGS = 'hipne_setting'; // bản cũ từng lưu API key ở trình duyệt
const STORAGE_KEY_SESSIONS = 'hipne_history';

export default function App() {
  // Sessions State - loaded from localStorage only
  const [sessions, setSessions] = useState<SessionItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse sessions:', e);
    }
    return [];
  });

  // Always start with a clean new session on first load or refresh
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Input State: clean and empty for new session
  const [inputText, setInputText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedLanguageId, setSelectedLanguageId] = useState('vi');

  // YouTube Info State
  const [youtubeInfo, setYoutubeInfo] = useState<YouTubeInfo | null>(null);
  const [loadingYoutube, setLoadingYoutube] = useState(false);

  // Generation Results State: null on new session / load
  const [currentResult, setCurrentResult] = useState<GenerationResult | null>(null);

  // UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>('');
  const [showThumbnailModal, setShowThumbnailModal] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [translationCollapsed, setTranslationCollapsed] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Show Toast helper
  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Copy helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Đã copy ${label}!`);
    } catch {
      showToast('Không thể sao chép vào bộ nhớ tạm.');
    }
  };

  // Save sessions to LocalStorage
  const saveSessions = (updated: SessionItem[]) => {
    setSessions(updated);
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(updated));
  };

  // Xóa API key cũ (nếu có) còn sót trong localStorage của trình duyệt
  useEffect(() => {
    localStorage.removeItem(LEGACY_STORAGE_KEY_SETTINGS);
  }, []);

  // Handle YouTube URL change & auto-detect
  useEffect(() => {
    if (!youtubeUrl.trim()) {
      setYoutubeInfo(null);
      return;
    }

    const videoId = extractYouTubeVideoId(youtubeUrl);
    if (!videoId) {
      setYoutubeInfo(null);
      return;
    }

    let isMounted = true;
    setLoadingYoutube(true);

    fetchYouTubeInfo(youtubeUrl)
      .then((info) => {
        if (isMounted && info) {
          setYoutubeInfo(info);
        }
      })
      .catch((err) => {
        console.warn('Failed to load YouTube info:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingYoutube(false);
      });

    return () => {
      isMounted = false;
    };
  }, [youtubeUrl]);

  // Handle selecting a session from history
  const handleSelectSession = (id: string) => {
    const found = sessions.find((s) => s.id === id);
    if (found) {
      setCurrentSessionId(found.id);
      setCurrentResult(found.data);
      setInputText(found.data.originalText || '');
      setYoutubeUrl(found.data.youtubeUrl || '');
      setSelectedLanguageId(found.data.targetLanguage || 'vi');
      if (found.data.youtubeVideoId) {
        const thumbs = getYouTubeThumbnails(found.data.youtubeVideoId);
        setYoutubeInfo({
          videoId: found.data.youtubeVideoId,
          title: found.data.youtubeOriginalTitle || '',
          thumbnailUrl: thumbs.maxRes,
          maxResThumbnailUrl: thumbs.maxRes,
        });
      } else {
        setYoutubeInfo(null);
      }
    }
  };

  // Handle New Session
  const handleNewSession = () => {
    setCurrentSessionId(null);
    setCurrentResult(null);
    setInputText('');
    setYoutubeUrl('');
    setYoutubeInfo(null);
    showToast('Đã tạo phiên mới. Hãy dán nội dung hoặc link YouTube!');
  };

  // Handle Delete Session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    saveSessions(updated);
    if (currentSessionId === id) {
      if (updated.length > 0) {
        handleSelectSession(updated[0].id);
      } else {
        handleNewSession();
      }
    }
    showToast('Đã xóa phiên khỏi lịch sử.');
  };

  // Handle Clear All Sessions
  const handleClearAllSessions = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên không?')) {
      saveSessions([]);
      handleNewSession();
      showToast('Đã xóa tất cả các phiên.');
    }
  };

  // Download Thumbnail Helper
  const handleDownloadThumbnail = async () => {
    if (!youtubeInfo) return;
    try {
      const response = await fetch(youtubeInfo.maxResThumbnailUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `youtube_thumbnail_${youtubeInfo.videoId}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Đã tải ảnh thumbnail HD về máy!');
    } catch {
      // Fallback: direct link open
      window.open(youtubeInfo.maxResThumbnailUrl, '_blank');
    }
  };

  // Chunking utility for large story texts
  const chunkText = (text: string, maxChunkLength = 4000): string[] => {
    if (text.length <= maxChunkLength) return [text];

    const paragraphs = text.split(/\n\s*\n/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const para of paragraphs) {
      if ((currentChunk + '\n\n' + para).length > maxChunkLength && currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = para;
      } else {
        currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks.length > 0 ? chunks : [text];
  };

  // Main Generation Handler
  const handleStartGeneration = async () => {
    if (!inputText.trim() && !youtubeUrl.trim()) {
      showToast('Vui lòng dán văn bản nội dung hoặc link YouTube!');
      return;
    }

    const targetLang =
      TARGET_LANGUAGES.find((l) => l.id === selectedLanguageId) || TARGET_LANGUAGES[0];

    setIsGenerating(true);
    setGenerationStep('Đang khởi tạo...');

    try {
      const videoId = extractYouTubeVideoId(youtubeUrl);
      let originalTitle = youtubeInfo?.title || '';
      let translatedTitle = '';

      // 1. Dịch Tiêu Đề (Nếu có tiêu đề YouTube)
      if (originalTitle) {
        setGenerationStep('Đang dịch tiêu đề nguyên nghĩa...');
        try {
          translatedTitle = await translateTitle(originalTitle, targetLang);
        } catch (err: any) {
          console.warn('Translate title error:', err);
          translatedTitle = originalTitle; // fallback
        }
      }

      // 2. Dịch Đoạn Văn Học / Chia nhỏ nội dung nếu lớn
      const textToTranslate = inputText.trim() || originalTitle;
      const textChunks = chunkText(textToTranslate);
      const translatedChunks: ChunkTranslation[] = [];

      for (let i = 0; i < textChunks.length; i++) {
        setGenerationStep(`Đang dịch văn học (Đoạn ${i + 1}/${textChunks.length})...`);
        const chunkTextContent = textChunks[i];
        const translatedContent = await translateStoryChunk(chunkTextContent, targetLang);
        translatedChunks.push({
          chunkIndex: i + 1,
          originalText: chunkTextContent,
          translatedText: translatedContent,
          charCount: translatedContent.length,
        });
      }

      const fullTranslation = translatedChunks.map((c) => c.translatedText).join('\n\n');

      // 3. Tạo Mô Tả YouTube (4 phần chuẩn viral)
      setGenerationStep('Đang tạo mô tả YouTube chuyên nghiệp...');
      const storyContext = fullTranslation || textToTranslate;
      const youtubeDescription = await generateYouTubeDescription(
        storyContext,
        targetLang
      );

      // 4. Tạo SEO Tags Viral (<400 ký tự)
      setGenerationStep('Đang tạo bộ thẻ SEO tags tối ưu...');
      const seoTags = await generateSeoTags(storyContext, targetLang);

      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} • ${now.getDate()}/${
        now.getMonth() + 1
      }/${now.getFullYear()}`;

      // Create new session result
      const newResult: GenerationResult = {
        id: `session-${Date.now()}`,
        timestamp: timeStr,
        originalText: inputText,
        youtubeUrl,
        youtubeVideoId: videoId || undefined,
        youtubeOriginalTitle: originalTitle || undefined,
        youtubeTranslatedTitle: translatedTitle || undefined,
        thumbnailUrl: videoId ? getYouTubeThumbnails(videoId).maxRes : undefined,
        targetLanguage: targetLang.id,
        chunks: translatedChunks,
        fullTranslation,
        youtubeDescription,
        seoTags,
      };

      setCurrentResult(newResult);

      // Add to session history
      const titleSnippet =
        translatedTitle ||
        inputText.slice(0, 32).replace(/\n/g, ' ') + (inputText.length > 32 ? '...' : '');

      const newSessionItem: SessionItem = {
        id: newResult.id,
        title: titleSnippet || 'Phiên dịch mới',
        timestamp: timeStr,
        createdAt: Date.now(),
        data: newResult,
      };

      const updatedSessions = [newSessionItem, ...sessions];
      saveSessions(updatedSessions);
      setCurrentSessionId(newSessionItem.id);

      showToast('Đã tạo thành công toàn bộ nội dung!');
    } catch (err: any) {
      console.error('Generation failed:', err);
      showToast(err.message || 'Có lỗi xảy ra trong quá trình tạo nội dung.');
    } finally {
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  const selectedLang =
    TARGET_LANGUAGES.find((l) => l.id === selectedLanguageId) || TARGET_LANGUAGES[0];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f7fb] text-slate-800 font-sans antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/90 text-white text-xs font-semibold shadow-xl border border-slate-700/60 backdrop-blur-md animate-in slide-in-from-top-3 fade-in duration-200">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Left Sidebar */}
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onDeleteSession={handleDeleteSession}
        onClearAll={handleClearAllSessions}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-10 px-8 py-5 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-200/70">
          <div className="flex-1 text-center">
            <h1 className="text-2xl lg:text-3xl font-black italic tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700">
              Hịp Nè
            </h1>
            <p className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-0.5">
              Dịch - Việt Content - Mô Tả - Hastag
            </p>
          </div>

        </header>

        {/* Scrollable Workspace */}
        <div className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-8">
          {/* Main Input Form Card */}
          <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-5">
            {/* Large Text Area */}
            <div className="relative">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Dán văn bản nội dung cần xử lý vào đây (Không giới hạn độ dài)..."
                rows={6}
                className="w-full p-4 pb-8 rounded-2xl border border-slate-200 bg-slate-50/40 text-slate-800 text-sm leading-relaxed placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-y"
              />
              <span className="absolute bottom-3 right-4 text-[11px] font-mono text-slate-400 select-none">
                {inputText.length.toLocaleString('vi-VN')} ký tự
              </span>
            </div>

            {/* YouTube Link Input Area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800 tracking-wider uppercase">
                  <span className="w-4 h-4 rounded-sm bg-blue-600 text-white flex items-center justify-center text-[10px]">
                    ▶
                  </span>
                  <span>DÁN LINK YOUTUBE VIDEO (TÙY CHỌN)</span>
                </div>
                {youtubeInfo && (
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-0.5 rounded-full flex items-center gap-1.5">
                    ✓ ĐÃ NHẬN DIỆN VIDEO
                  </span>
                )}
              </div>

              <div className="relative flex items-center">
                <div className="absolute left-4 text-slate-400 pointer-events-none">
                  <LinkIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="Dán URL YouTube (ví dụ: https://www.youtube.com/watch?v=... hoặc https://youtu.be/...)"
                  className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50/40 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all font-mono"
                />
                {youtubeUrl && (
                  <button
                    onClick={() => {
                      setYoutubeUrl('');
                      setYoutubeInfo(null);
                    }}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* YouTube Video Preview Card */}
              {loadingYoutube ? (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span>Đang tải thông tin video YouTube...</span>
                </div>
              ) : (
                youtubeInfo && (
                  <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                    <img
                      src={youtubeInfo.thumbnailUrl}
                      alt={youtubeInfo.title}
                      className="w-full sm:w-32 aspect-video rounded-xl object-cover shadow-2xs border border-slate-200"
                    />
                    <div className="flex-1 min-w-0 w-full space-y-2">
                      <p className="text-xs font-semibold text-slate-800 line-clamp-2">
                        {youtubeInfo.title}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setShowThumbnailModal(true)}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Eye className="w-3 h-3 text-blue-600" />
                          <span>Xem ảnh</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadThumbnail}
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Download className="w-3 h-3 text-blue-600" />
                          <span>Tải về</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(youtubeInfo.maxResThumbnailUrl, 'link Thumbnail HD')
                          }
                          className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        >
                          <Copy className="w-3 h-3 text-slate-500" />
                          <span>Copy HD</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Language & Submit Action */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-4">
              <div className="space-y-1.5 flex-1 max-w-sm">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  NGÔN NGỮ MỤC TIÊU
                </label>
                <div className="relative">
                  <select
                    value={selectedLanguageId}
                    onChange={(e) => setSelectedLanguageId(e.target.value)}
                    className="w-full appearance-none px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-800 text-sm font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                  >
                    {TARGET_LANGUAGES.map((lang) => (
                      <option key={lang.id} value={lang.id}>
                        {lang.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartGeneration}
                disabled={isGenerating}
                className="py-3 px-8 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{generationStep || 'Đang tạo...'}</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>BẮT ĐẦU TẠO</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Results Area */}
          {currentResult && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
              {/* Section: Video Title & Thumbnail */}
              {(currentResult.youtubeVideoId || currentResult.youtubeTranslatedTitle) && (
                <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-5">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className="w-4 h-4 rounded-sm bg-blue-600 text-white flex items-center justify-center text-[10px]">
                      ▶
                    </span>
                    <span>
                      Tiêu Đề & Thumbnail YouTube ({selectedLang.name})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    {/* Thumbnail Column */}
                    {currentResult.youtubeVideoId && (
                      <div className="md:col-span-5 bg-slate-50/70 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            🖼️ THUMBNAIL VIDEO YOUTUBE
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => setShowThumbnailModal(true)}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Eye className="w-3 h-3 text-blue-600" />
                              Xem ảnh
                            </button>
                            <button
                              onClick={handleDownloadThumbnail}
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-blue-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Download className="w-3 h-3" />
                              Tải ảnh
                            </button>
                            <button
                              onClick={() =>
                                copyToClipboard(
                                  currentResult.thumbnailUrl || '',
                                  'link Thumbnail HD'
                                )
                              }
                              className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                            >
                              <Copy className="w-3 h-3" />
                              Copy HD
                            </button>
                          </div>
                        </div>

                        <div
                          className="relative aspect-video rounded-xl overflow-hidden shadow-xs cursor-pointer group"
                          onClick={() => setShowThumbnailModal(true)}
                        >
                          <img
                            src={currentResult.thumbnailUrl}
                            alt="YouTube Thumbnail"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-semibold flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" /> Xem phóng to
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Titles Column */}
                    <div
                      className={`${
                        currentResult.youtubeVideoId ? 'md:col-span-7' : 'md:col-span-12'
                      } space-y-4`}
                    >
                      {/* Original Title */}
                      {currentResult.youtubeOriginalTitle && (
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                            TIÊU ĐỀ GỐC
                          </label>
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium leading-relaxed">
                            {currentResult.youtubeOriginalTitle}
                          </div>
                        </div>
                      )}

                      {/* Translated Title */}
                      {currentResult.youtubeTranslatedTitle && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                              <span className="w-1.5 h-3 bg-blue-600 rounded-full"></span>
                              BẢN DỊCH NGUYÊN NGHĨA (ĐÚNG 100% CẤU TRÚC & NGỮ NGHĨA)
                            </label>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                                  currentResult.youtubeTranslatedTitle.length <= 100
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {currentResult.youtubeTranslatedTitle.length} ký tự (Chuẩn YouTube ≤ 100)
                              </span>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    currentResult.youtubeTranslatedTitle || '',
                                    'tiêu đề dịch'
                                  )
                                }
                                className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                            </div>
                          </div>
                          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs text-sm font-bold text-slate-900 leading-relaxed border-l-4 border-l-blue-600">
                            {currentResult.youtubeTranslatedTitle}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Section 01: Bản Dịch Văn Học */}
              {currentResult.fullTranslation && (
                <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                        01
                      </span>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Bản Dịch ({selectedLang.name})
                      </h2>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setTranslationCollapsed(!translationCollapsed)}
                        className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        {translationCollapsed ? (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 text-blue-600" /> Xem chi tiết
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 text-blue-600" /> Thu gọn
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          copyToClipboard(currentResult.fullTranslation, 'toàn bộ bản dịch')
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </button>
                    </div>
                  </div>

                  {!translationCollapsed && (
                    <div className="space-y-4 pt-1">
                      {currentResult.chunks && currentResult.chunks.length > 0 ? (
                        currentResult.chunks.map((chunk) => (
                          <div
                            key={chunk.chunkIndex}
                            className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 space-y-3"
                          >
                            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-200/60">
                              <span className="font-bold tracking-wider uppercase text-slate-600">
                                ĐOẠN {chunk.chunkIndex} ({chunk.charCount.toLocaleString('vi-VN')} KÝ TỰ)
                              </span>
                              <button
                                onClick={() =>
                                  copyToClipboard(chunk.translatedText, `đoạn ${chunk.chunkIndex}`)
                                }
                                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                              >
                                <Copy className="w-3 h-3" />
                                Copy đoạn
                              </button>
                            </div>
                            <div className="text-sm text-slate-800 leading-relaxed font-serif whitespace-pre-line">
                              {chunk.translatedText}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-sm text-slate-800 leading-relaxed font-serif whitespace-pre-line">
                          {currentResult.fullTranslation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Section 02: Mô Tả YouTube */}
              {currentResult.youtubeDescription && (
                <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                        02
                      </span>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        Mô Tả YouTube ({selectedLang.name})
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {currentResult.youtubeDescription.length} ký tự
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(currentResult.youtubeDescription, 'mô tả YouTube')
                        }
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Mô Tả
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-200 text-sm text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                    {currentResult.youtubeDescription}
                  </div>
                </div>
              )}

              {/* Section 03: SEO Tags Viral */}
              {currentResult.seoTags && (
                <div className="bg-white rounded-3xl p-6 md:p-7 shadow-xs border border-slate-200/80 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center">
                        03
                      </span>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight">
                        SEO Tags Viral
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          currentResult.seoTags.length <= 400
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {currentResult.seoTags.length} / 400 ký tự (Tối đa 400)
                      </span>
                      <button
                        onClick={() => copyToClipboard(currentResult.seoTags, 'SEO Tags')}
                        className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Tags
                      </button>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-amber-50/20 border border-amber-100/80 text-xs font-mono text-slate-700 leading-relaxed break-words">
                    {currentResult.seoTags}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Thumbnail High-Res Modal */}
      {youtubeInfo && (
        <ThumbnailModal
          isOpen={showThumbnailModal}
          onClose={() => setShowThumbnailModal(false)}
          imageUrl={youtubeInfo.maxResThumbnailUrl}
          title={youtubeInfo.title}
          onCopyUrl={() =>
            copyToClipboard(youtubeInfo.maxResThumbnailUrl, 'link Thumbnail HD')
          }
          onDownload={handleDownloadThumbnail}
        />
      )}
    </div>
  );
}