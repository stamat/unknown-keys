# unknown-keys — agent notes

Reports the keys a document carries that its JSON Schema does not describe.
Read [CONTRIBUTING.md](CONTRIBUTING.md) first — it defines what belongs in this
project and what a pull request needs.

## Commands

```bash
script/bootstrap # npm ci
script/test      # node --test over test/
script/lint      # eslint (the authority; CI runs it)
script/build     # exits 0 — the package ships its source
```

## Layout

- `index.mjs` is the whole library: one export, no dependencies, nothing else
  ships except the types.
- `index.d.ts` is **hand-written**, not generated. A change to the return shape
  is a change to both files or it is half done.
- Tests live in `test/`, run by `node --test`. There is no test framework, and
  adding one needs a reason no assertion here has needed yet.

## Documentation

[README.md](README.md) is the whole documentation, and its first job is the
comparison against a validator — that section is the argument for the package
existing, so a change to the finding shape has to be reflected there.

- **Document in the same change as the code.** Behaviour not in README.md does
  not exist to anyone who did not write it.
- **Edit the section that already covers it.** No new files, no migration notes
  nobody asked for.
- **Every number in the README was measured.** The error counts quoted from
  `ajv` and `@cfworker/json-schema` came from running them; if what they are
  compared against changes, run them again rather than adjusting the prose.

## Principles

- **Test-driven.** The test is the spec; write it first. A failing test means
  the code is wrong — never weaken, skip, or delete a test to make it pass. If
  the test itself is wrong, say so and let review decide.
- **Silence over a false positive.** Every ambiguity — an unresolvable `$ref`, a
  `oneOf` where two branches fit, a conditional keyword that can widen the key
  set — reports nothing. A key wrongly called unknown costs the reader more than
  one that slips through, and that trade is the whole design.
- **YAGNI.** Build only what the task needs — no speculative options,
  abstractions, or "for later" scaffolding.
- **Zero dependencies.** Not "few". The package is small enough that a
  dependency would be most of it.
- **Delete dead code.** No commented-out blocks, no "for later" exports — git
  remembers.

## Boundaries

- **Always:** run `script/lint` and `script/test` before calling work done;
  pair every fix or feature with a test; add a changelog entry under
  `## [Unreleased]`.
- **Ask first:** changing the finding shape (`path`, `key`, `valid`) — it is
  the entire public API; adding a dependency; supporting a JSON Schema keyword
  that changes what gets reported.
- **Never:** add a dependency for what a few lines do; weaken, skip, or delete
  a test to make it pass; bump the version or publish — `script/publish` and a
  tag do that.

## Before adding a feature

Run this checklist before writing any code; stop at the first "no".

1. **Is it validation?** Types, enums, ranges, `required`, remote `$ref` — then
   the answer is a validator (`@cfworker/json-schema`, `ajv`), not this. Say so
   and stop.
2. **Does it make the report wrong more often than right?** A keyword
   interpreted half-way produces false accusations, which this package would
   rather not make at all.
3. **Search for prior art.** How do validators and language servers expose it,
   and what do they call it? Cite what you found — a URL per fact, no guesses.
4. **Still yes?** Build the smallest version that works.

## Non-obvious rules

- **`shapeFor` returning `null` is the silence rule, not a bug.** It means no
  single branch of a `oneOf`/`anyOf`/`allOf` fit the value, so there is no key
  set to judge against. Making it guess is how false positives get in.
- **Pointer unescaping order matters.** `~1` is replaced before `~0`; the other
  way round turns an escaped `~1` into a slash that was never meant to be one.
- **`additionalProperties: false` is the only trigger.** `true` and absent both
  mean somebody else owns those key names — that is how a config file shared
  with another tool's block stays quiet.
