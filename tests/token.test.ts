/**
 * The token is the one credential this site holds, and where it is kept is the
 * difference between "XSS steals a session" and "XSS steals a password that
 * outlives the tab". These tests pin the storage choice and the migration.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TOKEN_KEY, readToken, writeToken, type TokenStore } from '../src/lib/token.ts';

type FakeStore = TokenStore & { data: Record<string, string> };

function store(initial: Record<string, string> = {}): FakeStore {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
  };
}

test('a token is read straight from the session store', () => {
  const session = store({ [TOKEN_KEY]: 'ghp_live' });
  const legacy = store({ [TOKEN_KEY]: 'ghp_old' });
  assert.equal(readToken(session, legacy), 'ghp_live');
  assert.equal(legacy.data[TOKEN_KEY], 'ghp_old', 'nothing to migrate when the session already has one');
});

test('a token left in localStorage moves to the session and leaves localStorage', () => {
  const session = store();
  const legacy = store({ [TOKEN_KEY]: 'ghp_old' });
  assert.equal(readToken(session, legacy), 'ghp_old');
  assert.equal(session.data[TOKEN_KEY], 'ghp_old');
  assert.equal(legacy.data[TOKEN_KEY], undefined, 'the persistent copy must be gone');
  assert.equal(readToken(store(), legacy), '', 'and it does not come back');
});

test('no token anywhere is an empty string, not null', () => {
  assert.equal(readToken(store(), store()), '');
  assert.equal(readToken(store()), '');
});

test('saving stores in the session; clearing removes it', () => {
  const session = store();
  writeToken(session, 'ghp_new');
  assert.equal(session.data[TOKEN_KEY], 'ghp_new');
  writeToken(session, '');
  assert.equal(session.data[TOKEN_KEY], undefined);
});

test('a disabled storage is survivable', () => {
  const broken: TokenStore = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
    removeItem: () => {
      throw new Error('denied');
    },
  };
  assert.equal(readToken(broken, broken), '');
  assert.doesNotThrow(() => writeToken(broken, 'ghp_x'));
});
