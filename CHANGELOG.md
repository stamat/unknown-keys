# Changelog

All notable changes to unknown-keys are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Contributing an entry

Write your change under `## [Unreleased]`, grouped under `### Added`,
`### Changed`, `### Fixed`, `### Deprecated`, `### Removed` or `### Security`.
Give the heading a short title after an em dash and open with one paragraph
saying what was wrong before:

```markdown
## [Unreleased] — timeouts are configurable

Every request used the same hardcoded thirty seconds, which is too long for a
health check and too short for an upload.

### Added

- ...
```

Write it for the person upgrading, not for the person who wrote the code. What
they need is what changed for them: a renamed option, a different default, an
error that is now thrown, output that moved.

On `script/publish`, `script/changelog` cuts this section into a released entry
in the same commit as the version bump, and the entry becomes the body of the
GitHub release verbatim.

## [Unreleased]

## [1.0.0] - 2026-08-05 — first release

A misspelt key in a config file is not an error: nothing reads `inn`, so nothing
complains, the entry it belonged to does nothing, and the missing output is the
only sign. Reaching for a validator answers a different question — `ajv` reports
that one typo as four errors and `@cfworker/json-schema` as eleven, neither says
what was allowed in its place, and both hand you a JSON pointer where a reader
needs `styles[0]`.

### Added

- **`unknownKeys(value, schema)`**, returning one finding per stray key —
  `{ path, key, valid }`, where `path` is `''` at the root and reads as
  `styles[1]` or `markup.options` further in, and `valid` is what the schema
  allowed there. Zero dependencies, Node 18+.

  It reports only where the schema closed the object with
  `additionalProperties: false`; an open object belongs to somebody else and is
  left alone, which is what keeps a config file shared with another tool quiet.
  Ambiguity is silence throughout: an unresolvable or circular `$ref`, a `oneOf`
  where two branches fit the value equally, or a level carrying
  `if`/`then`/`else`, `dependentSchemas` or `dependencies` all produce no
  finding rather than a false accusation.

  Understood: local `$ref` to any JSON pointer including `~0`/`~1` escapes,
  `definitions` and `$defs`, `oneOf`/`anyOf`/`allOf` — a closed level that also
  carries one keeps its own key set — `patternProperties` with the value under
  a matched key walked, arrays, tuple `items` with `additionalItems`, and the
  2020-12 `prefixItems`.
