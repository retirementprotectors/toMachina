import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_PROXY_URL || 'http://localhost:8080'

/**
 * Fetch a Cloud Run identity token from the compute metadata server.
 * Only works in GCP environments (Cloud Run, App Hosting, GCE).
 * Returns null in local dev (where IAM auth isn't needed).
 */
async function getIdentityToken(): Promise<string | null> {
  // Skip in local development
  if (!process.env.K_SERVICE && !process.env.GOOGLE_CLOUD_PROJECT) return null

  try {
    const audience = API_URL
    const res = await fetch(
      `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`,
      { headers: { 'Metadata-Flavor': 'Google' } }
    )
    if (!res.ok) return null
    return res.text()
  } catch {
    return null
  }
}

async function handler(req: NextRequest) {
  // Extract the proxy path from the URL (everything after /api/)
  const url = new URL(req.url)
  const targetPath = url.pathname // already starts with /api/
  const targetUrl = `${API_URL}${targetPath}${url.search}`

  // Forward headers, add Cloud Run identity token if available
  const headers = new Headers()
  // Forward auth header from client (Firebase ID token)
  const authHeader = req.headers.get('authorization')
  if (authHeader) headers.set('Authorization', authHeader)
  headers.set('Content-Type', req.headers.get('content-type') || 'application/json')

  // Add Cloud Run IAM identity token for service-to-service auth
  const idToken = await getIdentityToken()
  if (idToken) {
    // Use X-Serverless-Authorization for Cloud Run service-to-service
    // This passes IAM check while preserving the original Authorization header
    headers.set('X-Serverless-Authorization', `Bearer ${idToken}`)
  }

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  }

  // Forward body for non-GET requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    fetchOptions.body = await req.text()
  }

  try {
    const response = await fetch(targetUrl, fetchOptions)
    const body = await response.text()

    return new NextResponse(body, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: 'API proxy error: ' + String(err) },
      { status: 502 }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
