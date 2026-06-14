import { useRef, useEffect } from 'react';

const THRESHOLD = 60;  // px of pull needed to trigger refresh
const MAX_H     = 72;  // max indicator height in px

function findScrollParent(el: HTMLElement): HTMLElement {
  let p = el.parentElement;
  while (p) {
    const ov = getComputedStyle(p).overflowY;
    if (ov === 'auto' || ov === 'scroll') return p;
    p = p.parentElement;
  }
  return document.documentElement;
}

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ onRefresh, children, className }: Props) {
  const wrapRef      = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const ringRef      = useRef<HTMLDivElement>(null);

  // All gesture state lives in a ref — zero React re-renders during the drag
  const g = useRef({
    startY:     0,
    pulling:    false,
    refreshing: false,
    h:          0,
    scrollEl:   null as HTMLElement | null,
  });

  function applyH(h: number, animated: boolean) {
    const ind  = indicatorRef.current;
    const ring = ringRef.current;
    if (!ind || !ring) return;
    ind.style.transition = animated ? 'height 0.28s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
    ind.style.height = `${h}px`;
    g.current.h = h;
    if (!g.current.refreshing) {
      const pct = Math.min(1, h / THRESHOLD);
      ring.style.transform = `rotate(${pct * 270}deg)`;
      ring.style.opacity   = String(Math.min(1, pct * 1.5));
    }
  }

  function startSpin() {
    const ring = ringRef.current;
    if (!ring) return;
    ring.style.transform = '';
    ring.style.opacity   = '1';
    ring.style.animation = 'ptr-spin 0.7s linear infinite';
  }

  function stopSpin() {
    const ring = ringRef.current;
    if (!ring) return;
    ring.style.animation = 'none';
    ring.style.opacity   = '0';
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (g.current.refreshing) return;
      g.current.scrollEl = findScrollParent(el as HTMLElement);
      g.current.startY   = e.touches[0].clientY;
      g.current.pulling  = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (g.current.refreshing) return;
      const { scrollEl, startY } = g.current;
      if (!scrollEl || scrollEl.scrollTop > 2) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0) return;
      g.current.pulling = true;
      e.preventDefault();
      // Elastic resistance: grows fast at first, slows near MAX_H
      const h = Math.min(MAX_H, MAX_H * Math.sqrt(dy / (MAX_H * 1.8)));
      applyH(h, false);
    }

    function onTouchEnd() {
      if (!g.current.pulling) return;
      g.current.pulling = false;
      if (g.current.h >= THRESHOLD) {
        g.current.refreshing = true;
        startSpin();
        applyH(MAX_H, true);
        Promise.resolve(onRefresh()).finally(() => {
          g.current.refreshing = false;
          stopSpin();
          applyH(0, true);
        });
      } else {
        applyH(0, true);
      }
    }

    el.addEventListener('touchstart',  onTouchStart, { passive: true });
    el.addEventListener('touchmove',   onTouchMove,  { passive: false });
    el.addEventListener('touchend',    onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart',  onTouchStart);
      el.removeEventListener('touchmove',   onTouchMove);
      el.removeEventListener('touchend',    onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [onRefresh]);

  return (
    <div ref={wrapRef} className={className}>
      {/* Pull indicator */}
      <div
        ref={indicatorRef}
        aria-hidden="true"
        style={{ height: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          ref={ringRef}
          style={{
            width:        28,
            height:       28,
            borderRadius: '50%',
            border:       '2.5px solid #e5e7eb',
            borderTopColor: '#2a7344',
            opacity:      0,
          }}
        />
      </div>
      {children}
    </div>
  );
}
