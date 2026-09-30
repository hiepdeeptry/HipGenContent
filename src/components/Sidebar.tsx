import React from 'react';
import { SessionItem } from '../types.ts';
import { Folder, Trash2, Plus, ChevronLeft, ChevronRight, MessageSquareText } from 'lucide-react';

interface SidebarProps {
  sessions: SessionItem[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClearAll,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <aside
      className={`relative z-20 flex flex-col bg-[#0b1324] text-slate-200 border-r border-slate-800 transition-all duration-300 ease-in-out shrink-0 ${
        isCollapsed ? 'w-16' : 'w-72 lg:w-80'
      }`}
    >
      {/* Collapse toggle button on edge */}
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white rounded-r-lg border border-l-0 border-slate-700 flex items-center justify-center shadow-lg transition-colors cursor-pointer z-30"
        title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between min-h-[64px]">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 font-bold text-sm text-slate-100">
              <Folder className="w-4 h-4 text-blue-400" />
              <span>Lịch Sử Phiên</span>
            </div>
            {sessions.length > 0 && (
              <button
                onClick={onClearAll}
                className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-red-400 px-2 py-1 rounded-md hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Xóa toàn bộ lịch sử phiên"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa tất cả</span>
              </button>
            )}
          </>
        ) : (
          <div className="w-full flex justify-center">
            <Folder className="w-5 h-5 text-blue-400" />
          </div>
        )}
      </div>

      {/* New Session Button */}
      <div className="p-3">
        <button
          onClick={onNewSession}
          className={`w-full py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs tracking-wide shadow-md shadow-blue-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isCollapsed ? 'px-0' : ''
          }`}
          title="Tạo phiên mới"
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>+ Phiên Mới</span>}
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
        {sessions.length === 0 ? (
          !isCollapsed && (
            <div className="p-6 text-center text-xs text-slate-500">
              Chưa có phiên nào được lưu.
            </div>
          )
        ) : (
          sessions.map((s) => {
            const isSelected = s.id === currentSessionId;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group relative rounded-xl p-2.5 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-blue-950/60 border-blue-500/50 text-white shadow-xs'
                    : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 text-slate-300'
                }`}
                title={s.title}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 overflow-hidden flex-1">
                    <MessageSquareText className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                    {!isCollapsed && (
                      <div className="overflow-hidden">
                        <p className="text-xs font-medium truncate leading-tight">
                          {s.title}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">
                          {s.timestamp}
                        </p>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && (
                    <button
                      onClick={(e) => onDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-1 rounded-md hover:bg-slate-800 text-slate-400 transition-all shrink-0 cursor-pointer"
                      title="Xóa phiên này"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

    </aside>
  );
};