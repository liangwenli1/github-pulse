# Verification notes

Checked on 2026-09-13 (Asia/Shanghai):

- `npm test`: API, snapshot boundary, AI/new-board filtering, verified subscription, combined daily digest, management, one-click unsubscribe, and once-per-day delivery checks pass.
- `npm run build`: production frontend builds. Vite reports harmless Radix `use client` directive notices.
- `npm audit --omit=dev --audit-level=high`: no reported vulnerabilities.
- Browser checks at 1440px and 390px: dark/light layout, no horizontal overflow, demo growth line and top-five bars, board switch, footer language switch, subscription dialog.
- Live GitHub collection using the temporarily supplied token: 139 public repositories and official Star history for all 139 stored in `data/live.sqlite`. The token was not saved in the project. A weekly hot ranking has 136 candidates with complete recent Star history. Live Chinese and English previews show ranked rows and chart bars without horizontal overflow.

Open items for production: configure a new GitHub token for scheduled daily collection, a persistent database, SMTP delivery, `PUBLIC_URL`, and `ADMIN_TOKEN`. There is only one real **total-count** snapshot so far, so Fork net gains remain unavailable until later samples; official historical new-Star counts and hot scores are available now. No SMTP credentials or deployed server were supplied; live email delivery and public deployment remain unverified.
