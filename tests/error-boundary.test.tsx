/**
 * The crash screen lives behind a boundary, so the only way to test it is to
 * render a child that throws. Its copy is hardcoded English on purpose — the
 * screen must not depend on a language provider that may be the thing that
 * crashed — so the assertions read the literal strings.
 */
import './helpers/dom.ts';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { ErrorBoundary } from '../src/components/ErrorBoundary.tsx';
import { win } from './helpers/dom.ts';

let restore: Array<() => void> = [];

afterEach(() => {
  for (const fn of restore) fn();
  restore = [];
});

function mount(children: ReactNode) {
  win.document.body.innerHTML = '';
  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(createElement(ErrorBoundary, null, children)));
  restore.push(() => act(() => root.unmount()));
  return container;
}

test('a healthy tree renders through the boundary unchanged', () => {
  const container = mount(createElement('p', null, 'everything is fine'));
  assert.equal(container.textContent, 'everything is fine');
});

test('a throwing child is replaced by the crash screen, with the message', () => {
  const noisy = console.error;
  console.error = () => undefined;
  restore.push(() => {
    console.error = noisy;
  });

  function Explodes(): ReactNode {
    throw new Error('kaboom in RepoCard');
  }

  const container = mount(createElement(Explodes));
  const text = container.textContent ?? '';
  assert.ok(text.includes('kernel panic'), 'the screen names itself');
  assert.ok(text.includes('something crashed while rendering'));
  assert.ok(text.includes('kaboom in RepoCard'), 'the real message is shown, not a generic one');
  assert.ok(text.includes('reboot'), 'there is a way out');
});

test('reboot asks the browser to reload', () => {
  const noisy = console.error;
  console.error = () => undefined;
  let reloads = 0;
  const descriptor = Object.getOwnPropertyDescriptor(win.location, 'reload');
  Object.defineProperty(win.location, 'reload', {
    configurable: true,
    value: () => {
      reloads += 1;
    },
  });
  restore.push(() => {
    console.error = noisy;
    if (descriptor) Object.defineProperty(win.location, 'reload', descriptor);
  });

  function Explodes(): ReactNode {
    throw new Error('boom');
  }

  const container = mount(createElement(Explodes));
  const reboot = [...win.document.querySelectorAll('button')].find((b) =>
    (b.textContent ?? '').includes('reboot'),
  );
  assert.ok(reboot, 'the button is on screen');
  act(() => reboot!.click());
  assert.equal(reloads, 1);
});
