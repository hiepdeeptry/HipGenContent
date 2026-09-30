import React from 'react';
import { X, Download, Copy, ExternalLink } from 'lucide-react';

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  title: string;
  onCopyUrl: () => void;
  onDownload: () => void;
}

export const ThumbnailModal: React.FC<ThumbnailModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  onCopyUrl,
  onDownload,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-200 truncate pr-4">
            {title || 'Ảnh Thumbnail YouTube HD'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={onCopyUrl}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy HD Link
            </button>
            <button
              onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Tải về
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 flex items-center justify-center bg-black/40 overflow-hidden">
          <img
            src={imageUrl}
            alt={title}
            className="max-h-[75vh] w-auto max-w-full rounded-xl object-contain shadow-lg"
          />
        </div>
      </div>
    </div>
  );
};
