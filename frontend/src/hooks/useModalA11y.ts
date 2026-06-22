import { useEffect, useRef, type RefObject } from 'react';
import { pushEscape } from '../lib/escapeStack';

interface Options {
  /** Element to focus when the dialog opens. Defaults to the first focusable. */
  initialFocusRef?: RefObject<HTMLElement | null>;
}

/**
 * Accessibility for modal dialogs:
 *  - closes on Escape (via a shared stack, so only the top-most overlay closes)
 *  - traps Tab focus inside the dialog
 *  - moves focus into the dialog on open and restores it on close
 *
 * Attach the returned ref to the dialog's content container and give that
 * container role="dialog" aria-modal="true".
 */
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  onClose: () => void,
  options?: Options,
) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const initialFocusRef = options?.initialFocusRef;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = ref.current;

    const focusable = () =>
      node
        ? Array.from(
            node.querySelectorAll<HTMLElement>(
              'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => el.offsetParent !== null)
        : [];

    // Move focus into the dialog (preferring a caller-specified target)
    (initialFocusRef?.current ?? focusable()[0] ?? node ?? undefined)?.focus?.();

    // Escape closes only the top-most overlay (shared stack)
    const popEscape = pushEscape(() => closeRef.current());

    // Tab focus trap
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey, true);
    return () => {
      popEscape();
      document.removeEventListener('keydown', onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [initialFocusRef]);

  return ref;
}
