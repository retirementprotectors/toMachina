---
title: SMS Consent Copy — Carrier-Compliant Opt-In
warrior: MUSASHI (CMO — owns copy)
consumer: TAIKO (comms infrastructure — owns the pipe) / RONIN (ships /sms-consent page)
ticket: COMMS-001 — Twilio A2P unblock (Ticket #25630009)
locked: 2026-04-13
version: 1.0
---

# SMS Consent Copy — Carrier-Compliant Opt-In

This is the copy RONIN drops into the `/sms-consent` page and every intake point that captures an SMS opt-in. Covers Twilio A2P / CTIA / TCPA review criteria. Do not edit without MUSASHI + JDM sign-off — every word has a compliance reason.

---

## Part 1 — Opt-In Text (shown above the consent checkbox)

> **Text Updates from Retirement Protectors, Inc.**
>
> By checking the box below, you agree to receive text messages from Retirement Protectors, Inc. at the phone number you provided. Message types may include appointment confirmations, account and policy updates, service notifications, educational information about Medicare, retirement, life insurance, and legacy planning, and responses to your inquiries.
>
> Message frequency varies based on your account activity and the services we are providing. Message and data rates may apply depending on your mobile carrier and plan.
>
> You can opt out at any time by replying **STOP** to any message. Reply **HELP** for help, or contact us at 515-992-5000 or Service@RetireProtected.com.
>
> Consent is not a condition of purchase. Your information will never be sold. See our [Privacy Policy](https://retireprotected.com/privacy) and [Terms of Service](https://retireprotected.com/terms) for full details.

---

## Part 2 — Consent Checkbox Label (required, unchecked by default)

> ☐ **I agree to receive text messages from Retirement Protectors, Inc.** at the phone number I provided, on the terms above. I understand I can reply STOP at any time to opt out. (Required for SMS communications.)

---

## Part 3 — Confirmation Message (sent immediately after opt-in)

Exact SMS body (160 character budget preferred; this is 155 chars):

> You're signed up for Retirement Protectors SMS updates. Msg & data rates may apply. Reply HELP for help, STOP to cancel. We're Your People.

---

## Part 4 — STOP Response (auto-reply when user texts STOP)

> You've been unsubscribed from Retirement Protectors, Inc. text messages. No further texts will be sent. Reply START to re-subscribe. Questions? 515-992-5000.

---

## Part 5 — HELP Response (auto-reply when user texts HELP)

> Retirement Protectors, Inc. — appointment & service texts. Msg & data rates may apply. Reply STOP to unsubscribe. Help: 515-992-5000 or Service@RetireProtected.com.

---

## Part 6 — Short Disclosure (for space-constrained intake forms)

Use this on forms where the full opt-in text doesn't fit (max ~400 chars):

> By providing your mobile number and checking this box, you agree to receive text messages from Retirement Protectors, Inc. (appointments, account updates, service notifications, educational info). Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel, HELP for help. Consent is not a condition of purchase. See our [Privacy Policy](https://retireprotected.com/privacy).

---

## Part 7 — Carrier-Facing Campaign Description (for the Twilio A2P registration form)

Use this as the campaign use case / description field when re-submitting the Twilio A2P Brand/Campaign application:

> **Campaign Name:** RPI Client Service & Education
>
> **Use Case:** Customer Care
>
> **Description:** Retirement Protectors, Inc. (RPI) is a licensed retirement planning firm serving clients on Medicare, retirement income, life insurance, and legacy planning. SMS messages are sent only to consumers who have provided their mobile number through our online intake form, service agreement, or verbal consent documented by our licensed staff, AND have explicitly opted in via a checkbox on our website (https://retireprotected.com) or in person on a signed service agreement. Messages include: (1) appointment confirmations and reminders, (2) account and policy status updates, (3) service notifications (e.g., application status, open enrollment windows), (4) educational information about Medicare, retirement, life insurance, and legacy planning, (5) responses to direct inquiries.
>
> **Opt-In Method:** Web form checkbox + signed service agreement + verbal with written documentation.
>
> **Opt-In Keywords:** START (re-subscribe)
> **Opt-Out Keywords:** STOP, UNSUBSCRIBE, CANCEL, END, QUIT
> **Help Keywords:** HELP, INFO
>
> **Sample Messages:**
> 1. "Hi [First Name], this is a reminder of your Medicare review with [Agent] on [Date] at [Time]. Reply C to confirm or call 515-992-5000 to reschedule. Reply STOP to opt out."
> 2. "[First Name], your Part D election was submitted successfully and will be effective [Date]. Keep your confirmation: [ConfirmationID]. Questions? Reply or call 515-992-5000."
> 3. "Open enrollment for Medicare Advantage is Oct 15 – Dec 7. Want to review your plan this year? Reply YES or schedule at retireprotected.com/book."
>
> **Compliance:** All messages include sender identification ("Retirement Protectors") and comply with TCPA, CTIA, and CAN-SPAM. No marketing messages sent to numbers that have not opted in. No promotional messages sent during quiet hours (before 8 AM or after 9 PM recipient local time). Full opt-in records (timestamp, IP, checkbox evidence) are retained for 5 years minimum.

---

## Part 8 — Intake Form Copy (short-form consent at account creation)

For the RPI client intake form where someone first provides their mobile number:

**Field label:**
> Mobile Phone Number

**Helper text (below field):**
> We'll use this to coordinate appointments and send account updates. Standard message & data rates may apply.

**Checkbox (required for SMS):**
> ☐ I agree to receive text messages from Retirement Protectors, Inc. at this number (appointments, account updates, service notifications). Reply STOP anytime to cancel. [See full terms.](https://retireprotected.com/sms-terms)

---

## Compliance Notes (for developers — do not surface to users)

- **Double opt-in not required** for informational/transactional messages, but recommended for promotional. For RPI's use case (primarily transactional + educational), single opt-in with confirmation SMS is compliant.
- **Opt-in records** must be stored with: timestamp, IP address, user agent, exact checkbox state + accompanying disclosure text (version number of this doc).
- **Opt-out processing** must be immediate (within seconds) and enforced across all campaigns.
- **Quiet hours:** 8 AM – 9 PM recipient local time for all non-emergency messages. Transactional/critical account updates are exempt but should still prefer business hours when possible.
- **Sender identification** ("Retirement Protectors" or "RPI") must appear in every message.
- **Never sell or share** opt-in lists. Privacy policy must state this explicitly.

---

## Tagline Footer (for /sms-consent page)

> **Retirement Protectors, Inc. — We're Your People™**
> 515-992-5000 · Service@RetireProtected.com · RetireProtected.com

---

**MUSASHI locked this copy 2026-04-13.** Updates require MUSASHI + JDM sign-off and must increment the version number at the top. TAIKO owns the pipe; MUSASHI owns every word above.
