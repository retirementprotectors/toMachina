import { Router, type Request, type Response } from 'express'
import { errorResponse } from '../lib/helpers.js'

export const mdjRoutes = Router()

/**
 * POST /api/mdj/chat
 * SSE streaming endpoint for MDJ AI assistant.
 * Currently returns a placeholder response. Full AI integration
 * will be wired in the MDJ-ALPHA sprint.
 *
 * Request: { message: string, portal: string }
 * Response: SSE stream with data lines: { text?: string, tool?: string, status?: string }
 */
mdjRoutes.post('/chat', async (req: Request, res: Response) => {
  try {
    const body = req.body as Record<string, unknown>
    const message = String(body.message || '').trim()

    if (!message) {
      res.status(400).json(errorResponse('message is required'))
      return
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()

    // Stream a placeholder response
    const response = getPlaceholderResponse(message)

    for (const chunk of response) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`)
      // Small delay between chunks to simulate streaming
      await sleep(40)
    }

    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('POST /api/mdj/chat error:', err)
    // If headers already sent, just end the stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ text: '\n\nSorry, something went wrong.' })}\n\n`)
      res.end()
    } else {
      res.status(500).json(errorResponse(String(err)))
    }
  }
})

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getPlaceholderResponse(message: string): string[] {
  const lower = message.toLowerCase()

  if (lower.includes('pipeline') || lower.includes('cases') || lower.includes('status')) {
    return chunkText(
      "I can see you're asking about your pipeline. Once I'm fully connected " +
      "(MDJ-ALPHA sprint), I'll be able to pull your real-time pipeline data, " +
      "show case statuses, and help you prioritize. For now, check the Sales " +
      "Dashboard tab for your current pipeline view."
    )
  }

  if (lower.includes('quote') || lower.includes('annuity') || lower.includes('life') || lower.includes('medicare')) {
    return chunkText(
      "I'll be able to run quotes and product comparisons once the MDJ engine is " +
      "fully wired. In the meantime, you can use ATLAS in the main portal for " +
      "annuity illustrations and the Medicare Quote tool for MAPD/supplement comparisons."
    )
  }

  if (lower.includes('client') || lower.includes('look up') || lower.includes('find')) {
    return chunkText(
      "For client lookups, try the Clients tab — you can search by name and see " +
      "account details. Once MDJ is fully online, I'll be able to answer natural " +
      "language questions like \"What's Henderson's annuity balance?\" directly."
    )
  }

  return chunkText(
    "Hey! I'm MDJ — My Digital Josh. I'm not fully wired up yet (coming in the " +
    "MDJ-ALPHA sprint), but soon I'll be able to help with pipeline management, " +
    "client lookups, quote running, email drafting, and more. In the meantime, " +
    "check out the Sales Dashboard and Client Search tabs!"
  )
}

/** Split text into small chunks to simulate streaming. */
function chunkText(text: string): string[] {
  const words = text.split(' ')
  const chunks: string[] = []
  let current = ''
  for (const word of words) {
    current += (current ? ' ' : '') + word
    if (current.length >= 12) {
      chunks.push(current + ' ')
      current = ''
    }
  }
  if (current) chunks.push(current)
  return chunks
}
