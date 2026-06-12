import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  onClose: () => void;
}

type Pt = { x: number; y: number };

function ptDist(a: Pt, b: Pt) { return Math.hypot(b.x - a.x, b.y - a.y); }
function ptMid(a: Pt, b: Pt): Pt { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

export function ImageLightbox({ src, alt, onClose }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgWrapRef   = useRef<HTMLDivElement>(null);

  // Live transform state in a ref — avoids stale-closure issues in event handlers
  const tRef = useRef({ scale: 1, x: 0, y: 0 });

  // Gesture tracking state
  const gRef = useRef({
    ptrs:       new Map<number, Pt>(),
    startDist:  0,
    startScale: 1,
    startMid:   { x: 0, y: 0 } as Pt,
    startXY:    { x: 0, y: 0 } as Pt,
    lastTap:    0,
  });

  function apply(scale: number, x: number, y: number) {
    tRef.current = { scale, x, y };
    if (imgWrapRef.current) {
      imgWrapRef.current.style.transform = `translate(${x}px,${y}px) scale(${scale})`;
    }
  }

  // Keep the image inside the viewport when zoomed
  function clamp(scale: number, x: number, y: number) {
    const el = containerRef.current;
    if (!el) return { x, y };
    const maxX = Math.max(0, (el.clientWidth  * (scale - 1)) / 2);
    const maxY = Math.max(0, (el.clientHeight * (scale - 1)) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const container = el;
    const g = gRef.current;

    function down(e: PointerEvent) {
      e.preventDefault();
      container.setPointerCapture(e.pointerId);
      const pt: Pt = { x: e.clientX, y: e.clientY };
      g.ptrs.set(e.pointerId, pt);

      if (g.ptrs.size === 2) {
        const [a, b] = [...g.ptrs.values()];
        g.startDist  = ptDist(a, b);
        g.startScale = tRef.current.scale;
        g.startMid   = ptMid(a, b);
        g.startXY    = { x: tRef.current.x, y: tRef.current.y };
      } else {
        g.startMid = pt;
        g.startXY  = { x: tRef.current.x, y: tRef.current.y };

        // Double-tap: zoom in or reset
        const now = Date.now();
        if (now - g.lastTap < 280) {
          if (tRef.current.scale > 1.1) apply(1, 0, 0);
          else apply(2.5, 0, 0);
        }
        g.lastTap = now;
      }
    }

    function move(e: PointerEvent) {
      e.preventDefault();
      if (!g.ptrs.has(e.pointerId)) return;
      g.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (g.ptrs.size === 2) {
        const [a, b] = [...g.ptrs.values()];
        const newScale = Math.max(1, Math.min(5, g.startScale * ptDist(a, b) / g.startDist));
        const m = ptMid(a, b);
        const { x, y } = clamp(
          newScale,
          g.startXY.x + m.x - g.startMid.x,
          g.startXY.y + m.y - g.startMid.y,
        );
        apply(newScale, x, y);
      } else if (g.ptrs.size === 1 && tRef.current.scale > 1.05) {
        // Pan only when zoomed in
        const { x, y } = clamp(
          tRef.current.scale,
          g.startXY.x + e.clientX - g.startMid.x,
          g.startXY.y + e.clientY - g.startMid.y,
        );
        apply(tRef.current.scale, x, y);
      }
    }

    function up(e: PointerEvent) {
      g.ptrs.delete(e.pointerId);
      // After pinch ends keep one-finger pan starting from current position
      if (g.ptrs.size === 1) {
        const [remaining] = [...g.ptrs.values()];
        g.startMid = remaining;
        g.startXY  = { x: tRef.current.x, y: tRef.current.y };
      }
      // Snap back if slightly below 1x (rubber-band feel)
      if (g.ptrs.size === 0 && tRef.current.scale < 1.05) {
        apply(1, 0, 0);
      }
    }

    container.addEventListener('pointerdown',  down,  { passive: false });
    container.addEventListener('pointermove',  move,  { passive: false });
    container.addEventListener('pointerup',    up);
    container.addEventListener('pointercancel', up);
    return () => {
      container.removeEventListener('pointerdown',  down);
      container.removeEventListener('pointermove',  move);
      container.removeEventListener('pointerup',    up);
      container.removeEventListener('pointercancel', up);
    };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex items-center justify-center"
      style={{ touchAction: 'none' }}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/30"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      <p className="absolute bottom-8 inset-x-0 text-center text-white/40 text-xs pointer-events-none select-none">
        Pinch to zoom · Double-tap to reset
      </p>

      <div
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden"
        style={{ touchAction: 'none' }}
      >
        <div
          ref={imgWrapRef}
          style={{ willChange: 'transform', transformOrigin: 'center center' }}
        >
          <img
            src={src}
            alt={alt}
            draggable={false}
            style={{
              maxWidth: '100vw',
              maxHeight: '85vh',
              objectFit: 'contain',
              display: 'block',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}
