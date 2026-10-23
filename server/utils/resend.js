/*
  Sending one email through Resend's HTTP API (resend.com/docs/api-reference/emails/send-email). It is given the key and a `fetch`, so it
  is tested with a fake one and Resend is never needed. There is no SDK: the call is one POST.

  `POST https://api.resend.com/emails` with `Authorization: Bearer <key>` and `{ from, to, subject, html }`. A success is 200 with
  `{ id }`. A failure is a 4xx or 5xx with `{ statusCode, name, message }`, such as 401 for a bad key, 403 for a sender address on a
  domain that is not verified, 422 for an address that is not valid, 429 when sending too fast.
*/
export const ENDPOINT = 'https://api.resend.com/emails';

/* name@example.com, or Shop Name <name@example.com>, on one line. */
export const isAddress = value => typeof value === 'string' && value.length <= 200 && /^(?:[^<>\r\n@]+<[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+>|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)$/.test(value.trim());

/*
  `from` is the Resend tab's own sender, which wins over the site's (`email.from`) when it is set, so Resend can send as an address that is on
  a domain verified with it (or as onboarding@resend.dev while testing) whatever the rest of the site sends as.

  Resolves to `{ sent: true, provider, messageId }` or `{ sent: false, error }` (with `skipped: true` when there is no key, so kempo knows it did not try): what an email:send handler answers. It never throws. */
export const sendWithResend = async ({ apiKey, email, from: override = '', fetchImpl = globalThis.fetch }) => {
  if(!apiKey) return { sent: false, skipped: true, error: 'No Resend API key is saved. Add one on the Resend tab of the Settings page' };

  const from = String(override ?? '').trim() || email.from;
  if(override && String(override).trim() && !isAddress(String(override).trim())) return { sent: false, error: `The Resend From setting (${String(override).trim()}) must look like name@yourdomain.com or Shop Name <name@yourdomain.com>` };

  let response;
  try {
    response = await fetchImpl(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html }),
    });
  } catch(error) {
    return { sent: false, error: `Resend could not be reached: ${error?.message ?? 'no answer'}` };
  }

  let body = null;
  try { body = await response.json(); } catch { /* an answer that is not JSON is reported by its status */ }

  if(response.status === 401 || (response.status === 403 && /api key/i.test(body?.message ?? ''))) return { sent: false, error: 'Resend did not accept the API key' };
  if(!response.ok){
    const reason = body?.message ?? `answered ${response.status}`;
    const sender = /domain/i.test(reason) && [403, 422].includes(response.status) ? ` (it was sent as ${from}). Set ${String(override ?? '').trim() ? 'Resend From on the Resend tab' : 'Email from, on the System tab of the Settings page,'} to an address on a domain verified with Resend` : '';
    return { sent: false, error: `Resend: ${reason}${sender}` };
  }
  if(!body?.id) return { sent: false, error: 'Resend answered without saying the email was accepted' };
  return { sent: true, provider: 'resend', messageId: body.id };
};
