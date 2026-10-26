/**
 * A small harness for tests that click through the real App.
 *
 * The DOM has to exist before react-dom is imported (helpers/dom.ts explains
 * why), so this file imports it first and re-exports the window. One window is
 * shared; mountApp() resets storage, hash and body so tests do not inherit each
 * other's state.
 */
import './dom.ts';
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import App from '../../src/App.tsx';
import { win } from './dom.ts';

export { win };

export interface AppHandle {
  root: Root;
  click: (label: string) => void;
  button: (label: string) => HTMLButtonElement;
  field: (label: string) => HTMLInputElement;
  type: (label: string, value: string) => void;
  text: () => string;
  count: (selector: string) => number;
  hashTo: (hash: string) => Promise<void>;
  /** Submit the form the field belongs to, the way Enter would. */
  submit: (label: string) => void;
  select: (label: string, value: string) => void;
}

let cleanup: Array<() => void> = [];

export const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 25));
  });

export function mountApp(seed?: () => void): AppHandle {
  win.localStorage.clear();
  win.sessionStorage.clear();
  win.location.hash = '';
  win.document.body.innerHTML = '';
  seed?.();

  const container = win.document.createElement('div');
  win.document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(createElement(App)));

  const button = (label: string): HTMLButtonElement => {
    const el = [...win.document.querySelectorAll('button')].find((b) => {
      const aria = (b.getAttribute('aria-label') ?? '').trim();
      const text = (b.textContent ?? '').trim();
      return aria === label || text.startsWith(label);
    });
    assert.ok(el, `no button labelled "${label}"`);
    return el as unknown as HTMLButtonElement;
  };

  // Inputs are labelled either by aria-label or by placeholder; both are how
  // this app names its fields, and neither is a real <label>.
  const field = (label: string): HTMLInputElement => {
    const el = [...win.document.querySelectorAll('input')].find(
      (i) => i.getAttribute('aria-label') === label || i.getAttribute('placeholder') === label,
    );
    assert.ok(el, `no input labelled "${label}"`);
    return el as unknown as HTMLInputElement;
  };

  const click = (label: string) => {
    const el = button(label);
    act(() => el.click());
  };

  const type = (label: string, value: string) => {
    const el = field(label);
    const setter = Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype, 'value')!.set!;
    act(() => {
      setter.call(el, value);
      el.dispatchEvent(new win.Event('input', { bubbles: true }));
    });
  };

  const select = (label: string, value: string) => {
    const el = [...win.document.querySelectorAll('select')].find(
      (s) => s.getAttribute('aria-label') === label,
    );
    assert.ok(el, `no select labelled "${label}"`);
    const target = el as unknown as HTMLSelectElement;
    act(() => {
      target.value = value;
      target.dispatchEvent(new win.Event('change', { bubbles: true }));
    });
  };

  const text = () => container.textContent ?? '';
  const count = (selector: string) => container.querySelectorAll(selector).length;

  // Several views put a plain "open" or "search" on both the tab and the submit
  // button, so "click the button labelled X" is ambiguous. Click the submit
  // button that belongs to this field's form instead — that is what a person
  // does, and it goes through the same path as pressing Enter.
  const submit = (label: string) => {
    const form = field(label).form;
    assert.ok(form, `the field "${label}" has no form`);
    const buttonEl = form.querySelector('button[type="submit"]');
    assert.ok(buttonEl, `the form around "${label}" has no submit button`);
    act(() => (buttonEl as HTMLButtonElement).click());
  };

  const hashTo = async (hash: string) => {
    win.location.hash = hash;
    win.dispatchEvent(new win.Event('hashchange'));
    await settle();
  };

  cleanup.push(() => {
    act(() => root.unmount());
    container.remove();
  });

  return { root, click, button, field, type, text, count, hashTo, submit, select };
}

export function withFetch(impl: (url: string) => Response | Promise<Response>): void {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => impl(String(input))) as unknown as typeof fetch;
  cleanup.push(() => {
    globalThis.fetch = real;
  });
}

export const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

export const failing = (status: number) => new Response('', { status });

// React's scheduler and happy-dom keep ports and timers alive; without this
// the file would finish its assertions and never exit.
after(() => {
  try {
    win.happyDOM.close();
  } catch {
    /* nothing to close on older happy-dom builds */
  }
  const handles = (process as unknown as { _getActiveHandles: () => unknown[] })._getActiveHandles();
  for (const h of handles) {
    const port = h as { unref?: () => void };
    if (typeof port.unref === 'function') port.unref();
  }
});

export function resetApp(): void {
  for (const fn of cleanup) fn();
  cleanup = [];
}
