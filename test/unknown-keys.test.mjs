// Covers: which keys unknownKeys reports and which it leaves alone — the
// closed object, the open one, the branch of a oneOf that fits, $ref through
// definitions and $defs, and the shapes that must never produce a finding
// because something outside this module owns the keys.
//
// Deliberately not covered: types, enums, ranges and required — this module
// reads key names and nothing else, so `{ "port": "4040" }` is not its finding.
// Remote $ref over http is not resolved and never will be; a pointer out of the
// document degrades to silence, which is asserted below.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { unknownKeys } from '../index.mjs'

const closed = {
  type: 'object',
  additionalProperties: false,
  properties: { in: { type: 'string' }, out: { type: 'string' } }
}

const at = (findings) => findings.map((f) => `${f.path}:${f.key}`)

test('names a key the schema has closed the door on', () => {
  assert.deepEqual(at(unknownKeys({ inn: 'a', out: 'b' }, closed)), [':inn'])
})

test('says nothing about a key in an object the schema left open', () => {
  const open = { type: 'object', properties: { in: { type: 'string' } } }
  assert.deepEqual(unknownKeys({ in: 'a', whatever: 1 }, open), [])
  assert.deepEqual(unknownKeys({ in: 'a', whatever: 1 }, { ...open, additionalProperties: true }), [])
})

test('lists the keys that were allowed, so the caller can name the fix', () => {
  assert.deepEqual(unknownKeys({ inn: 'a' }, closed)[0].valid, ['in', 'out'])
})

test('reports the root itself with an empty path', () => {
  assert.equal(unknownKeys({ inn: 'a' }, closed)[0].path, '')
})

test('walks into an array and puts the index in the path', () => {
  const schema = { type: 'object', properties: { styles: { type: 'array', items: closed } } }
  assert.deepEqual(at(unknownKeys({ styles: [{ in: 'a' }, { inn: 'b' }] }, schema)), ['styles[1]:inn'])
})

test('checks each position of a tuple against the schema written for it', () => {
  const other = { type: 'object', additionalProperties: false, properties: { name: {} } }
  const schema = { type: 'array', items: [closed, other] }
  assert.deepEqual(at(unknownKeys([{ inn: 'a' }, { nmae: 'b' }], schema)), ['[0]:inn', '[1]:nmae'])
})

test('picks the branch of a oneOf that fits the shape actually written', () => {
  const schema = { oneOf: [closed, { type: 'array', items: closed }] }
  assert.deepEqual(at(unknownKeys({ inn: 'a' }, schema)), [':inn'])
  assert.deepEqual(at(unknownKeys([{ inn: 'a' }], schema)), ['[0]:inn'])
})

test('stays silent where two branches fit equally, rather than guessing which was meant', () => {
  const other = { type: 'object', additionalProperties: false, properties: { name: {} } }
  assert.deepEqual(unknownKeys({ inn: 'a' }, { oneOf: [closed, other] }), [])
})

test('follows a $ref through definitions and through $defs alike', () => {
  const older = { definitions: { entry: closed }, properties: { a: { $ref: '#/definitions/entry' } } }
  const newer = { $defs: { entry: closed }, properties: { a: { $ref: '#/$defs/entry' } } }
  assert.deepEqual(at(unknownKeys({ a: { inn: 'x' } }, older)), ['a:inn'])
  assert.deepEqual(at(unknownKeys({ a: { inn: 'x' } }, newer)), ['a:inn'])
})

test('resolves a pointer anywhere in the document, not only under definitions', () => {
  const schema = { properties: { a: closed, b: { $ref: '#/properties/a' } } }
  assert.deepEqual(at(unknownKeys({ b: { inn: 'x' } }, schema)), ['b:inn'])
})

test('unescapes ~1 and ~0 in a pointer, so a key with a slash in it still resolves', () => {
  const schema = { definitions: { 'a/b~c': closed }, properties: { x: { $ref: '#/definitions/a~1b~0c' } } }
  assert.deepEqual(at(unknownKeys({ x: { inn: 'v' } }, schema)), ['x:inn'])
})

test('treats a key matched by patternProperties as one the schema knows', () => {
  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: { in: {} },
    patternProperties: { '^x-': {} }
  }
  assert.deepEqual(at(unknownKeys({ in: 'a', 'x-thing': 1, nope: 2 }, schema)), [':nope'])
})

test('says nothing at a level where a conditional could add the key it would accuse', () => {
  const conditional = { ...closed, if: { properties: { in: {} } }, then: { properties: { extra: {} } } }
  assert.deepEqual(unknownKeys({ extra: 1 }, conditional), [])
})

test('degrades to silence on a $ref pointing at nothing, rather than throwing', () => {
  const schema = { properties: { a: { $ref: '#/definitions/missing' } } }
  assert.deepEqual(unknownKeys({ a: { inn: 'x' } }, schema), [])
})

test('degrades to silence on a $ref that points at itself, rather than hanging', () => {
  const schema = { definitions: { loop: { $ref: '#/definitions/loop' } }, properties: { a: { $ref: '#/definitions/loop' } } }
  assert.deepEqual(unknownKeys({ a: { inn: 'x' } }, schema), [])
})

test('has nothing to say about a value that is not an object or an array', () => {
  assert.deepEqual(unknownKeys('a string', closed), [])
  assert.deepEqual(unknownKeys(null, closed), [])
  assert.deepEqual(unknownKeys(7, closed), [])
})

test('has nothing to say when there is no schema to say it from', () => {
  assert.deepEqual(unknownKeys({ inn: 'a' }, null), [])
  assert.deepEqual(unknownKeys({ inn: 'a' }, 'not a schema'), [])
})

test('reads a nested path as a reader would write it', () => {
  const schema = {
    type: 'object',
    properties: { markup: { type: 'object', properties: { options: closed } } }
  }
  assert.deepEqual(at(unknownKeys({ markup: { options: { inn: 'x' } } }, schema)), ['markup.options:inn'])
})
