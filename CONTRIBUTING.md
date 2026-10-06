# Contributing to gh-scope

Thanks for wanting to help. This is a small project, and the most useful thing
you can bring is a clear description of something that is wrong or missing.

## Ways to contribute

- **Report a bug** — open an issue using the bug template. Include your browser
  and version, what you expected, what happened, and the steps in between.
- **Suggest a feature** — open an issue using the feature template. Describe the
  annoyance you have, not the implementation you imagine; the annoyance is the
  part that is hard to guess.
- **Send a pull request** — for bugs, small improvements, accessibility fixes
  and documentation. For anything that changes the shape of the app, open an
  issue first so we agree on the direction before you spend your evening on it.
- **Translate** — the interface ships in EN and RU. Another language is a
  self-contained contribution: one object in `src/lib/i18n.tsx`.

## Development

Requirements: **Node 22 or newer**.

```bash
git clone https://github.com/Cipher208/gh-scope.git
cd gh-scope
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | `tsc --noEmit` — no output means clean |
| `npm test` | Bundles `tests/` with esbuild and runs it under `node --test` |

### Before you open a pull request

Run all three, and make sure they pass:

```bash
npm run typecheck
npm test
npm run build
```

The suite is small and covers what is dangerous rather than what is easy: the
README renderer consumes text written by strangers, and the tests there attack
it with hostile markdown. If you change `src/lib/markdown.tsx`, expect those
tests to be the first thing that reacts, and please add the case you found.

Verification beyond that is still human: the typecheck, the build, and actually
clicking through the thing in a browser. If your change touches rendering,
check it at a narrow width (320–390px) as well as a wide one, and in both the
light and dark theme. A pull request that widens the test coverage — the
GitHub API layer in `src/lib/github.ts` has none — would be very welcome.

### What CI checks

Every pull request runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
install from the lockfile, typecheck, build, and confirm the bundle is actually
complete. If it is red, the reason is in the log — no need to guess.

## Pull request expectations

- **One concern per pull request.** Two unrelated fixes in one branch are two
  pull requests that happen to share a diff.
- **Explain the why.** The diff shows what changed; the description should say
  what was wrong before and how you know it is fixed now.
- **Match the code around you.** The codebase uses tabs-free 2-space
  indentation, single quotes, semicolons, and comments that explain reasoning
  rather than restating the line. Where a decision looks odd, there is usually a
  comment saying why — please do not remove those.
- **No new runtime dependencies without a conversation.** The app deliberately
  ships with nothing but React at runtime. A dependency is a maintenance
  commitment, and it needs a justification better than convenience.
- **Keep it accessible.** Keyboard reachable, real `<button>` and `<a>` elements,
  visible contrast, and labels on inputs. Interfaces that only work with a mouse
  are considered broken.

## Project layout

```
src/
  App.tsx              routing, header, theme, token plumbing
  components/          one file per view or dialog
  lib/
    github.ts          every GitHub API call lives here
    translate.ts       translation transports and caching
    markdown.tsx       README renderer (React elements, never raw HTML)
    i18n.tsx           EN and RU strings
  index.css            Tailwind entry and theme tokens
tests/                 bundled and run by scripts/run-tests.mjs
public/                served as-is (favicon)
```

Two rules worth knowing before you touch things:

1. **Network calls belong in `src/lib/`**, not in components. All GitHub
   requests go through the single `API` constant in `github.ts`.
2. **Never render untrusted text as HTML.** READMEs come from arbitrary
   repositories. The renderer builds React elements, and there is no
   `dangerouslySetInnerHTML` in the codebase.

And one that is easy to miss, because React does not warn about it: **escape
hatches do not escape.** React will happily render `<a href="javascript:…">`
from a README, and clicking it runs in this origin, where the reader's token
lives. Every URL that reaches an `href` or `src` goes through `safeHref` /
`safeSrc` in `markdown.tsx` — if you add a new place that renders a link or an
image, route it through them too.

## Reporting security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Code of Conduct

By participating you agree to the
[Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## License

Contributions are accepted under the [MIT License](LICENSE), the same terms the
project already carries.
