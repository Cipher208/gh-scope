## What changed

<!-- One paragraph. What was wrong or missing before, and what it does now. -->

## Why

<!-- The reasoning. If the diff is obvious, this can be short — but say
     something about why this approach rather than another. -->

## How it was checked

<!-- Tick what you actually ran. "Typecheck and build" is fine for a small
     change; for anything that renders, say what you looked at and at which
     width. -->

- [ ] `npm run typecheck` passes
- [ ] `npm run build` passes
- [ ] Checked in a browser at a narrow width (320–390px)
- [ ] Checked in both light and dark theme

## Screenshots

<!-- Before and after, if the change is visible. Delete this section otherwise. -->

## Notes for the reviewer

<!-- Anything you were unsure about, deliberately left out, or want a second
     opinion on. Saying "I was not sure about this part" is useful, not weak. -->

---

- [ ] One concern per pull request
- [ ] No new runtime dependencies (or the reason is explained above)
- [ ] No `dangerouslySetInnerHTML`, no raw HTML from untrusted text
- [ ] Commits have meaningful messages
