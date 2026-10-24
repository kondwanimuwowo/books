# Kuwala Books

Book marketplace for Zambia (kuwalabooks.com). Anyone can sell new or used books; Zambian books and authors come first.

## Stack
- TanStack Start on Cloudflare Workers. Server functions in `src/functions/*.functions.ts`, server-only code in `src/server/*.server.ts`.
- Postgres on Supabase through Drizzle + postgres.js (Hyperdrive `kuwala-db` in production). Supabase is used for Auth only.
- Lenco v2 for mobile money and card payments and seller payouts. Resend for email.
- R2 bucket `kuwala-covers` (binding `COVERS`) for uploaded covers.
- Cron every 15 minutes runs `src/server/jobs.server.ts`.

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

## Design
One burgundy accent on semantic tokens, Plus Jakarta Sans 400/500/700, Heroicons solid used sparingly, minimal copy, no decorative effects, ghost empty states and skeletons, light and dark mode, separate mobile and desktop layouts.

## Marketplace rules
- **Offers (eBay-style):** per-listing "open to offers" with an optional hidden floor. 24h per reply; silence declines. One counter each: buyer offers, seller accepts/declines/counters, buyer accepts/declines/counters, seller gives the final answer. An accept holds the copy and the buyer has 24h to pay. Listings stay up while offers are open.
- **Zambia Top 20:** Zambian authors only, distinct buyers, 30 days weighted to recent, weekly snapshot. Never shown as a chart until there is enough real data.
- **Auctions (planned):** eBay-style auctions will be added as another way to sell. Keep the listing and offer model open to it.
