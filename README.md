# GitHub Pulse

A runnable bilingual GitHub discovery site with daily verified email digests. The default is **DEMO mode**: repository metadata and 33 days of metrics are illustrative synthetic samples. The interface and API label them as demo data. They are not GitHub's current rankings.

## Run locally

Requires Node 24+.

```powershell
cd C:\Users\admin\Documents\Codex\2026-09-13\github-pulse\outputs\site
Copy-Item .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173/en/home` for the English default, or use `/zh/home` for Chinese. The API runs on port 3001. Build and serve one production-style process with `npm run build` then `npm start` at `http://localhost:3001/`. The site has separate `/en/home`, `/en/ranking`, and `/en/charts` pages (with matching `/zh/` paths). The centered navigation links to all three pages, Subscribe, and About. The homepage presents an introduction and four summary charts. **View charts** sits below the charts on the second screen and opens the dedicated six-screen analysis page with one large chart or two smaller charts per screen. A subscription area follows the charts at the end of the homepage; Subscribe in the navigation scrolls there. The rankings page contains the interactive list, filters, and its own subscription call to action at the end. The chart page includes 10 views of growth, project composition, Star/Fork relationships, topic and age distribution, and push recency. Board and time-window filters remain on the first screen; a small return-to-filters control appears on later desktop screens. A desktop wheel step advances one screen, while mobile retains natural scrolling for its stacked charts. The site uses one document scrollbar; tabs wrap or scroll horizontally when their labels need more room. If the browser language differs from the default English, the site offers a dismissible language suggestion.

A real GitHub collection was completed on 2026-09-13 (China time) with a temporary user-provided token: **139 public repositories** were sampled into `data/live.sqlite`. A second collection fetched GitHub's official [repository Star history](https://docs.github.com/en/rest/activity/starring#get-repository-star-history) for all 139 repositories; 136 have complete recent history for the current weekly hot ranking. The token was used for those commands only and is not stored in this project. To preview the live data locally, set `DATA_MODE=live`, `DB_PATH=./data/live.sqlite`, `PORT=3002`, and `PUBLIC_URL=http://localhost:3002` in your process environment, then run `npm start` and open `http://localhost:3002/`. The homepage shows real cumulative and daily Star additions, a top-five comparison, and language composition. Fork **net** growth is unavailable until a second daily snapshot is collected; current Star and Fork total boards are already usable.

Demo emails are recorded at `http://localhost:5173/api/demo-outbox`; open the verification link in the email's `text` field. After verification, run `npm run digest -- --force` to produce a sample daily digest; inspect the outbox again. `--force` bypasses the send hour only, not the once-per-local-day rule. The management and unsubscribe links are inside that digest.

## Live data and mail

