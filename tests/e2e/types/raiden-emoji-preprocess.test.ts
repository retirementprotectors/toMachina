/**
 * RDN-EMOJI-CLASSIFIER — emoji-aware preprocessing for RAIDEN classifier.
 *
 * Pure tests (no network, no Firestore). Covers Unicode emoji, Slack-
 * style shortcodes, ZWJ sequences, skin-tone modifiers, and regression
 * cases from the "FEATURE_REQUEST: Add support for custom emojis"
 * mis-classification spree (2 days, 4 incorrect routes).
 */

import { describe, it, expect } from 'vitest'
import {
  preprocessForClassification,
  stripEmojisForClassifier,
} from '../../../services/api/src/raiden/emoji-preprocess'

describe('RDN-EMOJI-CLASSIFIER: preprocessForClassification', () => {
  it('passes emoji-free text through unchanged', () => {
    const r = preprocessForClassification('pipeline kanban is stuck on filter reset')
    expect(r.cleanText).toBe('pipeline kanban is stuck on filter reset')
    expect(r.emojis).toEqual([])
  })

  it('strips a single Unicode emoji and records it', () => {
    const r = preprocessForClassification('kanban broke 😡 when I filtered')
    expect(r.cleanText).toBe('kanban broke [emoji] when I filtered')
    expect(r.emojis).toContain('😡')
  })

  it('strips a run of consecutive Unicode emojis as one marker', () => {
    const r = preprocessForClassification('omg 😡😡😡 the form')
    expect(r.cleanText).toBe('omg [emoji] the form')
    // The full run is captured as one extracted token
    expect(r.emojis.length).toBe(1)
  })

  it('strips ZWJ-joined family sequence as one emoji', () => {
    // 👨‍👩‍👧 = man + ZWJ + woman + ZWJ + girl
    const r = preprocessForClassification('my family 👨‍👩‍👧 on the account page')
    expect(r.cleanText).toBe('my family [emoji] on the account page')
    expect(r.emojis.length).toBe(1)
  })

  it('strips skin-tone modified emoji as one run', () => {
    // 👋🏾 = waving hand + skin tone
    const r = preprocessForClassification('hi 👋🏾 bug on submit')
    expect(r.cleanText).toBe('hi [emoji] bug on submit')
    expect(r.emojis.length).toBe(1)
  })

  it('strips Slack shortcodes like :smile: and :raised_hands:', () => {
    const r = preprocessForClassification('reported bug :smile: in pipelines :raised_hands:')
    expect(r.cleanText).toContain('[emoji]')
    expect(r.cleanText).not.toContain(':smile:')
    expect(r.cleanText).not.toContain(':raised_hands:')
    expect(r.emojis.length).toBeGreaterThan(0)
  })

  it('handles mixed Unicode + Slack shortcodes in one message', () => {
    const r = preprocessForClassification('bug :rocket: in dashboard 🎉 help!')
    expect(r.cleanText).not.toContain('🎉')
    expect(r.cleanText).not.toContain(':rocket:')
    expect(r.cleanText).toContain('[emoji]')
  })

  it('preserves regular colon-delimited text that is not a shortcode', () => {
    // "3:45" is a time — should not be stripped as a shortcode
    const r = preprocessForClassification('outage started at 3:45 today')
    expect(r.cleanText).toContain('3:45')
    expect(r.emojis.length).toBe(0)
  })

  it('regression — "FEATURE_REQUEST: Add support for custom emojis" trigger text', () => {
    // The real message that tricked the classifier 4x. After preprocessing
    // the raw emojis should be gone; a classifier seeing "[emoji]" won't
    // latch onto "emojis" the way it did on the original characters.
    const input = 'submit button 🔴 looks weird on RIIMO 😬'
    const r = preprocessForClassification(input)
    expect(r.cleanText).toBe('submit button [emoji] looks weird on RIIMO [emoji]')
    // Verify no leaked raw emoji chars
    expect(/\p{Extended_Pictographic}/u.test(r.cleanText)).toBe(false)
  })

  it('handles empty / null / undefined without throwing', () => {
    expect(preprocessForClassification('')).toEqual({ cleanText: '', emojis: [] })
    expect(preprocessForClassification(null)).toEqual({ cleanText: '', emojis: [] })
    expect(preprocessForClassification(undefined)).toEqual({ cleanText: '', emojis: [] })
  })

  it('collapses redundant whitespace around markers', () => {
    const r = preprocessForClassification('word  😀   more   😀  text')
    // Should not have triple-spaces after substitution
    expect(r.cleanText).not.toMatch(/\s{2,}/)
  })
})

describe('RDN-EMOJI-CLASSIFIER: stripEmojisForClassifier shorthand', () => {
  it('returns only cleanText', () => {
    expect(stripEmojisForClassifier('bug 🐛 fixed 🔧')).toBe('bug [emoji] fixed [emoji]')
  })
  it('returns empty string for empty input', () => {
    expect(stripEmojisForClassifier('')).toBe('')
  })
})
