// Frontmatter for the blog's Markdown posts (src/content/blog/<slug>.md).
//
// The posts use a small, fixed subset of YAML, so this parses that subset
// instead of pulling in a YAML library:
//
//   key: "double-quoted string"     (\" \\ \n \t escapes)
//   key: 'single-quoted string'     ('' is a quote)
//   key: plain text or 42           (integers become numbers)
//   key: [a, "b, with comma", c]    (flow list on one line)
//   key:                            (block list: scalars or flat mappings)
//     - q: "..."
//       a: "..."
//
// Blank lines and lines starting with # are ignored. Anything else is an
// error that names the line, so a malformed post fails the build clearly.
//
// Plain JavaScript with relative imports only: the prerender script runs it
// under Node as well as in the browser bundle.

export class FrontmatterError extends Error {
  constructor(message, line) {
    super(line ? `line ${line}: ${message}` : message)
    this.name = 'FrontmatterError'
    this.line = line || null
  }
}

const KEY = /^([A-Za-z_][A-Za-z0-9_]*):(?:\s+(.*)|\s*)$/

function indentOf(line) {
  return line.length - line.trimStart().length
}

function isSkippable(line) {
  const t = line.trim()
  return t === '' || t.startsWith('#')
}

function parseDoubleQuoted(text, lineNo) {
  let out = ''
  let i = 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === '\\') {
      const next = text[i + 1]
      const map = { '"': '"', '\\': '\\', n: '\n', t: '\t', '/': '/' }
      if (!(next in map)) throw new FrontmatterError(`unsupported escape \\${next ?? ''}`, lineNo)
      out += map[next]
      i += 2
      continue
    }
    if (ch === '"') return { value: out, rest: text.slice(i + 1) }
    out += ch
    i += 1
  }
  throw new FrontmatterError('unterminated double-quoted string', lineNo)
}

function parseSingleQuoted(text, lineNo) {
  let out = ''
  let i = 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === "'") {
      if (text[i + 1] === "'") {
        out += "'"
        i += 2
        continue
      }
      return { value: out, rest: text.slice(i + 1) }
    }
    out += ch
    i += 1
  }
  throw new FrontmatterError('unterminated single-quoted string', lineNo)
}

function plainScalar(text) {
  const t = text.trim()
  if (/^-?\d+$/.test(t)) return Number(t)
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null' || t === '~') return null
  return t
}

