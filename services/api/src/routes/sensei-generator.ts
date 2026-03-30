/**
 * SENSEI Training HTML Generator — TRK-SNS-010
 *
 * Reads screenshots from Storage + stats from Firestore + content metadata.
 * Generates self-contained training HTML per module.
 *
 * POST /api/sensei/generate/:moduleId — generate training HTML
 */

import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'
import type { SenseiContent } from '@tomachina/core'

export const senseiGeneratorRoutes = Router()
const COLLECTION = 'sensei_content'

/** POST /generate/:moduleId — generate training HTML */
senseiGeneratorRoutes.post('/generate/:moduleId', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const doc = await db.collection(COLLECTION).doc((req.params.moduleId as string)).get()
    if (!doc.exists) {
      res.status(404).json(errorResponse(`Module ${(req.params.moduleId as string)} not found`))
      return
    }

    const content = doc.data() as SenseiContent
    const now = new Date().toISOString()

    // Generate training HTML
    const html = generateTrainingHTML(content)

    // Store generation metadata
    await db.collection(COLLECTION).doc((req.params.moduleId as string)).update({
      last_generated: now,
      updated_at: now,
      version: (content.version || 0) + 1,
    })

    // Store generated HTML in sensei_training collection
    await db.collection('sensei_training').doc((req.params.moduleId as string)).set({
      module_id: (req.params.moduleId as string),
      html,
      generated_at: now,
      version: (content.version || 0) + 1,
    })

    res.json(successResponse({
      module_id: (req.params.moduleId as string),
      status: 'generated',
      last_generated: now,
      html_length: html.length,
    }))
  } catch (err) {
    res.status(500).json(errorResponse(String(err)))
  }
})

function generateTrainingHTML(content: SenseiContent): string {
  const screenshots = content.screenshot_urls.map((url, i) =>
    `<div class="screenshot"><img src="${url}" alt="Step ${i + 1}" /><p class="caption">Step ${i + 1}</p></div>`
  ).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Training: ${content.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 24px; color: #1e293b; }
    h1 { color: #f59e0b; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; }
    .meta { color: #64748b; font-size: 13px; margin-bottom: 24px; }
    .screenshot { margin: 16px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
    .screenshot img { width: 100%; display: block; }
    .caption { padding: 8px 12px; background: #f8fafc; font-size: 12px; color: #64748b; }
    .description { line-height: 1.6; margin: 16px 0; }
  </style>
</head>
<body>
  <h1>SENSEI Training: ${content.title}</h1>
  <div class="meta">
    Template: ${content.template_type} | Version: ${content.version} | Generated: ${content.last_generated || 'Never'}
  </div>
  <div class="description">${content.description}</div>
  ${screenshots || '<p style="color: #94a3b8;">No screenshots available yet. Run E2E tests to generate.</p>'}
</body>
</html>`
}
