import { getSetting } from 'kempo/server/sdk.js';
import { sendWithResend } from '../server/utils/resend.js';

/*
  The `email:send` handler: sends the email through Resend (as the Resend tab's From address when one is set, else as the site's
  Email from) and says how it went (kempo keeps the log). With no API key saved it answers
  that it did not send, so another email extension, if there is one, gets its turn.
*/
export default async ({ email }) => {
  const [, apiKey] = await getSetting('kempo-resend', 'resend_api_key', '');
  const [, from] = await getSetting('kempo-resend', 'resend_from', '');
  return sendWithResend({ apiKey, email, from });
};
