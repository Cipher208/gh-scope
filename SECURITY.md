# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Use GitHub's private reporting instead: go to the
[Security tab](https://github.com/Cipher208/gh-scope/security) →
**Report a vulnerability**. That opens a private advisory only you and the
maintainer can read, which means we can agree on a fix and a disclosure date
before anyone else knows.

If you cannot use that form, email **Cipher208@proton.me** with `gh-scope
security` in the subject.

A useful report contains: what the issue is, how to reproduce it, which browser
and version, and what an attacker gains. A proof of concept — even a short one —
turns a guess into a fix.

## What to expect

| Stage | Target |
| --- | --- |
| First reply | within 7 days |
| Assessment and severity | within 14 days |
| Fix for a confirmed issue | depends on severity; you will be told the plan |
| Credit | offered in the advisory unless you prefer to stay anonymous |

This is a small project maintained by one person in their own time. Those
numbers are intentions, not a contract — but you will always get an answer
rather than silence.

## Supported versions

The latest commit on `main` is the only supported version. There are no
released versions and no back-ports; the fix ships as a new commit and, for
anything deployed, a rebuilt site.

## How this application handles secrets

Understanding the design makes reports easier to judge:

- **There is no backend.** No server, no database, no accounts. The build is a
  folder of static files. There is nothing on the server side to compromise,
  because there is no server side.
- **No secrets in the repository.** All requests go from the browser straight
  to `api.github.com`. Nothing is compiled into the bundle that is not already
  public.
- **The GitHub token you optionally provide is stored in `localStorage`** and is
  sent only to `api.github.com`. It is never logged, never put in a URL, and
  never sent anywhere else.
- **Consequence, stated plainly:** a token in `localStorage` is exposed to any
  script running on the same origin. That is inherent to a client-side app with
  no backend, not a bug — but *escaping that sandbox is a bug*, and it is
  exactly the class of report this policy wants.

## In scope

- Cross-site scripting, in particular through the README renderer: repository
  READMEs are untrusted input and are rendered as React elements, with no
  `dangerouslySetInnerHTML` anywhere in the codebase. A way to execute script
  from a crafted README is a serious finding.
- Token exfiltration: any code path that sends the stored token to a host other
  than `api.github.com`, or that writes it to the console, to storage it should
  not reach, or into a URL.
- Supply chain: a vulnerable or malicious dependency, or a CI workflow that
  could be made to run untrusted code with write permissions.
- Anything that lets a page on another origin read what is in this app's
  `localStorage`.

## Out of scope

- The GitHub API's own rate limits, or being locked out of it.
- The fact that `localStorage` is readable by other scripts on the same origin —
  see above; that is the documented design.
- Vulnerabilities in GitHub itself, or in the services linked to (DeepWiki,
  GitDiagram, GitMCP, Google Translate, LibreTranslate).
- The undocumented `translate_a/single?client=gtx` endpoint being closed by
  Google. That is a known limitation, documented in the README, not a
  vulnerability.
- Denial of service against your own browser by viewing a very large README.
  The renderer has block and node limits, but this is not treated as a security
  boundary.
- Missing hardening headers that static hosting cannot set.

## For anyone self-hosting a fork

The token lives in `localStorage`, which is scoped to the origin you serve this
from. Serve it from a domain you control, keep it on HTTPS, and be careful about
what else you serve from that same origin — another page on it can read the
token. This is why the README warns against entering a token on a look-alike
host.
