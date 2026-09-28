# Bali Live Cloud — AppDeploy → GitHub + Cloudflare

This branch is the Cloudflare migration of the exact AppDeploy snapshot from app `bali-live-cloud-am5ou3`.

## Preservation rule

The visual layout, text, interaction flow, Euler Stream connection behavior, commands, and public API shapes are preserved.

The exact untouched AppDeploy source is archived on branch `appdeploy-snapshot-20260929`.

Only infrastructure-specific pieces are adapted:
- `@appdeploy/client` → local fetch-compatible shim.
- AppDeploy backend routes → Cloudflare Pages Functions with the same route paths and JSON shapes.
- AppDeploy AI runtime → Cloudflare Workers AI binding `AI`.

## Cloudflare Pages settings

- Framework preset: Vite
- Build command: `npm run build`
- Build output: `dist`
- Production branch: `cloudflare-migration`
- Pages Functions: auto-detected from `functions/`
- Workers AI binding: `AI`
- Secret required for TikTok/Euler: `EULER_API_KEY`

Do not remove the AppDeploy deployment until the Cloudflare URL is verified end-to-end.
