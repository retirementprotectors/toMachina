// MDJ Mobile API routes now live — trigger deploy
import { Router, type Request, type Response } from 'express'
import { getFirestore } from 'firebase-admin/firestore'
import { successResponse, errorResponse } from '../lib/helpers.js'
import type { SearchResultsData } from '@tomachina/core'

export const searchRoutes = Router()

interface SearchResult {
  id: string
  type: 'client' | 'account'
  label: string
  sublabel: string
  href: string
}

/**
 * GET /api/search?q=<query>&limit=<n>
 * Unified type-ahead search across clients + accounts.
 * Returns grouped results for the SmartSearch TopBar component.
 */
searchRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const db = getFirestore()
    const q = ((req.query.q as string) || '').trim()
    const maxResults = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 25)

    // Split multi-word queries: "Josh Millang" → search first_name=Josh + last_name=Millang
    const parts = q.split(/\s+/).filter(Boolean)

    // Short queries return empty
    if (q.length < 2) {
      res.json(successResponse<SearchResultsData>({ clients: [], accounts: [] } as unknown as SearchResultsData))
      return
    }

    // ========================================================================
    // CLIENT SEARCHES (4 parallel)
    // ========================================================================

    const clientSearches: Promise<FirebaseFirestore.QuerySnapshot>[] = []

    // Multi-word search: "Josh Millang" -> first_name prefix + client-side last_name filter
    if (parts.length >= 2) {
      const fn = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
      const fnEnd = fn.slice(0, -1) + String.fromCharCode(fn.charCodeAt(fn.length - 1) + 1)
      const ln = parts[parts.length - 1].charAt(0).toUpperCase() + parts[parts.length - 1].slice(1).toLowerCase()
      const lnEnd = ln.slice(0, -1) + String.fromCharCode(ln.charCodeAt(ln.length - 1) + 1)

      clientSearches.push(
        db.collection('clients')
          .where('first_name', '>=', fn)
          .where('first_name', '<', fnEnd)
          .limit(maxResults * 3)
          .get()
          .then((snap) => {
            const filtered = snap.docs.filter((doc) => {
              const last = String(doc.data().last_name || '')
              return last >= ln && last < lnEnd
            })
            return { docs: filtered.slice(0, maxResults), empty: filtered.length === 0, size: filtered.length } as unknown as FirebaseFirestore.QuerySnapshot
          })
      )
    }


    // 1. last_name prefix match
    const lastUpper = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
    const lastEnd = lastUpper.slice(0, -1) + String.fromCharCode(lastUpper.charCodeAt(lastUpper.length - 1) + 1)
    clientSearches.push(
      db.collection('clients')
        .where('last_name', '>=', lastUpper)
        .where('last_name', '<', lastEnd)
        .limit(maxResults)
        .get()
    )

    // 2. first_name prefix match
    const firstUpper = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
    const firstEnd = firstUpper.slice(0, -1) + String.fromCharCode(firstUpper.charCodeAt(firstUpper.length - 1) + 1)
    clientSearches.push(
      db.collection('clients')
        .where('first_name', '>=', firstUpper)
        .where('first_name', '<', firstEnd)
        .limit(maxResults)
        .get()
    )

    // 3. email prefix match (lowercase)
    const emailLower = q.toLowerCase()
    const emailEnd = emailLower.slice(0, -1) + String.fromCharCode(emailLower.charCodeAt(emailLower.length - 1) + 1)
    clientSearches.push(
      db.collection('clients')
        .where('email', '>=', emailLower)
        .where('email', '<', emailEnd)
        .limit(maxResults)
        .get()
    )

    // 4. phone prefix match (strip non-digits)
    const digits = q.replace(/\D/g, '')
    if (digits.length >= 2) {
      const phoneEnd = digits.slice(0, -1) + String.fromCharCode(digits.charCodeAt(digits.length - 1) + 1)
      clientSearches.push(
        db.collection('clients')
          .where('phone', '>=', digits)
          .where('phone', '<', phoneEnd)
          .limit(maxResults)
          .get()
      )
    }

    // ========================================================================
    // ACCOUNT SEARCHES (3 parallel via collectionGroup)
    // ========================================================================

    const accountSearches: Promise<FirebaseFirestore.QuerySnapshot>[] = []

    // 1. policy_number prefix match
    const policyUpper = q.toUpperCase()
    const policyEnd = policyUpper.slice(0, -1) + String.fromCharCode(policyUpper.charCodeAt(policyUpper.length - 1) + 1)
    accountSearches.push(
      db.collectionGroup('accounts')
        .where('policy_number', '>=', policyUpper)
        .where('policy_number', '<', policyEnd)
        .limit(maxResults)
        .get()
    )

    // 2. account_number prefix match
    accountSearches.push(
      db.collectionGroup('accounts')
        .where('account_number', '>=', policyUpper)
        .where('account_number', '<', policyEnd)
        .limit(maxResults)
        .get()
    )

    // 3. carrier prefix match (capitalize first letter)
    const carrierUpper = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
    const carrierEnd = carrierUpper.slice(0, -1) + String.fromCharCode(carrierUpper.charCodeAt(carrierUpper.length - 1) + 1)
    accountSearches.push(
      db.collectionGroup('accounts')
        .where('carrier', '>=', carrierUpper)
        .where('carrier', '<', carrierEnd)
        .limit(maxResults)
        .get()
    )

    // ========================================================================
    // EXECUTE ALL QUERIES IN PARALLEL
    // ========================================================================

    const allPromises = [
      ...clientSearches.map((p) => p.then((snap) => ({ category: 'client' as const, snap }))),
      ...accountSearches.map((p) => p.then((snap) => ({ category: 'account' as const, snap }))),
    ]

    const settled = await Promise.allSettled(allPromises)

    // ========================================================================
    // DEDUPLICATE + FORMAT RESULTS
    // ========================================================================

    const seenClientIds = new Set<string>()
    const clients: SearchResult[] = []

    const seenAccountIds = new Set<string>()
    const accounts: SearchResult[] = []

    for (const result of settled) {
      if (result.status !== 'fulfilled') continue
      const { category, snap } = result.value

      for (const doc of snap.docs) {
        if (category === 'client') {
          if (seenClientIds.has(doc.id)) continue
          seenClientIds.add(doc.id)
          if (clients.length >= maxResults) continue

          const data = doc.data()
          const firstName = (data.first_name as string) || ''
          const lastName = (data.last_name as string) || ''
          const status = (data.status as string) || (data.client_status as string) || 'Unknown'
          const city = (data.city as string) || ''
          const state = (data.state as string) || ''
          const location = [city, state].filter(Boolean).join(', ')

          clients.push({
            id: doc.id,
            type: 'client',
            label: `${firstName} ${lastName}`.trim(),
            sublabel: [status, location].filter(Boolean).join(' | '),
            href: `/contacts/${doc.id}`,
          })
        } else {
          if (seenAccountIds.has(doc.id)) continue
          seenAccountIds.add(doc.id)
          if (accounts.length >= maxResults) continue

          const data = doc.data()
          const policyNumber = (data.policy_number as string) || ''
          const accountNumber = (data.account_number as string) || ''
          const accountId = (data.account_id as string) || ''
          const carrier = (data.carrier as string) || ''
          const product = (data.product as string) || ''

          // Extract parent client ID from the doc path: clients/{clientId}/accounts/{accountId}
          const clientId = doc.ref.parent.parent?.id || ''

          accounts.push({
            id: doc.id,
            type: 'account',
            label: policyNumber || accountNumber || accountId || doc.id,
            sublabel: [carrier, product].filter(Boolean).join(' | '),
            href: clientId ? `/contacts/${clientId}?tab=accounts` : '#',
          })
        }
      }
    }

    res.json(successResponse<SearchResultsData>({ clients, accounts } as unknown as SearchResultsData))
  } catch (err) {
    console.error('GET /api/search error:', err)
    res.status(500).json(errorResponse(String(err)))
  }
})
