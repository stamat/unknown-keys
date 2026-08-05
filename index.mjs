// Keys a document carries that its JSON Schema does not describe — the typo an
// editor would have caught, reported so a CLI can name it. Key names only: this
// is not a validator, and deliberately never becomes one. See README.md.

// Keywords that can widen an object's key set in ways this module does not
// interpret. A level carrying one is skipped rather than accused: a false
// "unknown key" costs the reader more than a missed one. propertyNames is not
// listed because it can only narrow the names allowed, never add one.
const CONDITIONAL = ['if', 'then', 'else', 'dependentSchemas', 'dependencies']

// A local JSON pointer — `#/definitions/entry`, `#/$defs/entry`,
// `#/properties/a`. `~1` and `~0` are the escapes for `/` and `~` in a pointer
// key, and unescaping in that order is required: doing `~0` first would turn an
// escaped `~1` into a slash that was never meant to be one.
function pointer(ref, root) {
  if (typeof ref !== 'string' || !ref.startsWith('#/')) return null
  let node = root
  for (const raw of ref.slice(2).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (!node || typeof node !== 'object' || !Object.hasOwn(node, key)) return null
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
  if (Array.isArray(value)) return node.type === 'array' || Array.isArray(node.items) || Array.isArray(node.prefixItems) || 'items' in node
  return node.type === 'object' || !!node.properties || !!node.patternProperties
}

// The branch of a oneOf/anyOf/allOf describing the shape the value actually
// has, used only to test whether a branch fits. Exactly one match is the only
// case that can be read: two objects fitting equally means the document could
// be either. Bounded like resolve, because a oneOf reached again through its
// own $ref recurses here forever and each hop is a fresh resolve the depth cap
// there never sees.
function shapeFor(node, value, root, depth = 0) {
  if (depth > 20) return null
  node = resolve(node, root)
  if (!node || typeof node !== 'object') return null
  const branches = node.oneOf || node.anyOf || node.allOf
  if (!branches || !Array.isArray(branches)) return node
  const matches = branches.map((branch) => shapeFor(branch, value, root, depth + 1)).filter((branch) => fits(branch, value))
  return matches.length === 1 ? matches[0] : null
}

// prefixItems is the 2020-12 spelling of a tuple; when it is present, items
// describes the positions after the prefix, not the whole array.
function itemSchema(node, index) {
  if (Array.isArray(node.prefixItems)) return index < node.prefixItems.length ? node.prefixItems[index] : node.items
  if (Array.isArray(node.items)) return index < node.items.length ? node.items[index] : node.additionalItems
  return node.items
}

// Every patternProperties schema whose pattern matches the key — the spec
// applies all of them, so all are walked. Null when a pattern will not compile:
// an unreadable pattern is the schema's problem, not any key's, so every key at
// the level is treated as known.
function patternSchemas(node, key) {
  const matched = []
  for (const [source, sub] of Object.entries(node.patternProperties || {})) {
    try {
      if (new RegExp(source).test(key)) matched.push(sub)
    } catch {
      return null
    }
  }
  return matched
}

// `seen` holds the schema objects already applied to this exact level, so
// branches cycling back — A's oneOf naming B, B's naming A — stop instead of
// recursing forever. Descent into a property or an item starts a fresh set.
function walk(value, node, root, path, found, seen = new Set()) {
  if (!value || typeof value !== 'object') return
  node = resolve(node, root)
  if (!node || typeof node !== 'object' || seen.has(node)) return
  seen.add(node)

  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, itemSchema(node, index), root, `${path}[${index}]`, found))
  } else {
    const closed = node.additionalProperties === false && !CONDITIONAL.some((keyword) => keyword in node)
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key
      if (node.properties && Object.hasOwn(node.properties, key)) {
        walk(child, node.properties[key], root, childPath, found)
        continue
      }
      const patterns = patternSchemas(node, key)
      if (patterns === null || patterns.length) {
        for (const sub of patterns || []) walk(child, sub, root, childPath, found)
        continue
      }
      // additionalProperties as a schema is the map keyed by a name its author
      // chooses — resources, fields, environments. The name is theirs and is
      // never a finding; what it holds is described, so it is walked.
      if (node.additionalProperties && typeof node.additionalProperties === 'object') {
        walk(child, node.additionalProperties, root, childPath, found)
        continue
      }
      if (closed && !found.some((finding) => finding.path === path && finding.key === key)) {
        found.push({ path, key, valid: Object.keys(node.properties || {}) })
      }
    }
  }

  // additionalProperties sees only the properties beside it, so the level's own
  // key set above applies no matter what its oneOf/anyOf/allOf decides; the one
  // branch fitting the value's shape is then applied on top. Both can close the
  // object and accuse the same key, which is why the push above deduplicates.
  const branches = node.oneOf || node.anyOf || node.allOf
  if (Array.isArray(branches)) {
    const matches = branches.filter((branch) => fits(shapeFor(branch, value, root), value))
    if (matches.length === 1) walk(value, matches[0], root, path, found, seen)
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
