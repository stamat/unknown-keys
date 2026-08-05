# unknown-keys

Report the keys a document carries that its JSON Schema does not describe.

```bash
npm i unknown-keys
```

```js
import { unknownKeys } from 'unknown-keys'

unknownKeys({ styles: [{ inn: 'src/a.scss', out: 'dist/a.css' }] }, schema)
// [{ path: 'styles[0]', key: 'inn', valid: ['in', 'out', 'options'] }]
```

Zero dependencies. Node 18+. It reads key names and nothing else.

## The problem

A misspelt key in a config file is not an error. Nothing reads `inn`, so nothing
complains about it — the tool runs, the entry it belonged to does nothing, the
file it should have written is missing, and you find out when you look.

Every config-driven CLI hits this, and most hand-roll the same answer. The ones
that reach for a validator get a different problem. Here is
[ajv](https://www.npmjs.com/package/ajv) on that document — four errors for one
typo:

```
/styles    [type]                  must be object
/styles/0  [required]              must have required property 'in'
/styles/0  [additionalProperties]  must NOT have additional properties  (params.additionalProperty: 'inn')
/styles    [oneOf]                 must match exactly one schema in oneOf
```

[@cfworker/json-schema](https://www.npmjs.com/package/@cfworker/json-schema) is
zero-dependency and just as correct, and reports the same typo in eleven errors,
with the key name inside an English sentence rather than a field.

Both are doing their job — that job is "is this document valid?". To turn either
into a sentence a user can act on you filter the cascade down to the
`additionalProperties` error, suppress the `required`, `type` and `oneOf` lines
the same typo caused, rewrite `/styles/0` as `styles[0]`, and then go walk the
schema yourself, because **neither one tells you what was allowed there** — and
that is the half the user actually needs.

This package skips to the end of that:

```
Unknown key "inn" in styles[0]. Valid: in, out, options
```

## Use it

`unknownKeys(value, schema)` returns one finding per stray key:

| Field | |
| --- | --- |
| `path` | Where the key sits: `''` at the root, `styles[1]`, `markup.options` |
| `key` | The key the schema does not describe |
| `valid` | The keys that were allowed there, in the order the schema lists them |

Rendering is yours — the wording belongs to your CLI, not to a library:

```js
for (const { path, key, valid } of unknownKeys(config, schema)) {
  console.warn(`Unknown key "${key}"${path ? ` in ${path}` : ''}. Valid: ${valid.join(', ')}`)
}
```

## What it will not accuse you of

**It reports only where the schema closed the object** with
`additionalProperties: false`. Anywhere else somebody other than the schema owns
those key names, and a warning would be a false accusation. That makes the
schema the place where ownership is declared:

```json
{
  "properties": {
    "styles": { "$ref": "#/definitions/styleEntry" },
    "images": {
      "type": "object",
      "additionalProperties": true,
      "description": "another tool's block — its keys, not mine"
    }
  }
}
```

`styles` is checked, `images` is left alone. A schema whose root is open the
same way — the shape you get when several tools share one config file — has its
unknown top-level keys pass in silence, while everything nested under a block
you *do* describe is still checked.

Silence over a false positive is the rule throughout. It says nothing when:

- two branches of a `oneOf` fit the value equally, so which key set was meant
  cannot be known without validating types;
- the level carries `if` / `then` / `else`, `dependentSchemas` or
  `dependencies`, any of which can widen the key set in ways this does not
  interpret;
- the object is closed only by `unevaluatedProperties: false`, which this does
  not interpret;
- a `$ref` points at something that is not there, or at itself.

Understood and handled: `$ref` to any local JSON pointer including `~0`/`~1`
escapes, `definitions` and `$defs`, `oneOf` / `anyOf` / `allOf` — a closed
level that also carries one keeps its own key set — `patternProperties` with
the value under a matched key walked, arrays, tuple `items` with
`additionalItems`, and the 2020-12 `prefixItems` tuple.

## What it is not

**Not a validator, and it does not become one.** It will not tell you that
`"port": "4040"` should be a number, that `sourcemap: "yes"` is not in the enum,
or that a required `out` is missing. That is a validator's job and there are
good ones: `@cfworker/json-schema` is zero-dependency and covers drafts 4, 7,
2019-09 and 2020-12; `ajv` is the one everybody already has.

They answer "is this document valid?". This answers "which key did the user
misspell, and what were they reaching for?" — and they compose: validate for
correctness, use this for the message.

**Not a spell-checker.** `valid` is the list; suggesting the nearest match from
it is one call to [leven](https://www.npmjs.com/package/leven) or
[didyoumean2](https://www.npmjs.com/package/didyoumean2) at the call site, where
the wording lives anyway.

**Not a remote resolver.** A `$ref` over http is not fetched and never will be.
If your schema has remote references, dereference it first with
[@apidevtools/json-schema-ref-parser](https://www.npmjs.com/package/@apidevtools/json-schema-ref-parser)
and pass the result.

## Changelog

Every release is written up in [CHANGELOG.md](CHANGELOG.md), newest first.

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) says what belongs here and what a pull
request needs.

## License

[MIT](LICENSE)
