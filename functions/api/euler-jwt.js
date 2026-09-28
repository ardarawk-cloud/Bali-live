const EULER_BASE = 'https://tiktok.eulerstream.com';
const TIKTOK_USERNAME = 'ardamoron';

export async function onRequestGet(context) {
  const apiKey = context.env.EULER_API_KEY;
  if (!apiKey) {
    return Response.json({ configured: false, username: TIKTOK_USERNAME });
  }

  try {
    const meRes = await fetch(EULER_BASE + '/accounts/me', {
      headers: { 'X-Api-Key': apiKey },
    });
    const me = await meRes.json();
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

    const jwt = await jwtRes.json();
    if (!jwtRes.ok) throw new Error('Euler JWT creation failed');

    const token = jwt?.token ?? jwt?.data?.token;
    if (!token) throw new Error('Euler JWT token missing');

    return Response.json({
      configured: true,
      token,
      username: TIKTOK_USERNAME,
      expiresIn: 7200,
    });
  } catch (error) {
    console.error('Euler JWT error', error);
    return Response.json(
      { error: 'TikTok cloud connection unavailable' },
      { status: 502 }
    );
  }
}
