// ---------------------------------------------------------------------------
// RAIDEN classifier emoji-aware preprocessing.
//
// Root cause (RDN-EMOJI-CLASSIFIER, 2026-04-15): auto-intake was routing
// emoji-containing messages to "FEATURE_REQUEST: Add support for custom
// emojis" four times in 48 hours. The classifier (MDJ haiku) latches on
// to the literal emoji characters and the decoration becomes content.
//
// Fix: strip emojis from the classifier's input text and replace each
// run with a single neutral marker. The classifier sees "user reported
// [emoji decoration] bug in pipeline kanban" instead of ":smile: :rocket:
// bug in pipeline kanban" — no longer mistakes decoration for a feature
// request. The extracted emoji list is preserved so downstream surfaces
// (triage reasoning, audit log) can still show what the user wrote.
//
// Handled encodings:
//   1. Unicode emoji        — U+1F300-U+1FAFF etc. via Extended_Pictographic
//   2. Slack shortcodes     — :party_parrot:, :raised_hands:, :+1:
//   3. Skin-tone modifiers  — the preceding emoji absorbs the modifier
//   4. Zero-width joiners   — sequence-level collapse to one marker
// ---------------------------------------------------------------------------

export interface EmojiPreprocessResult {
  /** Text with emoji sequences collapsed to `[emoji]` markers. */
  cleanText: string
  /** The raw emoji tokens extracted from the original, in order. */
  emojis: string[]
}

// Unicode "Extended_Pictographic" covers the ~3000 pictograph codepoints
// plus ZWJ-joined sequences. Using the `u` flag so surrogate pairs work.
// `\p{Extended_Pictographic}` includes dingbats, symbols, flags, etc.
// Variation selectors (U+FE0F) + ZWJ (U+200D) + skin tones (U+1F3FB-FF)
// bind to the preceding pictograph as a single run.
const UNICODE_EMOJI_RUN =
  /(?:\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*\s*)+/gu

// Slack-style shortcodes: `:smile:`, `:heavy_plus_sign:`, `:+1:`, `:raised_hand::skin-tone-3:`.
// Letters + digits + underscores + hyphens + plus between colons.
// Excludes lone colons + ratio patterns (`1:2`) via the `\s|^`/`\s|$` anchors.
const SHORTCODE_RUN =
  /(?:(?:^|\s):[a-zA-Z0-9_+-]+:)+/g

const EMOJI_MARKER = '[emoji]'

/**
 * Extract + neutralize emoji content from classifier input text.
 *
 * Returns both the cleaned string (sent to the classifier) and the
 * extracted emoji list (kept on the triage record for provenance).
 *
 * Empty string / missing input → empty result, not null. Callers don't
 * need to null-guard.
 */
export function preprocessForClassification(input: string | null | undefined): EmojiPreprocessResult {
  const text = input ?? ''
  if (!text) return { cleanText: '', emojis: [] }

  const emojis: string[] = []

  // Pass 1 — Unicode emoji runs → `[emoji]`
  let cleanText = text.replace(UNICODE_EMOJI_RUN, (match) => {
    const trimmed = match.trim()
    if (trimmed) emojis.push(trimmed)
    return ` ${EMOJI_MARKER} `
  })

  // Pass 2 — Slack shortcode runs → `[emoji]`. We keep the leading
  // whitespace so word boundaries aren't lost when the shortcode follows
  // a word without whitespace (rare but possible in Slack paste).
  cleanText = cleanText.replace(SHORTCODE_RUN, (match) => {
    const trimmed = match.trim()
    if (trimmed) emojis.push(trimmed)
    return ` ${EMOJI_MARKER} `
  })

  // Normalize whitespace so consecutive markers + stripped runs don't
  // balloon the token budget on the classifier.
  cleanText = cleanText.replace(/\s+/g, ' ').trim()

  return { cleanText, emojis }
}

/**
 * Shorthand: return only the cleaned text. For call sites that don't
 * care about the extracted emojis (most of them).
 */
export function stripEmojisForClassifier(text: string | null | undefined): string {
  return preprocessForClassification(text).cleanText
}
