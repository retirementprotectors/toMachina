import { getAuth } from 'firebase/auth'

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const auth = getAuth()
  const user = auth.currentUser
  const token = user ? await user.getIdToken() : null

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  return fetch(url, { ...options, headers })
}
