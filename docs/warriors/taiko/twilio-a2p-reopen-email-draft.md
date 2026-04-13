---
warrior: TAIKO
type: email-draft
purpose: Reopen Twilio A2P ticket #25630009 with live consent URL + updated Part 7 carrier-facing campaign description
status: DRAFT — ready to send via gmail_send_email after RONIN Gmail migration lands
live_url_verified: https://prodash.tomachina.com/sms-consent → HTTP 200 (verified 2026-04-13)
copy_source: docs/warriors/musashi/copy/sms-consent-copy.md Part 7
---

# Twilio A2P Ticket #25630009 — Reopen Email Draft

## Send metadata

| Field | Value |
|---|---|
| **From** | `josh@retireprotected.com` (JDM — auth via rpi-workspace SA+DWD post-migration) |
| **To** | Primary: *last Twilio rep address on existing ticket #25630009 thread* · Fallback: `support@twilio.com` |
| **CC** | `josh@retireprotected.com` (per SHINOB1 — JDM sees it land) |
| **Subject** | `Re: Ticket #25630009 — A2P 10DLC Campaign Resubmission (RPI Client Service & Education)` |
| **Sender phone on campaign** | `+1 (888) 620-8587` (RPI toll-free, verified with carrier) |
| **Business name on record** | `Retirement Protectors, Inc.` (as listed in Twilio Brand profile) |
| **Business address** | *Pulled verbatim from the Twilio Brand profile on file — JDM verifies before send* |
| **Send via** | `mcp__rpi-workspace__gmail_send_email` (available after RONIN ZRD-MCP-GMAIL-CAL-001 migration lands) |

---

## Body (paste below subject line)

```
Hi [Rep name — fill from existing thread],

Reopening ticket #25630009 to resubmit our A2P 10DLC campaign with the corrected information your team flagged.

We now have a compliant, publicly accessible SMS consent landing page live at:

    https://prodash.tomachina.com/sms-consent

The page includes:
  • The opt-in disclosure language required by CTIA A2P messaging principles
  • An explicit, unchecked-by-default consent checkbox
  • Business identification (legal name, toll-free number, physical address)
  • Visible STOP / HELP keyword instructions
  • "Msg & data rates may apply" rate disclosure
  • Links to our Privacy Policy and SMS Terms

On submission, we write a permanent consent record (timestamp, phone, IP, user-agent, device fingerprint, copy version, and the SHA-256 hash of the disclosure text the user accepted) to Firestore. Records are retained for a minimum of five years per TCPA audit requirements.

Here is our updated campaign registration information for resubmission:

Campaign Name: RPI Client Service & Education
Use Case: Customer Care

Description:
Retirement Protectors, Inc. (RPI) is a licensed retirement planning firm serving clients on Medicare, retirement income, life insurance, and legacy planning. SMS messages are sent only to consumers who have provided their mobile number through our online intake form, service agreement, or verbal consent documented by our licensed staff, AND have explicitly opted in via a checkbox on our website (https://prodash.tomachina.com/sms-consent) or in person on a signed service agreement. Messages include: (1) appointment confirmations and reminders, (2) account and policy status updates, (3) service notifications (e.g., application status, open enrollment windows), (4) educational information about Medicare, retirement, life insurance, and legacy planning, (5) responses to direct inquiries.

Opt-In Method: Web form checkbox + signed service agreement + verbal with written documentation.

Opt-In Keywords: START (re-subscribe)
Opt-Out Keywords: STOP, UNSUBSCRIBE, CANCEL, END, QUIT
Help Keywords: HELP, INFO

Sample Messages:
1. "Hi [First Name], this is a reminder of your Medicare review with [Agent] on [Date] at [Time]. Reply C to confirm or call +1 (888) 620-8587 to reschedule. Reply STOP to opt out."
2. "[First Name], your Part D election was submitted successfully and will be effective [Date]. Keep your confirmation: [ConfirmationID]. Questions? Reply or call +1 (888) 620-8587."
3. "Open enrollment for Medicare Advantage is Oct 15 – Dec 7. Want to review your plan this year? Reply YES or schedule at retireprotected.com/book."

Compliance: All messages include sender identification ("Retirement Protectors") and comply with TCPA, CTIA, and CAN-SPAM. No marketing messages sent to numbers that have not opted in. No promotional messages sent during quiet hours (before 8 AM or after 9 PM recipient local time). Full opt-in records (timestamp, IP, checkbox evidence, device fingerprint, copy version hash) are retained for 5 years minimum.

Happy to answer any additional questions or walk through the consent flow live. We're ready to resubmit the campaign as soon as you confirm this meets the carrier review criteria.

Thanks,
Josh D. Millang
CEO, Retirement Protectors, Inc.
Toll-free: +1 (888) 620-8587
josh@retireprotected.com
Twilio Ticket Reference: #25630009
```

---

## Review checklist before sending

- [ ] Confirm Twilio rep name + email from the existing ticket #25630009 thread
- [ ] Confirm CC list (anyone at RPI who needs visibility)
- [ ] Verify `https://prodash.tomachina.com/sms-consent` still returns HTTP 200 when sending (page was live as of 2026-04-13 verified via curl)
- [ ] Confirm ticket number `#25630009` is correct
- [ ] JDM signs off on the exact wording

## What changed from the copy-source Part 7

One surgical edit: the URL embedded in the Description paragraph was `https://retireprotected.com` in MUSASHI's template. Updated in this draft to `https://prodash.tomachina.com/sms-consent` (the actual live opt-in page). Nothing else touched.

## How to send (once Gmail MCP is migrated)

```
mcp__rpi-workspace__gmail_send_email
  to:      <Twilio rep address from ticket thread>
  subject: Re: Ticket #25630009 — A2P 10DLC Campaign Resubmission (RPI Client Service & Education)
  body:    (paste body above, starting "Hi [Rep name]")
  from:    josh@retireprotected.com
```

Alternative: JDM fires manually from his Pro Gmail web interface if the A2P gate needs to clear before the Gmail MCP migration lands.

🥁 — TAIKO, The Drum
