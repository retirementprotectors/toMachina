# TKO-COMMS-005 — SendGrid Deliverability Audit

> **Purpose**: First-ever audit of RPI's SendGrid sending health. Establish a baseline
> before the TAIKO sprint activates more volume. Pull 90-day stats, check authentication
> records, review suppression lists, identify bounce/open rate issues.

---

## 1. Pre-Audit Checklist

Before running the audit confirm you have:

- [ ] SendGrid Dashboard access: [app.sendgrid.com](https://app.sendgrid.com) (Admin or Marketing user role)
- [ ] DNS record access (registrar panel or Cloudflare)
- [ ] `dig` available on your terminal (Mac/Linux built-in; Windows: use WSL or `nslookup`)

---

## 2. Email Authentication Records (SPF / DKIM / DMARC)

Poor authentication is the #1 cause of inbox placement failures and blacklisting.

### 2a. Check SPF record

```bash
dig TXT retireprotected.com | grep "v=spf1"
```

**Expected output** (must include SendGrid):
```
"v=spf1 include:sendgrid.net ~all"
```

If `sendgrid.net` is missing from the SPF record, add it. Multiple `include:` directives are fine up to 10 DNS lookups total.

### 2b. Check DKIM record

SendGrid DKIM uses a selector-based subdomain. Your selector is visible in the SendGrid dashboard under **Settings → Sender Authentication → Domain Authentication**.

Typical selectors: `s1` and `s2`:

```bash
dig TXT s1._domainkey.retireprotected.com
dig TXT s2._domainkey.retireprotected.com
```

**Expected**: long `p=` TXT value (the public key). If empty or NXDOMAIN, DKIM is not configured — go to **Settings → Sender Authentication → Domain Authentication** in SendGrid to regenerate and re-apply the DNS records.

### 2c. Check DMARC record

```bash
dig TXT _dmarc.retireprotected.com | grep "v=DMARC1"
```

**Expected**:
```
"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@retireprotected.com; pct=100"
```

If no DMARC record exists, add one. Start with `p=none` (monitor mode) and move to `p=quarantine` after confirming SPF+DKIM pass:

```
_dmarc.retireprotected.com  TXT  "v=DMARC1; p=none; rua=mailto:josh@retireprotected.com; pct=100"
```

---

## 3. Pull 90-Day Delivery Stats

In the SendGrid Dashboard:

1. Go to **Activity → Email Activity**
2. Set date range: last 90 days
3. Export as CSV

Or via SendGrid Stats UI:

1. Go to **Stats → Overview**
2. Select date range: last 90 days
3. Note the following metrics:

| Metric | Target | Action if below target |
|--------|--------|------------------------|
| Delivery Rate | > 98% | Investigate bounces — see Section 4 |
| Open Rate | > 20% | Review subject lines, from-name, send timing |
| Click Rate | > 2% | Review CTA copy, link placement |
| Bounce Rate | < 2% | Clean suppression list — see Section 4 |
| Spam Report Rate | < 0.08% | Check consent, unsubscribe UX |

---

## 4. Suppression List Inspection

The suppression list (bounces + spam reports + unsubscribes) accumulates over time. Stale entries prevent legitimate re-engagement.

### View suppressions

1. Go to **Suppressions** in the left nav
2. Review:
   - **Bounces** (hard bounce = bad address; soft bounce = temporary)
   - **Spam Reports** (recipient marked as spam — critical)
   - **Unsubscribes** (opt-out — honor these)
   - **Blocks** (ISP blocked delivery)

### Remove stale bounces

If a client's email is on the bounce list but you have a corrected address:

1. Go to **Suppressions → Bounces**
2. Search by email address
3. Delete the entry so SendGrid will attempt delivery again

> **Do not bulk-remove hard bounces.** Hard bounces indicate permanently invalid addresses. Sending to them again will hurt your sender reputation.

### Export suppressions for CRM sync

Download the full suppression list and cross-reference with Firestore `clients` collection. Any client with a suppressed email should have their `email_deliverable: false` flag set in Firestore (or a note added).

---

## 5. Recommended Remediation Actions

Based on common first-audit findings:

| Finding | Remediation | Priority |
|---------|-------------|----------|
| SPF missing `sendgrid.net` | Update DNS TXT record | Critical |
| DKIM not configured | Run Domain Authentication in SendGrid dashboard | Critical |
| No DMARC record | Add `p=none` DMARC record, monitor 30 days | High |
| Bounce rate > 2% | Clean suppression list, update client emails in Firestore | High |
| Spam rate > 0.08% | Review consent collection, add unsubscribe footer | Critical |
| Open rate < 15% | A/B test subject lines via C3 campaigns | Medium |
| Suppression list > 500 entries | Export + sync to Firestore client records | Medium |

---

## 6. Monitoring Baseline (Post-Audit)

After the audit, set up weekly monitoring:

1. In SendGrid: **Settings → Notifications** → enable email alerts for:
   - Bounce rate spike (> 5% on any send)
   - Spam report spike (> 0.1%)
   - Delivery failure (any block event)

2. In toMachina: the SendGrid Event Webhook (`POST /api/webhooks/sendgrid`) already logs bounce and drop events to Firestore and fires portal notifications. Verify it is wired by checking Firestore `campaign_send_log` for `status: "bounced"` entries after a campaign send.

---

## 7. Bounce-Handling Gap (Code Audit Result)

**Gap identified**: The SendGrid Event Webhook (`services/api/src/routes/webhooks.ts`) fires a portal notification on bounce/drop (TRK-13685) but does **not** update the client record's email deliverability status in Firestore.

**Recommendation**: In a follow-up ticket, add a Firestore update to mark `clients/{clientId}.email_bounced = true` when a bounce event is received for a known client's email. This prevents re-sending to bad addresses and surfaces the issue to the agent in the client detail view.

> This follow-up is tracked as a post-sprint code improvement — not blocking this PR.

---

## References

- [SendGrid Email Activity Docs](https://docs.sendgrid.com/ui/analytics-and-reporting/email-activity-feed)
- [SendGrid Deliverability Guide](https://docs.sendgrid.com/ui/sending-email/deliverability)
- [DMARC.org Setup Guide](https://dmarc.org/overview/)
- API webhook route: `services/api/src/routes/webhooks.ts` → `POST /sendgrid`
- Campaign send logs: Firestore `campaign_send_log` collection

---

*TKO-COMMS-005 · TAIKO Sprint · April 2026*
