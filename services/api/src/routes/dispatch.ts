/**
 * Dispatch Route — RON-HD01
 * POST /api/dispatch — classify incoming text and return CXO routing target.
 */

import { Router } from 'express'
import { dispatchItem } from '../raiden/hub-dispatcher.js'
import type { DispatchChannel } from '@tomachina/core'

export const dispatchRoutes = Router()

// POST /api/dispatch — classify text, return CXO target
dispatchRoutes.post('/', async (req, res) => {
  const { text, channel } = req.body as { text?: string; channel?: DispatchChannel }

  if (!text || typeof text !== 'string') {
    res.status(400).json({ success: false, error: 'text is required' })
    return
  }

  try {
    const result = await dispatchItem(text, channel || 'slack')
    res.json({ success: true, data: result })
  } catch (err) {
    console.error('[dispatch] Classification error:', err)
    res.status(500).json({ success: false, error: 'Dispatch classification failed' })
  }
})
