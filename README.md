# Bali Live

24H interactive TikTok LIVE visual layer.

## Public LIVE layer
GitHub Pages:
https://ardarawk-cloud.github.io/Bali-live/

Features:
- Bali clock (Asia/Makassar)
- Auto themes: Midnight / Morning / Day / Golden Hour / After Dark
- TikFinity Spotify song-request instructions
- Bali AI command instructions
- Auto version check every 30 seconds

## Bali AI — local bridge

TikFinity exposes LIVE events through its Desktop Event API WebSocket at `ws://localhost:21213/`. The local bridge in `bridge/` listens for chat commands and sends them to the OpenAI Responses API. The AI result is displayed through a transparent local overlay.

Supported commands:
- `!curhat <pesan>`
- `!tanya <pertanyaan>`
- `!ai <pertanyaan>` (alias of !tanya)
- `!roast <pesan>`
- `!quote <tema>`
- `!jodoh <pesan>`

The bridge uses `gpt-5.6-luna` by default because this LIVE workflow needs short, high-volume, cost-sensitive responses.

### First PC setup

1. Keep TikFinity Desktop running and connected to the TikTok LIVE.
2. Open the `bridge` folder on the PC.
3. Run `START-BALI-AI.bat`.
4. On first run, paste an OpenAI API key when prompted. The key is saved only to local `bridge/.env`, which is gitignored.
5. In TikTok LIVE Studio add another **Link** source:
   `http://localhost:8787/overlay.html`
6. Put that Link above the Bali Live background source.

Health check:
`http://localhost:8787/health`

The main Bali Live source remains:
`https://ardarawk-cloud.github.io/Bali-live/`

## Privacy / safety
- URLs, email addresses and phone-number-like strings are masked before being sent to the model.
- Responses are kept short for public LIVE use.
- Per-user cooldown defaults to 30 seconds.
- The OpenAI API key is never committed to this repository.
