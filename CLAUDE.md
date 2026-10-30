# Kuwala Books

Book marketplace for Zambia (kuwalabooks.com). Anyone can sell new or used books; Zambian books and authors come first.

## Stack
- TanStack Start on Cloudflare Workers. Server functions in `src/functions/*.functions.ts`, server-only code in `src/server/*.server.ts`.
- Postgres on Supabase through Drizzle + postgres.js (Hyperdrive `kuwala-db` in production). Supabase is used for Auth only.
- Lenco v2 for mobile money and card payments and seller payouts. Resend for email.
- R2 bucket `kuwala-covers` (binding `COVERS`) for uploaded covers.
- Cron every 15 minutes runs `src/server/jobs.server.ts`.
- Native apps are planned (`MOBILE-APP-PLAN.md`), so keep the web one client among several:
  - Server functions stay thin: validate, call a `src/server` function, return. Business logic lives in `src/server/*.server.ts`, taking `db` and the user or seller as arguments.
  - Input schemas live in `src/schemas/`. They, `src/data/` and `src/lib/money.ts`, `phone.ts`, `isbn.ts` must not import web-only (DOM, React, Heroicons) or server-only code; `src/data/admin.ts` and `navigation.ts` are the web-only exceptions.
  - Throw `AppError(message, code)` (`src/server/errors.server.ts`) for anything the person can act on; the message is shown as written. Throw `NotFoundError` for a missing or someone else's record and wrap the server function in `orNotFound` to get the router's 404.
  - Email members through `notify(topic, message)` (`src/server/notify.server.ts`), not `sendEmail`, so push can be added in one place. `sendEmail` is for the team inbox and people without an account.
  - Sessions come from cookies (web) or an `Authorization: Bearer` Supabase access token (apps), read in `src/server/session.server.ts`.

## Commands
- `npm run dev`, `npm run typecheck`, `npm run build` (also regenerates `src/routeTree.gen.ts`).
- `npx drizzle-kit generate --name <name>` then `npx drizzle-kit migrate` (uses `DIRECT_DATABASE_URL`).

## Rules
- Dev and production share one database. Show migration SQL and get approval before running it.
- Never print connection strings or secrets.
- Deploys happen on push to `main` (Workers Builds). Ask before pushing.
- Money is integer ngwee (K1 = 100). ZMW is the only charged currency; USD is display-only.
- Commission (10%) is on items only; the whole delivery fee goes to the seller. Sellers can't charge more than the platform delivery rate.
- Publicly cached pages decide per-user UI on the client.
- Don't run Prettier over existing files; most aren't Prettier-formatted.
- Content and copy lists live in `src/data/`.
- The legal pages (`src/data/legal.ts`) describe how the site actually behaves and say only "Kuwala Books". Any change to fees, delivery, payouts, refunds, disputes, offers, reviews or how personal data is handled must update that text and `LEGAL_UPDATED` in the same change. Numbers come from the constants the code uses; never type a number there by hand. Bump `TERMS_VERSION` only for material changes (it makes every signed-in user accept again). New cookies or trackers go in `src/data/cookies.ts` and load only behind `hasConsent()`.

## Design
One burgundy accent on semantic tokens, white pages with neutral grey boxes and hairlines, Manrope for headings and book titles, Inter for body and UI (400/500/700, metric-matched fallbacks in `styles.css`), Heroicons solid used sparingly, minimal copy, no decorative effects, ghost empty states and skeletons, light and dark mode, separate mobile and desktop layouts.
- Corners: covers 4px, controls 10px (`rounded-control`: buttons, fields, search), cards and panels 12px, fully round only for chips, badges, toggles and avatars.
- Shadows only on floating things (menus, dialogs, sticky bars, shelf arrows), never on book cards or covers in lists.
- Zambian books carry the flag (`public/brand/zambia-flag.webp`) in the cover's corner on cards; pages keep the "Zambian author" label.

## Marketplace rules
- **Offers (eBay-style):** per-listing "open to offers" with an optional hidden floor. 24h per reply; silence declines. One counter each: buyer offers, seller accepts/declines/counters, buyer accepts/declines/counters, seller gives the final answer. An accept holds the copy and the buyer has 24h to pay. Listings stay up while offers are open.
- **Zambia Top 20:** Zambian authors only, distinct buyers, 30 days weighted to recent, weekly snapshot. Never shown as a chart until there is enough real data.
- **Auctions (planned):** eBay-style auctions will be added as another way to sell. Keep the listing and offer model open to it.
