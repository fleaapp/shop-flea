import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const sessionPath = process.env.FLEA_TEST_SESSION_FILE;
const session = sessionPath ? JSON.parse(readFileSync(sessionPath, 'utf8')).session : null;

async function invoke(name: string, body: unknown, token = key) {
  if (!url || !key) throw new Error('Project connection required');
  return fetch(`${url}/functions/v1/${name}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const forged = `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ sub: '00000000-0000-4000-8000-000000000001', role: 'service_role', exp: 9999999999 }))}.forged`;

test('forged identity cannot invoke admin thumbnail maintenance', async () => {
  const response = await invoke('backfill-listing-thumbnails', {}, forged);
  expect([401, 403]).toContain(response.status);
});
test('forged identity cannot target welcome alerts', async () => {
  const response = await invoke('send-welcome-notification', {}, forged);
  expect(response.status).toBe(401);
});
test('ordinary users cannot select transactional email recipients', async () => {
  if (!session) throw new Error('Signed-in session required');
  const response = await invoke('send-transactional-email', {}, session.access_token);
  expect([401, 403]).toContain(response.status);
});
test('signed-in push caller is verified before input validation', async () => {
  if (!session) throw new Error('Signed-in session required');
  const response = await invoke('register-push-subscription', {}, session.access_token);
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe('Missing endpoint');
});
test('normal provider and device checks retain their signup contract without financial details', async () => {
  const provider = await invoke('check-email-provider', { email: `scanner-${crypto.randomUUID()}@example.test` });
  expect(provider.status).toBe(200);
  expect(await provider.json()).toEqual({ provider: null });
  const device = await invoke('check-device-eligibility', { deviceId: `web_${crypto.randomUUID()}` });
  expect(device.status).toBe(200);
  expect(await device.json()).toEqual({ eligible: true });
});