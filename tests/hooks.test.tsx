/**
 * The three hooks in lib/hooks.tsx are all about time and motion: a scramble
 * that resolves, a counter that eases, a block that reveals when it scrolls in.
 * They are driven by requestAnimationFrame and IntersectionObserver, so the
 * tests own both: a frame queue the test pumps by hand, and an observer double
 * that reports exactly what the test says.
 *
 * Reduced motion is a branch in every one of them and is covered each time —
 * it is the branch a visitor with vestibular sensitivity actually gets.
 */
import './helpers/dom.ts';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { Reveal, useCountUp, useScramble } from '../src/lib/hooks.tsx';
import { win } from './helpers/dom.ts';

let pending: FrameRequestCallback[] = [];
let restore: Array<() => void> = [];

const g = globalThis as unknown as Record<string, unknown>;

g.requestAnimationFrame = (cb: FrameRequestCallback): number => {
  pending.push(cb);
  return pending.length;
};
g.cancelAnimationFrame = (): void => undefined;

function pump(now: number) {
  const batch = pending;
  pending = [];
  act(() => {
    for (const cb of batch) cb(now);
  });
}

function setReducedMotion(on: boolean) {
  const original = win.matchMedia;
  win.matchMedia = ((query: string) => ({
    matches: on && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof win.matchMedia;
  restore.push(() => {
    win.matchMedia = original;
  });
}

interface ObserverHit {
  cb: IntersectionObserverCallback;
  targets: Element[];
  disconnected: boolean;
}

let observers: ObserverHit[] = [];

function setObserverDouble() {
  const original = (globalThis as unknown as Record<string, unknown>).IntersectionObserver;
  observers = [];
  g.IntersectionObserver = class {
    hit: ObserverHit;
    constructor(cb: IntersectionObserverCallback) {
      this.hit = { cb, targets: [], disconnected: false };
      observers.push(this.hit);
    }
    observe(target: Element) {
      this.hit.targets.push(target);
    }
    unobserve() {}
    disconnect() {
      this.hit.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  };
  restore.push(() => {
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver = original;
  });
}

function mount(element: ReturnType<typeof createElement>) {
  win.document.body.innerHTML = '';
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(element));
  restore.push(() => act(() => root.unmount()));
  return container;
}

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
  pending = [];
});

test('useScramble settles on the text when motion is reduced', () => {
  setReducedMotion(true);
  function Probe() {
    return createElement('span', null, useScramble('hello'));
  }
  const container = mount(createElement(Probe));
  assert.equal(container.textContent, 'hello');
  assert.equal(pending.length, 0, 'no frames are scheduled when motion is reduced');
});

test('useScramble scatters glyphs and then resolves to the text', () => {
  setReducedMotion(false);
  const random = Math.random;
  Math.random = () => 0; // GLYPHS[0] === '!', so the intermediate frame is deterministic
  restore.push(() => {
    Math.random = random;
  });

  function Probe() {
    return createElement('span', null, useScramble('hello'));
  }
  const container = mount(createElement(Probe));
  assert.equal(container.textContent, 'hello', 'it starts from the real text');

  pump(performance.now());
  assert.equal(container.textContent, '!!!!!', 'mid-flight it is glyphs, not letters');

  // totalFrames for a five-character string is min(16 + 10, 64) = 26.
  for (let frame = 0; frame < 30; frame += 1) pump(performance.now());
  assert.equal(container.textContent, 'hello');
});

test('useCountUp eases from zero to the target and stops there', () => {
  setReducedMotion(false);
  // A frozen clock makes the three frames below exact: the hook anchors itself
  // at mount, so mount and the frames share the same clock.
  const realPerformance = (g as { performance?: unknown }).performance;
  let clock = 1000;
  g.performance = { now: () => clock };
  restore.push(() => {
    g.performance = realPerformance;
  });

  function Probe() {
    return createElement('span', null, String(useCountUp(1200)));
  }
  const container = mount(createElement(Probe));
  assert.equal(container.textContent, '0');

  pump(clock);
  assert.equal(container.textContent, '0', 'the first frame is the start');

  clock = 1450;
  pump(clock);
  const half = Number(container.textContent);
  assert.ok(half > 0 && half < 1200, `mid-animation value should be between: ${half}`);

  clock = 1900;
  pump(clock);
  assert.equal(container.textContent, '1200');
  assert.equal(pending.length, 0, 'the last frame schedules nothing');
});

test('useCountUp jumps straight to the target when motion is reduced', () => {
  setReducedMotion(true);
  function Probe() {
    return createElement('span', null, String(useCountUp(42)));
  }
  const container = mount(createElement(Probe));
  assert.equal(container.textContent, '42');
  assert.equal(pending.length, 0);
});

test('Reveal marks itself visible when the observer reports intersection', () => {
  setReducedMotion(false);
  setObserverDouble();
  const container = mount(createElement(Reveal, null, createElement('p', null, 'content')));
  const el = container.firstElementChild as HTMLElement;
  assert.ok(el.className.includes('reveal'));
  assert.ok(!el.className.includes('is-visible'), 'hidden until it is in view');

  const hit = observers[0];
  assert.equal(hit.targets[0], el, 'it observes its own element');
  act(() => hit.cb([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], {} as IntersectionObserver));
  assert.ok(el.className.includes('is-visible'));
  assert.equal(hit.disconnected, true, 'one reveal is enough, so the observer disconnects');
});

test('Reveal keeps its delay in a style, and skips the observer for reduced motion', () => {
  setReducedMotion(false);
  setObserverDouble();
  const delayed = mount(createElement(Reveal, { delay: 150 }, createElement('p', null, 'later')));
  const styled = delayed.firstElementChild as HTMLElement;
  assert.equal(styled.style.transitionDelay, '150ms');
  assert.equal(observers.length, 1, 'motion allowed: an observer is created');

  setReducedMotion(true);
  setObserverDouble();
  const calm = mount(createElement(Reveal, null, createElement('p', null, 'now')));
  const visible = calm.firstElementChild as HTMLElement;
  assert.ok(visible.className.includes('is-visible'), 'reduced motion shows the block immediately');
  assert.equal(observers.length, 0, 'and never constructs an observer');
});
