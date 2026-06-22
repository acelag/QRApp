// Shared "Escape key" stack so that with nested overlays (e.g. an image
// lightbox opened over a product modal) only the TOP-MOST overlay closes on
// Escape — regardless of which mounted first. Each overlay pushes a close
// handler on mount and pops it on unmount; a single capture-phase listener
// dispatches Escape to the top of the stack only.

const stack: Array<() => void> = [];
let bound = false;

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  const top = stack[stack.length - 1];
  if (top) {
    e.preventDefault();
    e.stopPropagation();
    top();
  }
}

/** Register a close handler as the current top overlay. Returns an unregister fn. */
export function pushEscape(handler: () => void): () => void {
  if (!bound) {
    document.addEventListener('keydown', onKeydown, true);
    bound = true;
  }
  stack.push(handler);
  return () => {
    const i = stack.lastIndexOf(handler);
    if (i >= 0) stack.splice(i, 1);
  };
}
