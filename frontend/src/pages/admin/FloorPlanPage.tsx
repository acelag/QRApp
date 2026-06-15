import { useEffect, useRef, useState, useCallback } from 'react';
import { Save, Pencil, Eye, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { AdminSidebar } from '../../components/AdminSidebar';
import { AdminHeader } from '../../components/AdminHeader';
import { tableService, type TableStatusEntry } from '../../services/tableService';
import type { Table } from '../../types';
import { useCurrency } from '../../context/CurrencyContext';

type Shape = 'rect' | 'round';

interface Pos { x: number; y: number; shape: Shape }

interface DragState {
  id: string;
  startMouseX: number;
  startMouseY: number;
  startX: number;
  startY: number;
}

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  free:    { bg: 'bg-gray-50',   border: 'border-gray-300',  text: 'text-gray-600',  dot: 'bg-gray-400' },
  waiting: { bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700', dot: 'bg-amber-400' },
  active:  { bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700', dot: 'bg-green-500' },
  stale:   { bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700',   dot: 'bg-red-500'   },
};

function elapsed(started: string | null): string {
  if (!started) return '';
  const mins = Math.floor((Date.now() - new Date(started).getTime()) / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function FloorPlanPage() {
  const { fmt } = useCurrency();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [tables, setTables] = useState<Table[]>([]);
  const [positions, setPositions] = useState<Record<string, Pos>>({});
  const [statuses, setStatuses] = useState<Record<string, TableStatusEntry>>({});
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);

  // â”€â”€ Load tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    tableService.getTables().then((data) => {
      setTables(data.filter((t) => t.active));
      const map: Record<string, Pos> = {};
      for (const t of data) {
        if (t.floorX != null && t.floorY != null) {
          map[t.id] = { x: t.floorX, y: t.floorY, shape: t.floorShape ?? 'rect' };
        }
      }
      setPositions(map);
    }).catch(() => toast.error('Failed to load tables'));
  }, []);

  // â”€â”€ Poll live status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const load = () =>
      tableService.getStatus().then((rows) => {
        const map: Record<string, TableStatusEntry> = {};
        for (const r of rows) map[r.id] = r;
        setStatuses(map);
      }).catch(() => {});
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  // â”€â”€ Global drag handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!drag || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.startMouseX) / rect.width) * 100;
    const dy = ((e.clientY - drag.startMouseY) / rect.height) * 100;
    const x = Math.max(3, Math.min(97, drag.startX + dx));
    const y = Math.max(3, Math.min(97, drag.startY + dy));
    setPositions((prev) => ({ ...prev, [drag.id]: { ...prev[drag.id], x, y } }));
  }, [drag]);

  const onMouseUp = useCallback(() => setDrag(null), []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (!drag || !canvasRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvasRef.current.getBoundingClientRect();
    const dx = ((touch.clientX - drag.startMouseX) / rect.width) * 100;
    const dy = ((touch.clientY - drag.startMouseY) / rect.height) * 100;
    const x = Math.max(3, Math.min(97, drag.startX + dx));
    const y = Math.max(3, Math.min(97, drag.startY + dy));
    setPositions((prev) => ({ ...prev, [drag.id]: { ...prev[drag.id], x, y } }));
  }, [drag]);

  useEffect(() => {
    if (!drag) return;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onMouseUp);
    };
  }, [drag, onMouseMove, onMouseUp, onTouchMove]);

  // â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function startDrag(e: React.MouseEvent | React.TouchEvent, id: string) {
    if (!editMode) return;
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const pos = positions[id] ?? { x: 50, y: 50, shape: 'rect' as Shape };
    setDrag({ id, startMouseX: clientX, startMouseY: clientY, startX: pos.x, startY: pos.y });
  }

  function placeOnCanvas(id: string) {
    // Auto-place unplaced table at a free spot (cascade right/down from 10%)
    const placed = Object.values(positions);
    let x = 15, y = 15;
    // Nudge until we find a non-overlapping position
    for (let attempt = 0; attempt < 30; attempt++) {
      const collision = placed.some((p) => Math.abs(p.x - x) < 14 && Math.abs(p.y - y) < 14);
      if (!collision) break;
      x += 16;
      if (x > 85) { x = 15; y += 16; }
    }
    setPositions((prev) => ({ ...prev, [id]: { x, y, shape: 'rect' } }));
  }

  function removeFromCanvas(id: string) {
    setPositions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function toggleShape(id: string) {
    setPositions((prev) => ({
      ...prev,
      [id]: { ...prev[id], shape: prev[id].shape === 'rect' ? 'round' : 'rect' },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = tables.map((t) => {
        const p = positions[t.id];
        return { id: t.id, floorX: p?.x ?? null, floorY: p?.y ?? null, floorShape: p?.shape ?? 'rect' };
      });
      await tableService.saveLayout(payload);
      toast.success('Layout saved');
      setEditMode(false);
    } catch {
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  }

  // â”€â”€ Partitioning â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const placed = tables.filter((t) => positions[t.id] != null);
  const unplaced = tables.filter((t) => positions[t.id] == null);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto mt-14 md:mt-0">
        <AdminHeader title="Floor Plan" backTo="/admin">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                editMode
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
              }`}
            >
              {editMode ? <><Pencil size={14} /> Editing</> : <><Eye size={14} /> Live View</>}
            </button>
            {editMode && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60 transition-colors"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save Layout'}
              </button>
            )}
          </div>
        </AdminHeader>

        <div className="px-3 sm:px-4 lg:px-6 py-4 space-y-4">

          {/* Legend */}
          {!editMode && (
            <div className="flex items-center gap-4 flex-wrap text-xs text-gray-500">
              {Object.entries(STATUS_STYLE).map(([key, s]) => (
                <span key={key} className="flex items-center gap-1.5 capitalize">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                  {key}
                </span>
              ))}
            </div>
          )}

          {/* Canvas */}
          <div
            ref={canvasRef}
            className={`relative w-full rounded-2xl border-2 overflow-hidden select-none ${
              editMode
                ? 'border-orange-300 bg-orange-50/30'
                : 'border-gray-200 bg-white'
            }`}
            style={{
              aspectRatio: '4 / 3',
              backgroundImage: editMode
                ? 'radial-gradient(circle, #d1d5db 1px, transparent 1px)'
                : undefined,
              backgroundSize: editMode ? '32px 32px' : undefined,
            }}
          >
            {placed.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300 text-sm gap-2">
                <span className="text-4xl">🪑</span>
                <span>{editMode ? 'Click tables below to place them on the floor' : 'No tables placed yet  -  switch to Edit mode'}</span>
              </div>
            )}

            {placed.map((table) => {
              const pos = positions[table.id];
              const st = statuses[table.id];
              const style = st ? STATUS_STYLE[st.status] : STATUS_STYLE.free;
              const isRound = pos.shape === 'round';
              const isDraggingThis = drag?.id === table.id;

              return (
                <div
                  key={table.id}
                  className={`absolute flex flex-col items-center justify-center border-2 shadow-sm transition-shadow select-none
                    ${isRound ? 'rounded-full' : 'rounded-xl'}
                    ${style.bg} ${style.border} ${style.text}
                    ${editMode ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : 'cursor-default'}
                    ${isDraggingThis ? 'shadow-xl ring-2 ring-orange-400 z-10 scale-105' : ''}
                  `}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    transform: 'translate(-50%, -50%)',
                    width: isRound ? '4.5rem' : '5.5rem',
                    height: isRound ? '4.5rem' : '4.5rem',
                  }}
                  onMouseDown={(e) => startDrag(e, table.id)}
                  onTouchStart={(e) => startDrag(e, table.id)}
                >
                  {/* Status dot */}
                  {!editMode && st && (
                    <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${style.dot}`} />
                  )}

                  <span className="font-bold text-sm leading-none">T{table.number}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">{table.seats} seats</span>

                  {/* Live info in view mode */}
                  {!editMode && st && st.status !== 'free' && (
                    <span className="text-[9px] opacity-60 mt-0.5 text-center px-1 leading-tight">
                      {st.orderCount > 0 && `${st.orderCount} ord`}
                      {st.sessionTotal > 0 && `  .  ${fmt(st.sessionTotal)}`}
                    </span>
                  )}
                  {!editMode && st && st.sessionStarted && (
                    <span className="text-[9px] opacity-50 leading-none">{elapsed(st.sessionStarted)}</span>
                  )}

                  {/* Edit controls */}
                  {editMode && (
                    <div
                      className="absolute -bottom-6 flex items-center gap-1"
                      onMouseDown={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => toggleShape(table.id)}
                        className="text-[9px] bg-white border border-gray-200 rounded px-1 py-0.5 text-gray-500 hover:bg-gray-100"
                        title="Toggle shape"
                      >
                        {pos.shape === 'rect' ? <ToggleLeft size={11} /> : <ToggleRight size={11} />}
                      </button>
                      <button
                        onClick={() => removeFromCanvas(table.id)}
                        className="text-[9px] bg-white border border-red-200 rounded px-1 py-0.5 text-red-400 hover:bg-red-50"
                        title="Remove from floor"
                      >
                        x
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Unplaced shelf */}
          {editMode && unplaced.length > 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Unplaced tables  -  click to add to floor
              </p>
              <div className="flex flex-wrap gap-2">
                {unplaced.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => placeOnCanvas(t.id)}
                    className="flex flex-col items-center justify-center w-16 h-14 rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                  >
                    <span className="font-bold text-sm">T{t.number}</span>
                    <span className="text-[10px] opacity-70">{t.seats} seats</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* View-mode: unplaced notice */}
          {!editMode && unplaced.length > 0 && (
            <p className="text-xs text-gray-400 text-center">
              {unplaced.length} table{unplaced.length > 1 ? 's' : ''} not yet placed on floor plan  - 
              switch to <span className="font-medium">Edit mode</span> to position them.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
