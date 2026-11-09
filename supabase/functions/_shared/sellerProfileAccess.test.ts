import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function readProfiles(table: string, token?: string) {
  if (!url || !key) throw new Error('Project connection is required for the live seller access regression checks.');
  const response = await fetch(`${url}/rest/v1/${table}?select=user_id,username,last_sign_in_at,created_at,updated_at`, {
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}` },
  });
  expect(response.status).toBe(200);
  return await response.json() as Array<Record<string, string | null>>;
}

test('installed clients can read public sellers without exact activity dates', async () => {
  const profiles = await readProfiles('profiles_public');
  expect(profiles.length).toBeGreaterThan(0);
  for (const profile of profiles) {
    for (const field of ['last_sign_in_at', 'created_at', 'updated_at']) {
      const value = profile[field];
      if (value) expect(new Date(value).toISOString().slice(11)).toBe('00:00:00.000Z');
    }
  }
});

test('signed-in installed clients can read the same public sellers', async () => {
  const sessionPath = process.env.FLEA_TEST_SESSION_FILE;
  if (!sessionPath) throw new Error('Set FLEA_TEST_SESSION_FILE to a locally minted test session.');
  const { session } = JSON.parse(readFileSync(sessionPath, 'utf8'));
  const publicProfiles = await readProfiles('profiles_public');
  const signedInProfiles = await readProfiles('profiles_public', session.access_token);
  expect(signedInProfiles.map(p => p.user_id).sort()).toEqual(publicProfiles.map(p => p.user_id).sort());
});

test('current clients retain coarse 10-day seller availability markers', async () => {
  const profiles = await readProfiles('seller_profiles');
  expect(profiles.length).toBeGreaterThan(0);
  const now = Date.now();
  for (const profile of profiles) {
    if (!profile.last_sign_in_at) continue;
    const age = now - new Date(profile.last_sign_in_at).getTime();
    expect(Math.abs(age) < 60_000 || Math.abs(age - 11 * 86_400_000) < 60_000).toBe(true);
  }
});