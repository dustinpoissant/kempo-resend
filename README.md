# kempo-resend

Sends the emails kempo logs through [Resend](https://resend.com). Kempo does not send email itself: it saves every email in its log (**Admin > Emails**) and hands it to an email extension through the `email:send` hook. This is that extension for Resend.

It has no dependencies: it makes one HTTPS call to Resend's API per email.

## Setup

1. Install it from Admin > Extensions.
2. On **Admin > Settings**, open the **Resend** tab and paste your API key (from [resend.com/api-keys](https://resend.com/api-keys)). It is stored encrypted and never shown again.
3. Choose what Resend sends as. Either set **Email from** (System tab) to an address on a domain you have verified with Resend, such as `Your Shop <orders@yourdomain.com>`, or set **Resend From** on the Resend tab, which is used for Resend only and wins over Email from. Resend refuses any other sender.

   **Trying it before you verify a domain:** put `onboarding@resend.dev` in **Resend From** on the Resend tab. Resend lets any account send as that address, but only to the email address you signed up to Resend with.
4. On **Admin > Emails**, press **Send a test email** to check it.

`SETTINGS_ENCRYPTION_KEY` must be set on the server (kempo makes one for you the first time it starts), because the key is stored encrypted.

**Coming from kempo before email extensions:** the key used to be `RESEND_API_KEY` in `.env`. If that is still set when you install this and no key is saved here, it is saved as the setting for you. The `.env` value is left alone.

## What it does

For each email kempo asks to send, the handler posts `{ from, to, subject, html }` to `https://api.resend.com/emails` with `Authorization: Bearer <key>`, and answers kempo with `{ sent: true, provider: 'resend', messageId }` (the id Resend gives) or `{ sent: false, error }`. Kempo records the result in the log, tries a failed email again (the **Email max retries** setting, 1 by default), and keeps the log for the retention settings. A failure shows in the log in Resend's own words:

| Resend says | The log says |
|---|---|
| 401, or 403 about the key | Resend did not accept the API key |
| 403 about a domain | Resend: The example.com domain is not verified |
| 422 | Resend: Invalid `to` field |
| 429 | Resend: Too many requests |

With no key saved the handler answers that it did not send, so if another email extension is installed (kempo-smtp), it gets the email instead. The first one to send it ends the chain.

## Settings

| Setting | Meaning |
|---|---|
| `resend_api_key` | Secret. Your Resend API key |
| `resend_from` | Optional. The address to send as through Resend, instead of Email from. Empty uses Email from |

## Tests

`npm test` covers the request, every kind of failure and the key migration with a fake `fetch`. It never contacts Resend.
