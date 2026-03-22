import { fetchWithAuth } from './fetchWithAuth'
import type { GenericSchema, BaseIssue } from 'valibot'

export interface ValidatedResult<T> {
  success: boolean
  data?: T
  error?: string
  validationWarnings?: string[]
  pagination?: { count: number; total?: number; hasMore?: boolean; nextCursor?: string | null }
}

export async function fetchValidated<T = unknown>(
  url: string,
  options?: RequestInit & { schema?: GenericSchema<T> }
): Promise<ValidatedResult<T>> {
  try {
    const { schema, ...fetchOptions } = options ?? {}
    const res = await fetchWithAuth(url, fetchOptions)
    if (!res.ok) return { success: false, error: `HTTP ${res.status}` }
    const json = await res.json()
    if (!json.success) return { success: false, error: json.error || 'Unknown error' }
    const result: ValidatedResult<T> = { success: true, data: json.data as T, pagination: json.pagination }
    if (schema && json.data != null) {
      try {
        const { safeParse } = await import('valibot')
        const parsed = safeParse(schema, json.data)
        if (!parsed.success) {
          const warnings = parsed.issues.map((issue: BaseIssue<unknown>) => {
            const pathStr = issue.path?.map((p) => String(p.key)).join('.') || '(root)'
            return '[ResponseValidation] ' + url + ': ' + pathStr + ' \u2014 ' + issue.message
          })
          result.validationWarnings = warnings
          if (process.env.NODE_ENV !== 'production') { warnings.forEach((w) => console.warn(w)) }
        }
      } catch { /* validation failure should never crash the app */ }
    }
    return result
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
