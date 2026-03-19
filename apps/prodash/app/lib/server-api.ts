import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth()
const TARGET = 'https://tm-api-365181509090.us-central1.run.app'

export async function serverFetch<T = Record<string, unknown>>(path: string): Promise<T | null> {
  try {
    const client = await auth.getIdTokenClient(TARGET)
    const headers = await client.getRequestHeaders()
    const res = await fetch(`${TARGET}/${path}`, {
      headers: { ...headers, 'content-type': 'application/json' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.success ? json.data : null
  } catch {
    return null
  }
}
