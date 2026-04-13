import { GoogleAuth } from 'google-auth-library'

// Proxy to Cloud Run public/sms-consent endpoint.
// No Firebase user auth required — this is a public opt-in funnel.
// IAM identity token is machine-to-machine (Next.js → Cloud Run), not user auth.

const auth = new GoogleAuth()
const TARGET = 'https://tm-api-365181509090.us-central1.run.app'

export async function POST(request: Request) {
  const targetUrl = `${TARGET}/public/sms-consent`

  // Get Cloud Run IAM identity token (machine-to-machine, not user auth)
  const client = await auth.getIdTokenClient(TARGET)
  const rawHeaders = await client.getRequestHeaders()

  const forwardHeaders: Record<string, string> = {
    'content-type': 'application/json',
  }
  if (rawHeaders instanceof Headers) {
    rawHeaders.forEach((v, k) => { forwardHeaders[k] = v })
  } else {
    Object.assign(forwardHeaders, rawHeaders)
  }
  // No x-forwarded-authorization — this route is intentionally unauthenticated

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: await request.text(),
    })

    return new Response(response.body, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    })
  } catch (err) {
    return Response.json(
      { success: false, error: 'SMS consent service unavailable. Please try again.' },
      { status: 502 }
    )
  }
}
