import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENDPOINT, isAddress, sendWithResend } from '../server/utils/resend.js';
import { migrateKey } from '../install.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const email = { id: 'e1', to: 'ann@example.com', from: 'Shop <shop@example.com>', subject: 'Hello', html: '<p>Hi</p>' };

/* A fake fetch that answers once and remembers what it was asked. */
const fakeFetch = (status, body) => {
  const calls = [];
  const impl = async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    if(status instanceof Error) throw status;
    return { status, ok: status >= 200 && status < 300, json: async () => { if(body === undefined) throw new Error('no body'); return body; } };
  };
  return { impl, calls };
};

test('an email is sent with a bearer key and the from, to, subject and html, and the id Resend gives is the message id', async () => {
  const { impl, calls } = fakeFetch(200, { id: 're_123' });
  const result = await sendWithResend({ apiKey: 're_key', email, fetchImpl: impl });
  assert.deepEqual(result, { sent: true, provider: 'resend', messageId: 're_123' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ENDPOINT);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer re_key');
  assert.deepEqual(calls[0].body, { from: 'Shop <shop@example.com>', to: ['ann@example.com'], subject: 'Hello', html: '<p>Hi</p>' });
});

test('a reply-to address is sent as reply_to, and an email with none has no such field', async () => {
  const withReply = fakeFetch(200, { id: 're_1' });
  await sendWithResend({ apiKey: 'k', email: { ...email, replyTo: 'Ann Lee <ann@visitor.test>' }, fetchImpl: withReply.impl });
  assert.deepEqual(withReply.calls[0].body, { from: 'Shop <shop@example.com>', to: ['ann@example.com'], reply_to: ['Ann Lee <ann@visitor.test>'], subject: 'Hello', html: '<p>Hi</p>' });
  const without = fakeFetch(200, { id: 're_2' });
  await sendWithResend({ apiKey: 'k', email: { ...email, replyTo: null }, fetchImpl: without.impl });
  assert.equal('reply_to' in without.calls[0].body, false);
});

test('with no key nothing is asked of Resend, and the reason says where to add one', async () => {
  const { impl, calls } = fakeFetch(200, { id: 'x' });
  const result = await sendWithResend({ apiKey: '', email, fetchImpl: impl });
  assert.equal(result.sent, false);
  assert.equal(result.skipped, true);
  assert.match(result.error, /Resend tab of the Settings page/);
  assert.equal(calls.length, 0);
});

test('Resend refusing the key, the sender domain, an address or the rate is reported in its own words', async () => {
  const answer = async (status, body) => (await sendWithResend({ apiKey: 'k', email, fetchImpl: fakeFetch(status, body).impl })).error;
  assert.equal(await answer(401, { message: 'API key is invalid' }), 'Resend did not accept the API key');
  assert.equal(await answer(403, { message: 'The API key is restricted' }), 'Resend did not accept the API key');
  assert.equal(await answer(403, { message: 'The example.com domain is not verified' }), 'Resend: The example.com domain is not verified (it was sent as Shop <shop@example.com>). Set Email from, on the System tab of the Settings page, to an address on a domain verified with Resend');
  assert.equal(await answer(422, { message: 'Invalid `to` field' }), 'Resend: Invalid `to` field');
  assert.equal(await answer(429, { message: 'Too many requests' }), 'Resend: Too many requests');
  assert.equal(await answer(500, undefined), 'Resend: answered 500');
});

test('an answer that is not an acceptance, and a network failure, are failures and never thrown', async () => {
  const none = await sendWithResend({ apiKey: 'k', email, fetchImpl: fakeFetch(200, {}).impl });
  assert.equal(none.sent, false);
  assert.match(none.error, /without saying/);
  const down = await sendWithResend({ apiKey: 'k', email, fetchImpl: fakeFetch(new Error('offline')).impl });
  assert.deepEqual(down, { sent: false, error: 'Resend could not be reached: offline' });
});

test('a key in the environment is saved as the setting once, and never over one that is already saved', () => {
  assert.equal(migrateKey({ env: ' re_old ', saved: '' }), 're_old');
  assert.equal(migrateKey({ env: 're_old', saved: 're_saved' }), '');
  assert.equal(migrateKey({ env: '', saved: '' }), '');
  assert.equal(migrateKey({ env: undefined, saved: '' }), '');
});

test('the config declares the hook, the key is a secret, and the files it names exist', async () => {
  const config = JSON.parse(await readFile(path.join(root, 'kempo-config.json'), 'utf8'));
  assert.equal(config.hooks['email:send'], './hooks/send.js');
  assert.ok(existsSync(path.join(root, 'hooks', 'send.js')));
  const key = config.settings.find(setting => setting.name === 'resend_api_key');
  assert.equal(key.type, 'secret');
  assert.equal(key.value, '');
  const from = config.settings.find(setting => setting.name === 'resend_from');
  assert.equal(from.type, 'string');
  assert.equal(from.value, '');
  const tab = await readFile(path.join(root, 'admin', 'emails-tab.global.html'), 'utf8');
  assert.match(tab, /location="admin-emails-tabs"/);
  assert.match(tab, /<k-settings-panel owner="kempo-resend">/);
});

test('the Resend From setting is used instead of the one of the site, and the one of the site is used when it is empty', async () => {
  const sentAs = async from => { const { impl, calls } = fakeFetch(200, { id: 're_1' }); await sendWithResend({ apiKey: 'k', email, from, fetchImpl: impl }); return calls[0].body.from; };
  assert.equal(await sentAs('onboarding@resend.dev'), 'onboarding@resend.dev');
  assert.equal(await sentAs('  Shop <orders@mine.test>  '), 'Shop <orders@mine.test>');
  assert.equal(await sentAs(''), 'Shop <shop@example.com>');
  assert.equal(await sentAs(undefined), 'Shop <shop@example.com>');
});

test('a Resend From that is not an address is refused before anything is sent', async () => {
  const { impl, calls } = fakeFetch(200, { id: 'x' });
  const result = await sendWithResend({ apiKey: 'k', email, from: 'not an address', fetchImpl: impl });
  assert.equal(result.sent, false);
  assert.equal(result.skipped, undefined);
  assert.match(result.error, /Resend From setting \(not an address\)/);
  assert.equal(calls.length, 0);
  for(const good of ['a@b.co', 'Shop <a@b.co>', 'onboarding@resend.dev']) assert.equal(isAddress(good), true, good);
  for(const bad of ['', 'a', 'a@b', 'a@b.co, c@d.co', 'a@b.co\nBcc: x@y.co', 5, null]) assert.equal(isAddress(bad), false, String(bad));
});

test('a refused domain names the Resend tab when that is where the sender came from, and Email from when not', async () => {
  const refused = fakeFetch(403, { message: 'The mine.test domain is not verified' });
  const fromTab = await sendWithResend({ apiKey: 'k', email, from: 'a@mine.test', fetchImpl: refused.impl });
  assert.match(fromTab.error, /it was sent as a@mine\.test\). Set Resend From on the Resend tab/);
  const fromSite = await sendWithResend({ apiKey: 'k', email, fetchImpl: fakeFetch(403, { message: 'The example.com domain is not verified' }).impl });
  assert.match(fromSite.error, /Set Email from, on the System tab/);
});
