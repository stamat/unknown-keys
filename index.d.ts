export interface UnknownKey {
  /** Where the key sits: `''` at the root, `styles[1]`, `markup.options`. */
  path: string
  /** The key the schema does not describe. */
  key: string
  /** The keys that were allowed there, in the order the schema lists them. */
  valid: string[]
}

export declare function unknownKeys(value: unknown, schema: unknown): UnknownKey[]
