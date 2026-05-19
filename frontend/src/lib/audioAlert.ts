/**
 * audioAlert — generates a pleasant "ding" sound via the Web Audio API.
 * No external audio file required.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new AudioContext();
    return ctx;
  } catch {
    return null;
  }
}

/** Play a short ascending double-ding notification sound. */
export function playNewOrderSound(): void {
  const ac = getCtx();
  if (!ac) return;

  const now = ac.currentTime;

  const playTone = (freq: number, start: number, duration: number) => {
    const osc  = ac.createOscillator();
    const gain = ac.createGain();

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type      = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    // Quick attack, then exponential decay
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.4, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.start(start);
    osc.stop(start + duration);
  };

  // Double ding: 880 Hz then 1100 Hz
  playTone(880,  now + 0.0, 0.35);
  playTone(1100, now + 0.2, 0.35);
}
