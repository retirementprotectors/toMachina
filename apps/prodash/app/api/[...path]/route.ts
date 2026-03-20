import { GoogleAuth } from 'google-auth-library'

const auth = new GoogleAuth()
const TARGET = 'https://tm-api-365181509090.us-central1.run.app'

async function handler(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const targetUrl = `${TARGET}/api/${path.join('/')}${new URL(request.url).search}`

  // Get identity token for Cloud Run IAM
  const client = await auth.getIdTokenClient(TARGET)
  const headers = await client.getRequestHeaders()

  // Forward original headers (especially Authorization for Firebase Auth)
  const forwardHeaders: Record<string, string> = {
    ...headers,
    'content-type': request.headers.get('content-type') || 'application/json',
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

export const GET = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler
