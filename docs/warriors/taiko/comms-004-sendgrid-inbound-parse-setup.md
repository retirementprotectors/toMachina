# TKO-COMMS-004 — SendGrid Inbound Parse Setup

> **Status**: Code LIVE (`POST /api/webhooks/sendgrid-inbound`, deployed as of this PR).
> JDM must complete the DNS + SendGrid dashboard steps below to activate.

## What it does

When a client replies to an RPI email, SendGrid forwards the raw message (headers, body, attachments) to our API endpoint. The route:

1. Parses `from`, `to`, `subject`, `text`, `html`, and `attachments` from the multipart POST
2. Looks up the sender's email address in the `clients` Firestore collection
3. Creates a `communications` document (direction: `inbound`, channel: `email`, status: `received`)
4. Fires a notification to all portals so agents see it in the Notifications panel

## Step 1 — Add the MX record (DNS)

SendGrid Inbound Parse requires a dedicated subdomain with an MX record pointing to SendGrid's mail servers.

**Subdomain**: `inbound.retireprotected.com`

Add the following DNS record via your registrar (or Cloudflare / Google Domains):

| Type | Host | Value | Priority |
|------|------|-------|----------|
| MX | `inbound.retireprotected.com` | `mx.sendgrid.net` | 10 |

> **If you already have MX records on the root domain** (`retireprotected.com`), do not touch them. This record is on the `inbound.` subdomain only.

Allow up to 48 hours for DNS propagation, though typically under 1 hour.

## Step 2 — Configure SendGrid Inbound Parse

1. Log in to [SendGrid Dashboard](https://app.sendgrid.com)
2. Navigate to **Settings → Inbound Parse**
3. Click **Add Host & URL**
4. Fill in:
   - **Receiving Domain**: `inbound.retireprotected.com`
   - **Destination URL**: `https://prodash.tomachina.com/api/webhooks/sendgrid-inbound`
   - **POST the raw, full MIME message**: leave **unchecked** (we handle multipart form data)
   - **Send raw**: leave **unchecked**
5. Click **Save**

> The webhook URL goes through the portal's Next.js proxy to the Cloud Run API, which handles auth transparently for inbound webhooks (public endpoint, no Firebase Auth required).

## Step 3 — Verify

Send a test email to any address at `inbound.retireprotected.com` (e.g., `hello@inbound.retireprotected.com`). Within seconds you should see:

- A new document in Firestore → `communications` collection with `direction: "inbound"`, `channel: "email"`, `status: "received"`
- A notification in all three portals: "Inbound email from [sender]"

## Email schema written to Firestore

```json
{
  "comm_id": "<uuid>",
  "direction": "inbound",
  "channel": "email",
  "from_address": "John Smith <john@example.com>",
  "to_address": "hello@inbound.retireprotected.com",
  "subject": "Re: Your Medicare Review",
  "body_text": "...",
  "body_html": "...",
  "attachment_count": 0,
  "client_id": "<matched client ID or null>",
  "client_name": "John Smith or null",
  "status": "received",
  "created_at": "2026-04-12T...",
  "_created_by": "sendgrid-webhook"
}
```

## Security note

The `/api/webhooks/sendgrid-inbound` endpoint is intentionally public (no Firebase Auth) so SendGrid can POST to it without authentication headers. Rate limiting is handled at the Cloud Run level. The endpoint always returns HTTP 200 to prevent SendGrid from retrying on processing errors.

## References

- [SendGrid Inbound Parse Docs](https://docs.sendgrid.com/for-developers/parsing-email/setting-up-the-inbound-parse-webhook)
- API route: `services/api/src/routes/webhooks.ts` → `POST /sendgrid-inbound` (line ~319)
- Firestore collection: `communications`

---

*TKO-COMMS-004 · TAIKO Sprint · April 2026*
