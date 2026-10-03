import React, { useRef, useState } from 'react';
import { SessionItem } from '../types.ts';
import {
  Folder,
  Trash2,
  Plus,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Loader2,
  Check,
  TriangleAlert,
} from 'lucide-react';

interface SidebarProps {
  sessions: SessionItem[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession: (id: string, title: string) => void;
  onClearAll: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 mt-0.5 shrink-0 animate-spin text-blue-400" />;
  }
  if (status === 'error') {
    return <TriangleAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-400" />;
  }
  return <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />;
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { label: string; cls: string }> = {
    running: { label: 'Đang chạy', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    done: { label: 'Hoàn thành', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
    error: { label: 'Lỗi', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  };
  const { label, cls } = map[status] || map.done;
  return (
    <span className={`shrink-0 px-1.5 py-px rounded-full border text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onRenameSession,
  onClearAll,
  isCollapsed,
  onToggleCollapse,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const skipBlurRef = useRef(false);

  const startEdit = (s: SessionItem) => {
    setEditingId(s.id);
    setDraft(s.title);
  };

  const commitEdit = () => {
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    if (editingId) {
      const t = draft.trim();
      if (t) onRenameSession(editingId, t);
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    skipBlurRef.current = true;
    setEditingId(null);
  };

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
          {!isCollapsed && <span>Phiên Mới</span>}
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
            const status = s.status ?? 'done';
            const isEditing = editingId === s.id && !isCollapsed;
            return (
              <div
                key={s.id}
                onClick={() => onSelectSession(s.id)}
                className={`group relative rounded-xl p-2.5 cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-blue-950/60 border-blue-500/50 text-white shadow-xs'
                    : 'bg-slate-900/40 border-transparent hover:bg-slate-800/60 text-slate-300'
                }`}
                title={
                  isCollapsed
                    ? `${s.title} — ${
                        status === 'running' ? 'Đang chạy' : status === 'error' ? 'Lỗi' : 'Hoàn thành'
                      }`
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 overflow-hidden flex-1">
                    <StatusIcon status={status} />
                    {!isCollapsed && (
                      <div className="overflow-hidden flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            value={draft}
                            maxLength={80}
                            onChange={(e) => setDraft(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onBlur={commitEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEdit();
                              else if (e.key === 'Escape') cancelEdit();
                            }}
                            className="w-full bg-slate-950 border border-blue-500/60 rounded-md px-1.5 py-0.5 text-xs text-white outline-hidden focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <p
                            className="text-xs font-medium truncate leading-tight"
                            title="Nhấp đúp để đổi tên"
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              startEdit(s);
                            }}
                          >
                            {s.title}
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 mt-1 font-mono">{s.timestamp}</p>
                        <div className="mt-1 flex items-center gap-1.5 min-w-0">
                          <StatusBadge status={status} />
                          {status === 'running' && s.step && (
                            <span className="text-[10px] text-slate-500 truncate">{s.step}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {!isCollapsed && !isEditing && (
                    <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(s);
                        }}
                        className="hover:text-blue-400 p-1 rounded-md hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                        title="Đổi tên phiên"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => onDeleteSession(s.id, e)}
                        className="hover:text-red-400 p-1 rounded-md hover:bg-slate-800 text-slate-400 transition-colors cursor-pointer"
                        title="Xóa phiên này"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
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