/** A scalar value: quoted string, integer, boolean or plain text. */
function parseScalar(text, lineNo) {
  const t = text.trim()
  if (t.startsWith('"') || t.startsWith("'")) {
    const { value, rest } = t.startsWith('"')
      ? parseDoubleQuoted(t, lineNo)
      : parseSingleQuoted(t, lineNo)
    if (rest.trim() !== '' && !rest.trim().startsWith('#')) {
      throw new FrontmatterError(`unexpected text after the closing quote: ${rest.trim()}`, lineNo)
    }
    return value
  }
  // A trailing " # comment" on a plain scalar is a comment, as in YAML.
  const hash = t.search(/\s#/)
  return plainScalar(hash === -1 ? t : t.slice(0, hash))
}

/** [a, "b, c", 3] -> ['a', 'b, c', 3]. Nested lists are not supported. */
function parseFlowList(text, lineNo) {
  const t = text.trim()
  if (!t.endsWith(']')) throw new FrontmatterError('a list must end with ]', lineNo)
  const inner = t.slice(1, -1)
  const items = []
  let i = 0
  while (i < inner.length) {
    while (i < inner.length && /\s/.test(inner[i])) i += 1
    if (i >= inner.length) break
    let value
    let rest
    if (inner[i] === '"' || inner[i] === "'") {
      ;({ value, rest } =
        inner[i] === '"'
          ? parseDoubleQuoted(inner.slice(i), lineNo)
          : parseSingleQuoted(inner.slice(i), lineNo))
      const after = rest.trimStart()
      if (after !== '' && !after.startsWith(',')) {
        throw new FrontmatterError(`expected a comma between list items, found: ${after}`, lineNo)
      }
      i = inner.length - after.length + 1
    } else {
      const comma = inner.indexOf(',', i)
      const end = comma === -1 ? inner.length : comma
      const raw = inner.slice(i, end).trim()
      if (raw.startsWith('[') || raw.startsWith('{'))
        throw new FrontmatterError('nested lists are not supported', lineNo)
      value = plainScalar(raw)
      i = end + 1
    }
    if (value === '') throw new FrontmatterError('empty list item', lineNo)
    items.push(value)
  }
  return items
}

function parseValue(text, lineNo) {
  const t = text.trim()
  if (t.startsWith('[')) return parseFlowList(t, lineNo)
  if (t.startsWith('{'))
    throw new FrontmatterError('inline mappings are not supported; use a block list', lineNo)
  return parseScalar(t, lineNo)
}

/**
 * Parse the block list that follows `key:`. Returns the list and the index
 * of the first line after it.
 */
function parseBlockList(lines, start, parentIndent, firstLineNo) {
  const items = []
  let i = start
  let itemIndent = null
  while (i < lines.length) {
    const line = lines[i]
    const lineNo = firstLineNo + i
    if (isSkippable(line)) {
      i += 1
      continue
    }
    const indent = indentOf(line)
    if (indent <= parentIndent) break
    const t = line.trim()
    if (!t.startsWith('- ') && t !== '-') {
      throw new FrontmatterError('expected a list item starting with "- "', lineNo)
    }
    if (itemIndent === null) itemIndent = indent
    if (indent !== itemIndent) throw new FrontmatterError('list items must line up', lineNo)
    const content = t === '-' ? '' : t.slice(2).trim()
    const keyMatch = content.match(KEY)
    if (!keyMatch) {
      if (content === '') throw new FrontmatterError('empty list item', lineNo)
      items.push(parseValue(content, lineNo))
      i += 1
      continue
    }
    // A mapping item: "- k: v" then further "k: v" lines indented past the dash.
    const item = {}
    const fieldIndent = indent + 2
    item[keyMatch[1]] = keyMatch[2] === undefined ? null : parseValue(keyMatch[2], lineNo)
    if (item[keyMatch[1]] === null)
      throw new FrontmatterError(`no value for ${keyMatch[1]}`, lineNo)
    i += 1
    while (i < lines.length) {
      const next = lines[i]
      const nextNo = firstLineNo + i
      if (isSkippable(next)) {
        i += 1
        continue
      }
      const nextIndent = indentOf(next)
      if (nextIndent <= indent) break
      if (nextIndent !== fieldIndent)
        throw new FrontmatterError('fields of a list item must line up', nextNo)
      const m = next.trim().match(KEY)
      if (!m || m[2] === undefined)
        throw new FrontmatterError('expected "key: value" inside the list item', nextNo)
      if (m[1] in item) throw new FrontmatterError(`duplicate key ${m[1]}`, nextNo)
      item[m[1]] = parseValue(m[2], nextNo)
      i += 1
    }
    items.push(item)
  }
  return { items, next: i }
}

/**
 * Parse the YAML subset described above. `firstLineNo` is the file line of
 * text's first line, so error messages point into the post file.
 */
export function parseYamlSubset(text, firstLineNo = 1) {
  const lines = String(text).split(/\r?\n/)
  const data = {}
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const lineNo = firstLineNo + i
    if (isSkippable(line)) {
      i += 1
      continue
    }
    if (indentOf(line) !== 0) throw new FrontmatterError('unexpected indentation', lineNo)
    const m = line.match(KEY)
    if (!m) throw new FrontmatterError(`expected "key: value", found: ${line.trim()}`, lineNo)
    const key = m[1]
    if (Object.prototype.hasOwnProperty.call(data, key))
      throw new FrontmatterError(`duplicate key ${key}`, lineNo)
    if (m[2] !== undefined && m[2].trim() !== '') {
      data[key] = parseValue(m[2], lineNo)
      i += 1
      continue
    }
    const { items, next } = parseBlockList(lines, i + 1, 0, firstLineNo)
    if (!items.length) throw new FrontmatterError(`no value for ${key}`, lineNo)
    data[key] = items
    i = next
  }
  return data
}

/**
 * Split a post into its frontmatter data and Markdown body.
 * The file must start with a line of three dashes and close the block with
 * another one.
 */
export function parseFrontmatter(raw) {
  const text = String(raw ?? '').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/)
  if (lines[0].trim() !== '---')
    throw new FrontmatterError('the file must start with a --- line', 1)
  const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---')
  if (end === -1) throw new FrontmatterError('the frontmatter has no closing --- line')
  const data = parseYamlSubset(lines.slice(1, end).join('\n'), 2)
  const body = lines
    .slice(end + 1)
    .join('\n')
    .replace(/^\s*\n/, '')
  return { data, body, bodyLine: end + 2 }
}
