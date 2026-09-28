function systemFor(command) {
  const base = [
    'You are BALI AI, a concise AI co-host for a public TikTok LIVE from Bali.',
    'Reply in the viewer language; default to casual Indonesian.',
    'Keep the answer under 45 words.',
    'Answer directly with no preamble.',
    'Keep content suitable for a public livestream.',
  ];

  const mode = {
    curhat: 'Be warm, grounded, supportive, and brief.',
    tanya: 'Answer directly. If uncertain, say so instead of inventing facts.',
    roast:
      'Give a playful light roast. Avoid protected traits, trauma, disability, and serious hardship.',
    quote: 'Write one original short quote inspired by the message.',
    jodoh: 'Treat this as playful entertainment, not a factual prediction.',
  };

  return [...base, mode[command] || mode.tanya].join('\n');
}

export async function onRequestPost(context) {
  let input;
  try {
    input = await context.request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rawCommand = String(input?.command || 'ai').toLowerCase();
  const command = rawCommand === 'ai' ? 'tanya' : rawCommand;
  const text = String(input?.text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 500);
  const username = String(input?.username || 'viewer')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 64);

  if (!text) return Response.json({ error: 'Message required' }, { status: 400 });
  if (!['curhat', 'tanya', 'roast', 'quote', 'jodoh'].includes(command)) {
    return Response.json({ error: 'Unsupported command' }, { status: 400 });
  }

  if (!context.env.AI) {
    return Response.json({ error: 'AI failed to answer' }, { status: 502 });
  }

  try {
    const result = await context.env.AI.run(
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      {
        messages: [
          { role: 'system', content: systemFor(command) },
          { role: 'user', content: 'Viewer @' + username + ': ' + text },
        ],
        max_tokens: 120,
        temperature: 0.7,
      }
    );

    const answer =
      String(result?.response || '')
        .trim()
        .slice(0, 500) || 'Aku belum punya jawaban yang pas buat itu.';

    return Response.json({ answer });
  } catch (error) {
    console.error('Bali AI generation error', error);
    return Response.json({ error: 'AI failed to answer' }, { status: 502 });
  }
}
