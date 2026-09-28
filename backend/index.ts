import { router, json, error, ai, secrets } from '@appdeploy/sdk';

const EULER_BASE = 'https://tiktok.eulerstream.com';
const TIKTOK_USERNAME = 'ardamoron';
const BUILD_ID = 'radio-v2-20260923a';

async function readEulerKey() {
  const names = await secrets.listSecretNames();
  if (!names.includes('EULER_API_KEY')) return null;
  return secrets.readSecret('EULER_API_KEY');
}

async function mintEulerJwt() {
  const apiKey = await readEulerKey();
  if (!apiKey) return { configured: false as const };

  const meRes = await fetch(EULER_BASE + '/accounts/me', {
    headers: { 'X-Api-Key': apiKey },
  });
  const me = (await meRes.json()) as any;
  if (!meRes.ok) throw new Error('Euler account lookup failed');

  const accountId =
    me?.account?.id ?? me?.data?.account?.id ?? me?.id ?? me?.account_id;
  if (!accountId) throw new Error('Euler account id missing');

  const jwtRes = await fetch(
    EULER_BASE + '/accounts/' + accountId + '/jwt/create',
    {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limits: { minute: 10, hour: 60, day: 300 },
        expireAfter: 7200,
        name: 'bali-live-browser',
      }),
    }
  );

  const jwt = (await jwtRes.json()) as any;
  if (!jwtRes.ok) throw new Error('Euler JWT creation failed');

  const token = jwt?.token ?? jwt?.data?.token;
  if (!token) throw new Error('Euler JWT token missing');

  return {
    configured: true as const,
    token,
    username: TIKTOK_USERNAME,
    expiresIn: 7200,
  };
}

function systemFor(command: string) {
  const base = [
    'You are BALI AI, a concise AI co-host for a public TikTok LIVE from Bali.',
    'Reply in the viewer language; default to casual Indonesian.',
    'Keep the answer under 45 words.',
    'Answer directly with no preamble.',
    'Keep content suitable for a public livestream.',
  ];

  const mode: Record<string, string> = {
    curhat: 'Be warm, grounded, supportive, and brief.',
    tanya: 'Answer directly. If uncertain, say so instead of inventing facts.',
    roast:
      'Give a playful light roast. Avoid protected traits, trauma, disability, and serious hardship.',
    quote: 'Write one original short quote inspired by the message.',
    jodoh: 'Treat this as playful entertainment, not a factual prediction.',
  };

  return [...base, mode[command] || mode.tanya].join('\n');
}

export const handler = router({
  'GET /api/_healthcheck': [
    async () =>
      json({ message: 'Success', mode: 'cloud', username: TIKTOK_USERNAME, buildId: BUILD_ID }),
  ],

  'GET /api/euler-jwt': [
    async () => {
      try {
        const result = await mintEulerJwt();
        if (!result.configured)
          return json({ configured: false, username: TIKTOK_USERNAME });
        return json(result);
      } catch (e) {
        console.error('Euler JWT error', e);
        return error('TikTok cloud connection unavailable', 502);
      }
    },
  ],

  'POST /api/ai': [
    async ({ body }) => {
      const input = (body || {}) as {
        command?: string;
        text?: string;
        username?: string;
      };
      const rawCommand = String(input.command || 'ai').toLowerCase();
      const command = rawCommand === 'ai' ? 'tanya' : rawCommand;
      const text = String(input.text || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 500);
      const username = String(input.username || 'viewer')
        .replace(/[^a-zA-Z0-9_.-]/g, '')
        .slice(0, 64);

      if (!text) return error('Message required', 400);
      if (!['curhat', 'tanya', 'roast', 'quote', 'jodoh'].includes(command))
        return error('Unsupported command', 400);

      try {
        const result = await ai.generate({
          system: systemFor(command),
          prompt: 'Viewer @' + username + ': ' + text,
          maxTokens: 120,
          thinkingMode: 'NONE',
          temperature: 0.7,
        });

        return json({
          answer:
            String(result.text || '')
              .trim()
              .slice(0, 500) || 'Aku belum punya jawaban yang pas buat itu.',
        });
      } catch (e) {
        console.error('Bali AI generation error', e);
        return error('AI failed to answer', 502);
      }
    },
  ],
});
