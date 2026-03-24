import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth()
const TM_API = 'https://tm-api-365181509090.us-central1.run.app'
const MDJ1 = process.env.MDJ1_URL || 'https://tail7845ea.ts.net'

async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const joined = path.join('/')
  const search = new URL(request.url).search

  // MDJ chat routes proxy to the MDJ1 agent server via Tailscale
  if (joined.startsWith('mdj/')) {
    return proxyToMDJ1(request, joined, search)
  }

  // Everything else proxies to Cloud Run tm-api
  return proxyToTmApi(request, joined, search)
}

/**
 * Proxy to Cloud Run tm-api (same pattern as prodash/riimo/sentinel).
 * Uses Google IAM identity token for service-to-service auth.
 */
async function proxyToTmApi(request: Request, path: string, search: string) {
  const targetUrl = `${TM_API}/api/${path}${search}`

  const client = await auth.getIdTokenClient(TM_API)
  const rawHeaders = await client.getRequestHeaders()

  const forwardHeaders: Record<string, string> = {
    'content-type': request.headers.get('content-type') || 'application/json',
  }
  if (rawHeaders instanceof Headers) {
    rawHeaders.forEach((v, k) => { forwardHeaders[k] = v })
  } else {
    Object.assign(forwardHeaders, rawHeaders)
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    forwardHeaders['x-forwarded-authorization'] = authHeader
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (err) {
    return Response.json(
      { success: false, error: 'API proxy error: ' + String(err) },
      { status: 502 }
    )
  }
}

/**
 * Proxy to MDJ1 agent server on Dell PowerEdge via Tailscale.
 * Forwards Firebase Auth token. Streams SSE responses back to client.
 */
async function proxyToMDJ1(request: Request, path: string, search: string) {
  const targetUrl = `${MDJ1}/api/${path}${search}`

  const forwardHeaders: Record<string, string> = {
    'content-type': request.headers.get('content-type') || 'application/json',
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    forwardHeaders['authorization'] = authHeader
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? await request.text()
          : undefined,
    })

    // Stream SSE responses back without buffering
    const contentType = response.headers.get('content-type') || 'application/json'
    const headers: Record<string, string> = { 'content-type': contentType }
    if (contentType.includes('text/event-stream')) {
      headers['cache-control'] = 'no-cache'
      headers['connection'] = 'keep-alive'
      headers['x-accel-buffering'] = 'no'
    }

    return new Response(response.body, {
      status: response.status,
      headers,
    })
  } catch (err) {
    return Response.json(
      { success: false, error: 'MDJ1 proxy error: ' + String(err) },
      { status: 502 }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
