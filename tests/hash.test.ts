/**
 * The hash is the address of what is on screen: `#/torvalds` is a link someone
 * can send, bookmark or open in a new tab. On a cold load the app reads it, but
 * a link opened in an already-running tab only fires `hashchange` — and that is
 * the case these tests exist for.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loginFromHash, watchHash } from '../src/lib/hash.ts';

/** Just the three things the watcher is allowed to touch. */
function fakeWindow(hash = '') {
  const listeners = new Set<() => void>();
  return {
    location: { hash },
    addEventListener: (type: string, cb: () => void) => {
      if (type === 'hashchange') listeners.add(cb);
    },
    removeEventListener: (type: string, cb: () => void) => {
      if (type === 'hashchange') listeners.delete(cb);
    },
    navigate(next: string) {
      this.location.hash = next;
      for (const cb of [...listeners]) cb();
    },
    listenerCount: () => listeners.size,
  };
}

test('a login is read the way the address bar writes it', () => {
  assert.equal(loginFromHash('#/torvalds'), 'torvalds');
  assert.equal(loginFromHash('#torvalds'), 'torvalds');
  assert.equal(loginFromHash('#/tor%20valds'), 'tor valds');
  assert.equal(loginFromHash('#/'), '');
  assert.equal(loginFromHash(''), '');
  assert.equal(loginFromHash('#/%E0%A4%A'), '%E0%A4%A', 'a broken escape falls back to raw, not a crash');
});

test('a hash change in a running tab is delivered', () => {
  const win = fakeWindow('#/first');
  const seen: string[] = [];
  const stop = watchHash(win, (login) => seen.push(login));

  win.navigate('#/second');
  stop();
  win.navigate('#/third');

  assert.deepEqual(seen, ['second']);
  assert.equal(win.listenerCount(), 0, 'the listener is removed, not merely ignored');
});