Use a separate SQLite database for production. Set `DATA_MODE=live`, `DB_PATH=./data/live.sqlite`, `GITHUB_TOKEN`, `PUBLIC_URL`, and a long random `ADMIN_TOKEN` in `.env`. For email, set `RESEND_API_KEY` and `RESEND_FROM` using an address on a [verified Resend domain](https://resend.com/docs/api-reference/emails/send-email), or configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`. Resend takes priority when both providers are configured. Never expose these values to the frontend; `.env` is excluded from the downloadable ZIP. `ADMIN_TOKEN` also encrypts management links at rest; retain it across restarts. The current machine's anonymous GitHub request was rate-limited (HTTP 403), while the provided token completed collection. Configure your own **rotated** token for future scheduled collections; the token pasted into a conversation should not be a long-term credential. GitHub documents [anonymous versus authenticated rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) and a separate limit for [repository search](https://docs.github.com/en/rest/search/search#search-repositories).

Live email subscriptions require a working provider and a public `PUBLIC_URL` so recipients can open verification and management links. A Resend API key alone is insufficient: `RESEND_FROM` must use a verified sender domain. The demo outbox supports full local verification and digest testing without external mail.

Run `npm run collect` at about 02:00 UTC daily with a system scheduler. Run `npm run digest` hourly. The collector discovers candidates through three GitHub REST Search queries (recently pushed, AI topic, new projects), deduplicates by immutable repository ID, refreshes up to 150 known repositories per run (40 without a token), handles renames/archives/deletions, stores current snapshots, fetches the last 12 weekly Star-history buckets per repository, records sync status, and retries transient failures. `npm run history` refreshes official Star history without running discovery. The sample is a bounded candidate universe, not all of GitHub. Increase discovery coverage thoughtfully within GitHub rate limits. `GET /api/admin` and `POST /api/admin/collect` or `/digest` accept `Authorization: Bearer <ADMIN_TOKEN>` for status and manual reruns.

For example, in a cron-compatible scheduler (UTC):

```text
0 2 * * * cd /path/to/site && npm run collect
5 * * * * cd /path/to/site && npm run digest
```

Database tables migrate automatically on startup. Keep the `data` directory on persistent storage. Email delivery failures are recorded and retried up to three times. Resend digest requests use a stable idempotency key to avoid duplicate sends during retries within Resend's 24-hour window. A delivery is claimed atomically before send, so overlapping workers cannot both send it. If a worker crashes during send, the record remains `sending` for operator review rather than risking an automatic duplicate.

## Ranking methodology

`hot` = 45% log-scaled period Star gain + 20% Star gain divided by starting Stars plus 100 + 15% log-scaled Fork gain + 20% recent push recency. Each input is normalized against the filtered candidate set. In live mode, Star gain is **new Stars created** in GitHub's official history day buckets; this is not the net difference in total Stars and its day boundaries may differ from UTC. Fork gain remains a net difference between our daily snapshots. While Fork gain is unavailable, its 15% component is omitted and the remaining weights are renormalized. Demo mode uses synthetic snapshot net changes for both. The period can be 1, 7, or 30 days; snapshot boundaries require a match within 6 hours. Anomalous gains over three times a previous comparable period (and over 100 Stars) get no hot score pending review. `rising` sorts absolute gain; `new` limits age to 90 days and minimum 20 Stars; `ai` filters by published topic keyword evidence before hot ranking; `stars` and `forks` sort current cumulative totals. Search, language, topic, age and pagination act on these result sets. Without complete history, gains and score are null, shown as “数据不足 / Insufficient data.”

The activity component is **push recency**, a proxy, not PR/issue/release activity. Scores are relative to the sampled candidate universe and selected filters. API sampling is approximate, delayed, and subject to GitHub limits. The site says “recently trending,” not “real-time.” The live cumulative and daily charts use official new-Star history for the leading repository; the demo charts show synthetic net changes. Bars compare the top five using the same metric and window. The donut groups programming languages in the first 50 repositories of the selected ranking and filters, with remaining languages combined as Other. When a selected live board lacks usable history, Stars/Forks total boards show current totals instead. Charts are rendered with [Recharts](https://recharts.github.io/en-US/).

## Design and component provenance

`DESIGN.md` combines the [Wired guide in awesome-design-md](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/wired/DESIGN.md) for high-contrast editorial typography, a black footer band, and square controls with the [Apple guide's](https://github.com/VoltAgent/awesome-design-md/blob/main/design-md/apple/DESIGN.md) viewport-sized section rhythm and single-color emphasis. GitHub Pulse uses its own restrained blue for chart series and active navigation. Scroll snapping and fade/slide transitions are implemented for this site; no brand artwork was copied.

Three adapted 21st.dev component patterns are integrated in `src/components.jsx`: [float_ui Radix tabs](https://21st.dev/community/components/float_ui/tabs-2/tabs-with-background-color) for board navigation, [float_ui Radix dialog](https://21st.dev/community/components/float_ui/modal-dialog/modal-with-newsletter) for subscription, and [HextaUI clearable input](https://21st.dev/community/components/preetsuthar17/input) for search. All dropdowns now use [Radix Select](https://www.radix-ui.com/primitives/docs/components/select) with a shared visual treatment; the menu, selected row, and focus state are rendered by the app instead of the operating system. No preview assets or branding were copied. Credits remain here in the developer README rather than in the user-facing interface. The components use keyboard-operable Radix primitives, proper labels and focus styles; mobile layouts are checked separately.

## Roadmap

Next: broaden candidate discovery; add current PR/release signals for a separate maintenance board; use GitHub issue labels for contribution opportunities; add release alerts; enhance anti-manipulation review and administrator controls. These are not currently claimed as implemented.
