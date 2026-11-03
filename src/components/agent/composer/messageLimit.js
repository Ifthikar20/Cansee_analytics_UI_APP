// The longest message the server takes (services/runs.py MAX_MESSAGE_CHARS),
// counted the way it counts: code points of the trimmed text, without NULs.
export const MAX_MESSAGE_CHARS = 20000

// The counter shows from here, so the limit is visible before it is reached.
export const COUNT_FROM = 18000

function codePoints(text) {
  let count = 0
  for (let i = 0; i < text.length; i++) {
    const unit = text.charCodeAt(i)
    // A surrogate pair (most emoji) is one code point, as the server counts it.
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) i++
    }
    count++
  }
  return count
}

/** {count, near, over} for a draft: its length as the server will see it. */
export function messageLength(text) {
  const count = codePoints(String(text ?? '').replace(/\0/g, '').trim())
  return { count, near: count >= COUNT_FROM, over: count > MAX_MESSAGE_CHARS }
}

/** What the counter and the field's description say once `near`. */
export function lengthCopy({ count, over }) {
  const used = count.toLocaleString()
  const max = MAX_MESSAGE_CHARS.toLocaleString()
  return over
    ? {
        short: `Too long · ${used} / ${max}`,
        long: `This message is too long to send: ${used} characters, and messages can be at most ${max}.`,
      }
    : { short: `${used} / ${max}`, long: `${used} of ${max} characters used.` }
}
