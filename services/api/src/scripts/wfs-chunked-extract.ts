import Anthropic from '@anthropic-ai/sdk'
import { pdf } from 'pdf-to-img'
import fs from 'fs'
import dotenv from 'dotenv'
dotenv.config({ path: process.env.HOME + '/Projects/services/MCP-Hub/.env' })

async function extractChunk(client: Anthropic, buffer: Buffer, startPage: number, endPage: number): Promise<any> {
  const images: any[] = []
  let pageNum = 0
  const doc = await pdf(buffer, { scale: 1.5 })
  for await (const page of doc) {
    pageNum++
    if (pageNum < startPage) continue
    if (pageNum > endPage) break
    images.push({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: Buffer.from(page).toString('base64') } })
  }

  const content = [...images, { type: 'text' as const, text: 'Extract ALL structured data from these Woodbury Financial Services commission statement pages. Return complete JSON with every transaction, adjustment, commission, override, client name, policy number, product, amount, date. Include cycle dates, balance forwards, ending balances, recognition program data. Return ONLY valid JSON.' }]

  const resp = await client.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 16384, messages: [{ role: 'user', content }] })
  const text = (resp.content[0] as any).text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  return jsonMatch ? JSON.parse(jsonMatch[0]) : { _raw: text.substring(0, 3000) }
}

async function main() {
  const filePath = process.env.HOME + '/Downloads/WFS- Composite.pdf'
  const buffer = fs.readFileSync(filePath)
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const CHUNK_SIZE = 25
  const TOTAL_PAGES = 404
  const allChunks: any[] = []

  for (let start = 1; start <= TOTAL_PAGES; start += CHUNK_SIZE) {
    const end = Math.min(start + CHUNK_SIZE - 1, TOTAL_PAGES)
    process.stdout.write(`Chunk pages ${start}-${end}...`)
    try {
      const result = await extractChunk(client, buffer, start, end)
      allChunks.push(result)
      console.log(' OK')
    } catch (e: any) {
      console.log(' FAIL: ' + e.message.substring(0, 100))
      allChunks.push({ _error: e.message, _pages: `${start}-${end}` })
    }
    // Force GC between chunks
    if (global.gc) global.gc()
  }

  const output = { total_pages: TOTAL_PAGES, chunks: allChunks.length, chunk_results: allChunks }
  fs.writeFileSync(process.env.HOME + '/Downloads/wfs-composite-full-extract.json', JSON.stringify(output, null, 2))
  console.log('\nDone! ' + allChunks.length + ' chunks, ' + (JSON.stringify(output).length / 1024).toFixed(0) + ' KB')
}
main().catch(console.error)
