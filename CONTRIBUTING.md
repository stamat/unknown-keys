# Contributing to unknown-keys

Issues and pull requests are welcome. Taking part means keeping to the
[Code of Conduct](CODE_OF_CONDUCT.md).

This package answers one question: which keys does a document carry that its
JSON Schema does not describe, and what was allowed in their place. It is not a
validator and will not become one — no types, no enums, no ranges, no `required`,
no remote `$ref`, and no fuzzy "did you mean" suggestion, because the nearest
match is one call to `leven` at a call site that owns the wording anyway. It
takes no dependencies. A change that would add any of those belongs in the
validator you compose this with, not here; a change that makes it report a key
the schema did not clearly close is a bug, because a false accusation costs the
reader more than a missed typo.

## Getting set up

```bash
git clone https://github.com/stamat/unknown-keys.git
cd unknown-keys
script/bootstrap
```

```bash
script/test      # node --test over test/
script/lint      # eslint (the authority; CI runs it)
script/build     # exits 0 — the package ships its source
```

`index.mjs` is the whole library and `index.d.ts` is written by hand beside it,
so a change to the return shape has to be made in both. `script/test` is the one
command that proves a change works.

## Reporting a bug

[Open an issue](../../issues/new/choose) — the form asks for what you ran, what
you expected, the version and the environment, because those are the four things
every fix starts from. A reproduction is worth more than a description of one.

## Pull requests

- **Add a test.** A bug fix gets a test that fails without the fix.
- **Match the surrounding style.** `script/lint` is the authority, and CI runs it.
- **Add a changelog entry** under `## [Unreleased]` in
  [CHANGELOG.md](CHANGELOG.md) — that file explains the format.
- **Keep the diff about one thing.** A rename bundled with a fix is two reviews
  wearing one hat.
- **Agent-written code is welcome — you still own it.** It meets the same bar
  as handwritten code: tests, lint, CI green. You understand every line well
  enough to answer review questions; "the agent wrote it" is not an answer.
  Point your agent at [AGENTS.md](AGENTS.md) before it starts.

Commit messages are freeform, write something that says what changed.

## How a release works

Maintainer flow, recorded here so the automation isn't a mystery:

`script/publish [version]` takes the current version from the last `v*` tag,
writes the new one with `script/version`, runs `script/changelog` to cut
`[Unreleased]` into a released entry, builds, commits, tags and pushes. Pushing
the tag triggers [publish.yml](.github/workflows/publish.yml), which publishes
via trusted publishing — OIDC, no tokens stored anywhere. The changelog entry
becomes the body of the GitHub release verbatim.
