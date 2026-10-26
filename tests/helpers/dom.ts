/**
 * happy-dom must exist before react-dom is imported: react-dom records
 * `canUseDOM` at module load, and with no window at that moment its event
 * system never attaches — every click and every input event is silently lost.
 * A side-effect import at the top of a test file is the ordering guarantee.
 */
import { Window } from 'happy-dom';

export const win = new Window({ url: 'http://localhost/' });

const g = globalThis as unknown as Record<string, unknown>;
g.window = win;
g.document = win.document;
Object.defineProperty(g, 'navigator', { value: win.navigator, configurable: true });
g.localStorage = win.localStorage;
g.sessionStorage = win.sessionStorage;
g.requestAnimationFrame = win.requestAnimationFrame.bind(win);
g.cancelAnimationFrame = win.cancelAnimationFrame.bind(win);
(g as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom has no IntersectionObserver; the Reveal wrapper would throw.
// The stub reports "visible" on the next microtask.
g.IntersectionObserver = class {
  callback: IntersectionObserverCallback;
  constructor(cb: IntersectionObserverCallback) {
    this.callback = cb;
  }
  observe(target: Element) {
    queueMicrotask(() =>
      this.callback(
        [{ isIntersecting: true, target } as unknown as IntersectionObserverEntry],
        this as unknown as IntersectionObserver,
      ),
    );
  }
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
};
