/**
 * Authenticated API client for toMachina Cloud Run API.
 * Uses Firebase Auth ID token for authorization.
 * All portals share this — import from @tomachina/core.
 */

export interface ApiResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const API_BASE = typeof globalThis !== 'undefined' && 'NEXT_PUBLIC_API_URL' in (globalThis as Record<string, unknown>)
  ? String((globalThis as Record<string, unknown>).NEXT_PUBLIC_API_URL) || 'https://api.tomachina.com'
  : (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) || 'https://api.tomachina.com'

async function getIdToken(): Promise<string | null> {
  try {
    const { getAuth } = await import('firebase/auth')
    const auth = getAuth()
    const user = auth.currentUser
    if (!user) return null
    return await user.getIdToken()
  } catch {
    return null
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  try {
    const token = await getIdToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const url = path.startsWith('http') ? path : `${API_BASE}${path}`
    const response = await fetch(url, {
      ...options,
      headers,
    })

    const json = await response.json() as { success?: boolean; data?: T; error?: string }

    if (!response.ok || json.success === false) {
      return { success: false, error: json.error || `HTTP ${response.status}` }
    }

    return { success: true, data: json.data as T }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function apiPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResult<T>> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string>
): Promise<ApiResult<T>> {
  const url = params
    ? `${path}?${new URLSearchParams(params).toString()}`
    : path
  return apiFetch<T>(url, { method: 'GET' })
}
