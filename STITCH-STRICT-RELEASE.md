# Stitch UI exact-source build — 2026-10-17

Source of truth: user-provided ZIP `stitch_pickpocket_radar_redesign (1).zip`, desktop `_1/code.html`, mobile `_2/code.html`, two design guides and illustrations.
The public root `index.html` retains the desktop source's headings/copy/layout; `stitch-mobile.html` retains mobile source and is selected below 700px. Source Tailwind classes were built into local production CSS files (not third-party Tailwind JS CDN).
`stitch-integrate.js` wires city search, date/city/item filters, 2km map display circles, documented incident cards, shareable personal report/poster preview, downloading preview as PNG, OS sharing (select WeChat where available), WeChat top-right sharing instructions, link/text copying, safety guide popups and official emergency contacts.
All fabricated demo risk percentages, SSS risk grades, first-person visitor stories, fake incident feed counts and anonymous testimonial quotes are withheld; runtime data use only approved sources from `/api/events-v2`, `/api/hotspots`, `/api/reports`, with approved static case snapshot fallback.
The public reporting form continues at `/legacy.html#report`; its service switch remains disabled until production posting, privacy and moderation acceptance. Poster-sharing is a *local draft*, not posted to a public feed.
Map overlays use illustrative 2km radius, NOT real documented crime effect radius. Mainland China map tiles/CDN and WeChat/browser sharing still need hardware acceptance tests.
Original illustrations are optimized from user-supplied ZIP and preserved in `/stitch-assets`.
Backend endpoints and moderator panel have not been removed.
