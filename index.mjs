// Keys a document carries that its JSON Schema does not describe — the typo an
// editor would have caught, reported so a CLI can name it. Key names only: this
// is not a validator, and deliberately never becomes one. See README.md.

// Keywords that can widen an object's key set in ways this module does not
// interpret. A level carrying one is skipped rather than accused: a false
// "unknown key" costs the reader more than a missed one.
const CONDITIONAL = ['if', 'then', 'else', 'dependentSchemas', 'dependencies', 'propertyNames']

// A local JSON pointer — `#/definitions/entry`, `#/$defs/entry`,
// `#/properties/a`. `~1` and `~0` are the escapes for `/` and `~` in a pointer
// key, and unescaping in that order is required: doing `~0` first would turn an
// escaped `~1` into a slash that was never meant to be one.
function pointer(ref, root) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null
  let node = root
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (!node || typeof node !== 'object' || !(key in node)) return null
    node = node[key]
  }
  return node
}

// Bounded: a schema whose $ref points at itself is a document nobody can
// validate, and hanging a build over one is worse than saying nothing.
function resolve(node, root, depth = 0) {
  if (!node || typeof node !== 'object' || !node.$ref || depth > 20) {
    return node && node.$ref ? null : node
  }
  return resolve(pointer(node.$ref, root), root, depth + 1)
}

function fits(node, value) {
  if (!node) return false
  if (Array.isArray(value)) return node.type === 'array' || Array.isArray(node.items) || 'items' in node
  return node.type === 'object' || !!node.properties || !!node.patternProperties
}

// The branch of a oneOf/anyOf/allOf describing the shape the value actually
// has. Exactly one match is the only case that can be read: two objects fitting
// equally means the document could be either, and there is no key set to judge
// against without validating types.
function shapeFor(node, value, root) {
  node = resolve(node, root)
  if (!node || typeof node !== 'object') return null
  const branches = node.oneOf || node.anyOf || node.allOf
  if (!branches || !Array.isArray(branches)) return node
  const matches = branches.map((branch) => shapeFor(branch, value, root)).filter((branch) => fits(branch, value))
  return matches.length === 1 ? matches[0] : null
}

function itemSchema(node, index) {
  if (Array.isArray(node.items)) return index < node.items.length ? node.items[index] : node.additionalItems
  return node.items
}

function known(node, key) {
  if (node.properties && key in node.properties) return true
  return Object.keys(node.patternProperties || {}).some((source) => {
    try {
      return new RegExp(source).test(key)
    } catch {
      return true // an unreadable pattern is the schema's problem, not this key's
    }
  })
}

function walk(value, node, root, path, found) {
  if (!value || typeof value !== 'object') return
  node = shapeFor(node, value, root)
  if (!node) return

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, itemSchema(node, index), root, `${path}[${index}]`, found))
    return
  }

  const closed = node.additionalProperties === false && !CONDITIONAL.some((keyword) => keyword in node)
  for (const [key, child] of Object.entries(value)) {
    if (node.properties && key in node.properties) walk(child, node.properties[key], root, path ? `${path}.${key}` : key, found)
    else if (closed && !known(node, key)) found.push({ path, key, valid: Object.keys(node.properties || {}) })
  }
}

/**
 * Find the keys a document carries that its schema does not describe.
 *
 * Only reports where the schema closes the object with
 * `additionalProperties: false` — anywhere else, somebody other than the schema
 * owns the key names, and saying otherwise would be a false accusation.
 *
 * @param {*} value The document — a parsed config, usually
 * @param {object} schema Its JSON Schema. Local `$ref` is resolved; remote is not
 * @returns {Array<{path: string, key: string, valid: string[]}>} One finding per
 *   stray key: where it sits (`''` at the root, `styles[1]`, `markup.options`),
 *   the key itself, and the keys that were allowed there
 *
 * @example
 * unknownKeys({ styles: [{ inn: 'a.scss' }] }, schema)
 * // => [{ path: 'styles[0]', key: 'inn', valid: ['in', 'out', 'options'] }]
 */
export function unknownKeys(value, schema) {
  if (!schema || typeof schema !== 'object') return []
  const found = []
  walk(value, schema, schema, '', found)
  return found
}
