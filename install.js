import { getSetting, setSetting } from 'kempo/server/sdk.js';

/*
  Before kempo had email extensions its Resend key was `RESEND_API_KEY` in the site's .env. If that is set and no key is saved yet, it is
  saved as this extension's setting (encrypted), so a site that already used Resend only has to install this. The .env value is left
  alone, and once a key is saved here it is never overwritten.
*/
export const migrateKey = ({ env, saved }) => (!saved && env ? env.trim() : '');

export default async () => {
  if(!process.env.SETTINGS_ENCRYPTION_KEY){
    console.warn('[kempo-resend] SETTINGS_ENCRYPTION_KEY is not set, so the Resend API key cannot be stored. Start the server once to have kempo make one, then reinstall this extension.');
    return;
  }

  const [, saved] = await getSetting('kempo-resend', 'resend_api_key', '');
  const key = migrateKey({ env: process.env.RESEND_API_KEY, saved });
  if(key){
    const [error] = await setSetting('kempo-resend', 'resend_api_key', key, 'secret', false, 'Your Resend API key, from resend.com/api-keys. Stored encrypted and never shown again. The address emails are sent from must be on a domain you have verified with Resend');
    if(error) console.warn(`[kempo-resend] The key from RESEND_API_KEY could not be saved: ${error.msg}`);
    else console.log('[kempo-resend] Saved RESEND_API_KEY from the environment as the Resend API key setting.');
  }
  console.log('[kempo-resend] Installed. Add your Resend API key on the Resend tab of the Settings page, and set the Email from address (on a domain verified with Resend).');
};
