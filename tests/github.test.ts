/**
 * The GitHub client is the only part of the app that talks to the network, and
 * it is the part whose failures are invisible until a visitor hits a wall: a
 * wrong URL, a swallowed rate limit or a 404 rendered as a generic error all
 * look like "the site is broken".
 *
 * These are characterisation tests: the code already behaves this way, and the
 * point is to make that behaviour a check that fails when someone changes it by
 * accident. No DOM, no framework — a stubbed fetch is enough.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  GHError,
  accountYears,
  compactNum,
  fetchReadme,
  fetchRepos,
  fetchUser,
  fullNum,
  langColor,
  monthYear,
  onRateLimit,
  searchRepos,
} from '../src/lib/github.ts';

type Captured = { url: string; init?: RequestInit };

/** Run `fn` with `fetch` replaced, restoring the real one afterwards. */
async function withFetch<T>(
  answer: (id: number) => Response | Promise<Response>,
  fn: (calls: Captured[]) => Promise<T>,
): Promise<T> {
  const calls: Captured[] = [];
  const real = globalThis.fetch;
  let id = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return answer(id++);
  }) as typeof fetch;
  try {
    return await fn(calls);
  } finally {
    globalThis.fetch = real;
  }
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  });

test('a login is encoded as one path segment', async () => {
  await withFetch(
    () => json({ login: 'x' }),
    async (calls) => {
      await fetchUser('a/b c', null);
      assert.equal(calls[0].url, 'https://api.github.com/users/a%2Fb%20c');
    },
  );
});

test('repos are requested with the documented page size and sort', async () => {
  await withFetch(
    () => json([]),
    async (calls) => {
      await fetchRepos('torvalds', null);
      assert.equal(
        calls[0].url,
        'https://api.github.com/users/torvalds/repos?per_page=100&sort=pushed',
      );
    },
  );
});

test('no token means no Authorization header, a token means Bearer', async () => {
  await withFetch(
    () => json({}),
    async (calls) => {
      await fetchUser('a', null);
      await fetchUser('a', 'tok_123');
      const headers = (i: number) => new Headers(calls[i].init?.headers);
      assert.equal(headers(0).get('authorization'), null);
      assert.equal(headers(1).get('authorization'), 'Bearer tok_123');
    },
  );
});

test('404 names the subject and says lookups are case-sensitive', async () => {
  await withFetch(
    () => new Response('', { status: 404 }),
    async () => {
      await assert.rejects(fetchUser('nobody', null), (e: unknown) => {
        assert.ok(e instanceof GHError);
        assert.equal(e.status, 404);
        assert.match(e.message, /User not found/);
        assert.match(e.message, /case-sensitive/);
        return true;
      });
    },
  );
});

test('403 and 429 both read as the rate limit, with both budgets named', async () => {
  for (const status of [403, 429]) {
    await withFetch(
      () => new Response('', { status }),
      async () => {
        await assert.rejects(fetchUser('a', null), (e: unknown) => {
          assert.ok(e instanceof GHError);
          assert.equal(e.status, status);
          assert.match(e.message, /60 requests\/hour/);
          assert.match(e.message, /5 000/);
          return true;
        });
      },
    );
  }
});

test('an unreachable network is status 0, not a crash', async () => {
  await withFetch(
    () => {
      throw new TypeError('fetch failed');
    },
    async () => {
      await assert.rejects(fetchUser('a', null), (e: unknown) => {
        assert.ok(e instanceof GHError);
        assert.equal(e.status, 0);
        assert.match(e.message, /Network error/);
        return true;
      });
    },
  );
});

test('rate-limit headers reach listeners, and unsubscribing stops them', async () => {
  const seen: Array<{ limit: number; remaining: number; reset: number; authenticated: boolean }> = [];
  const headers = {
    'x-ratelimit-limit': '60',
    'x-ratelimit-remaining': '37',
    'x-ratelimit-reset': '1761000000',
  };
  const stop = onRateLimit((r) => seen.push(r));
  await withFetch(
    () => json({}, { headers }),
    async () => {
      await fetchUser('a', null);
      stop();
      await fetchUser('a', null);
    },
  );
  assert.deepEqual(seen, [{ limit: 60, remaining: 37, reset: 1761000000, authenticated: false }]);
});

test('responses without rate headers emit nothing', async () => {
  let calls = 0;
  const stop = onRateLimit(() => (calls += 1));
  await withFetch(
    () => json({}),
    async () => {
      await fetchUser('a', null);
    },
  );
  stop();
  assert.equal(calls, 0);
});

test('search maps 403 to its own code and 422 to a query complaint', async () => {
  await withFetch(
    (i) => new Response('', { status: i === 0 ? 403 : 422 }),
    async () => {
      await assert.rejects(searchRepos('x', '', 'desc', 1, 30, null), /SEARCH_RATE/);
      await assert.rejects(searchRepos('x', '', 'desc', 1, 30, null), /rejected the query/);
    },
  );
});

test('search sends paging always and sorting only when asked', async () => {
  await withFetch(
    () => json({ total_count: 0, incomplete_results: false, items: [] }),
    async (calls) => {
      await searchRepos('react stars:>10', '', 'desc', 2, 30, null);
      await searchRepos('react', 'stars', 'asc', 1, 30, null);
      const first = new URL(calls[0].url);
      const second = new URL(calls[1].url);
      assert.equal(first.searchParams.get('q'), 'react stars:>10');
      assert.equal(first.searchParams.get('page'), '2');
      assert.equal(first.searchParams.get('per_page'), '30');
      assert.equal(first.searchParams.get('sort'), null);
      assert.equal(first.searchParams.get('order'), null);
      assert.equal(second.searchParams.get('sort'), 'stars');
      assert.equal(second.searchParams.get('order'), 'asc');
    },
  );
});

test('a README is asked for as raw text with an encoded ref', async () => {
  await withFetch(
    (i) => (i === 0 ? new Response('# hi', { status: 200 }) : new Response('', { status: 404 })),
    async (calls) => {
      const text = await fetchReadme('owner/repo', 'feat/x', null);
      assert.equal(text, '# hi');
      assert.equal(calls[0].url, 'https://api.github.com/repos/owner/repo/readme?ref=feat%2Fx');
      assert.equal(new Headers(calls[0].init?.headers).get('accept'), 'application/vnd.github.raw');
      await assert.rejects(fetchReadme('owner/repo', 'main', null), /No README found/);
    },
  );
});

test('the formatting helpers keep their shapes', () => {
  assert.equal(compactNum(329_452), '329.5K');
  assert.equal(fullNum(329_452), '329,452');
  assert.equal(monthYear('2011-09-01T00:00:00Z'), 'Sept 2011');
  assert.equal(accountYears(new Date(Date.now() - 2 * 365.25 * 24 * 3600 * 1000).toISOString()), 2);
  assert.equal(accountYears(new Date().toISOString()), 1, 'a brand-new account is never "0 years"');
  assert.equal(langColor('Python'), '#3572a5');
  assert.equal(langColor('Brainfuck'), '#8b98a9', 'unknown languages fall back to grey');
});
