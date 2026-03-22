/**
 * TRK-533: API Client Helper — typed fetch wrapper with auto-auth.
 * All calls inject Authorization: Bearer header from auth.ts.
 */

import { getTestAuthToken } from './auth.js'
import { TEST_API_URL } from './constants.js'

interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  const baseUrl = process.env.TEST_API_URL || TEST_API_URL
  const token = await getTestAuthToken()

  const url = `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      error: `HTTP ${response.status}: ${errorText}`,
    }
  }

  const json = await response.json() as ApiResponse<T>
  return json
}

export async function apiGet<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>('GET', path)
}

export async function apiPost<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>('POST', path, body)
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>('PATCH', path, body)
}
