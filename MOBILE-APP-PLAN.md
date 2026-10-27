# Kuwala Books mobile app plan

Native Android and iOS apps built with Expo (React Native), backed by the existing Cloudflare Worker and Postgres database. The web app stays as it is; the mobile app is a second client of the same server logic.

## Goals

- Store-listed apps on Google Play and the Apple App Store.
- Same marketplace, same rules, same prices: one backend, no duplicated business logic.
- Things the web can't do well: push notifications for offers and orders, camera-first selling, signed-in sessions that stick.
- Android first in practice (most Zambian users), but one codebase ships both.

## Non-goals (for v1)

- Admin tools. Admin stays on the web.
- Author verification and claim flows. Link out to the web.
- Offline browsing beyond simple caching.
- Auctions. They're planned for the marketplace; the API is versioned so they can be added later without breaking installed apps.

## Toolchain

| Need | Choice | Notes |
|---|---|---|
| Framework | Expo SDK (latest), React Native, TypeScript | Managed workflow, no ejecting |
| Navigation | Expo Router | File-based, similar to TanStack Router |
| Server data | TanStack Query | Caching, retries, pull-to-refresh |
| Styling | NativeWind (Tailwind for RN) | Port the semantic tokens and burgundy accent from `src/styles.css` |
| Font | `@expo-google-fonts/plus-jakarta-sans` | 400/500/700 only |
| Icons | `react-native-heroicons` (solid) | Used sparingly, same as web |
| Auth | `@supabase/supabase-js` + `expo-secure-store` | Session stored in the device keychain |
| Validation | `zod` | Shared schemas with the web app |
| Push | `expo-notifications` + Expo Push Service | One API for FCM (Android) and APNs (iOS) |
| Camera / photos | `expo-image-picker`, `expo-image-manipulator` | Cover photos, resize before upload |
| Images | `expo-image` | Disk caching for covers |
| Card payments | `react-native-webview` | Hosts Lenco's inline checkout |
| Deep links | Expo Linking + Android App Links + iOS Universal Links | `kuwalabooks.com/books/...` opens the app |
| Builds | EAS Build | Builds iOS in the cloud; no Mac needed |
| Store submission | EAS Submit | |
| Hot fixes | EAS Update | JS-only fixes without store review |
| Crash reporting (optional) | Sentry (`@sentry/react-native`) | Needs legal text, see Legal |
| Dev testing | Expo Go / development build on your own phone | |

### Accounts and costs

| Item | Cost |
|---|---|
| Apple Developer Program | $99 / year |
| Google Play Console | $25 once |
| Expo / EAS | Free tier to start; paid plan only if build queues get slow |
| Sentry | Free tier is enough at launch |

Apple requires a D-U-N-S number to enrol as an organisation. Apply early; it can take a couple of weeks.

## Repository layout

The app lives in this repo so it can share types, constants and copy with the web app.

```
/                     web app (unchanged)
src/
  data/               shared: copy, delivery rates, commission, statuses
  lib/money.ts        shared: ngwee formatting
  lib/phone.ts        shared: Zambian phone validation
  lib/isbn.ts         shared
  routes/api/v1/      NEW: JSON API for the app
  server/             shared server logic (already UI-independent)
mobile/               NEW: Expo app
  app/                Expo Router screens
  components/
  lib/api.ts          typed API client
  lib/supabase.ts
  app.config.ts
  eas.json
```

### What can be shared

`mobile/` imports from `../src` through a path alias (`#/*`, as the web app does), configured in Metro and `tsconfig`.

- **Safe to share:** `src/data/*`, `src/lib/money.ts`, `src/lib/phone.ts`, `src/lib/isbn.ts`, zod input schemas. These must stay free of DOM, Node, and server imports.
- **Type-only imports are fine:** `src/data/statuses.ts` imports types from `src/db/schema`; `import type` is erased at build time, so Drizzle never reaches the app bundle. Keep it that way.
- **Never share:** anything `*.server.ts`, `src/db/client.server.ts`, React components (DOM and `@base-ui/react` don't run on RN).

Commission (`COMMISSION_RATE` in `src/data/listing-options.ts`), delivery rates and every price stay calculated on the server. The app only displays what the API returns, so it can never disagree with the web on what a buyer pays.

## Backend changes

### 1. Bearer-token auth

Today `readUser()` in `src/server/auth.ts` reads the Supabase session from cookies via `getSupabase().auth.getClaims()`.

Change: if the request has `Authorization: Bearer <access token>`, verify that token with `getClaims(token)` (same local JWKS check, no extra round trip); otherwise fall back to cookies. The existing `requireUserMiddleware`, `requireSellerMiddleware` and per-request memoisation keep working for both clients.

The app gets tokens by calling Supabase Auth directly (`signInWithPassword`, `signUp`, `resetPasswordForEmail`) and refreshes them itself. No server change is needed for sign-in.

### 2. Versioned JSON API: `src/routes/api/v1/`

The app must not call `createServerFn` endpoints. They're internal RPC whose URLs and shapes can change with any deploy, and installed apps can't be forced to update the moment you push to `main`.

Each v1 route is a thin wrapper: parse with zod, call the same `src/server/*` function the matching server function calls, return JSON. Where a server function still holds logic inline, move that logic into `src/server` first so web and app share it.

Conventions:

- JSON in and out, money always as integer ngwee plus currency.
- Errors as `{ error: { code, message } }` with proper HTTP status codes.
- Cursor pagination on lists.
- Every response carries `minAppVersion`. The app shows a blocking "Update Kuwala" screen if it's older.
- Public read endpoints get `Cache-Control` like the web pages; anything per-user is `private, no-store`.
- Rate limits on write endpoints (offers, reports, reviews).
- Breaking changes go in `/api/v2`; v1 keeps working until usage of old app versions drops off.

Endpoint map, from the existing server functions:

| Area | v1 endpoints | Existing functions |
|---|---|---|
| Site | `GET /site`, `GET /home` | `getSiteContext`, `getHomeData` |
| Catalogue | `GET /search`, `GET /search/quick`, `GET /categories`, `GET /books/:slug`, `GET /authors/:slug`, `GET /publishers/:slug`, `GET /sellers/:slug`, `GET /directory` | `searchBooksFn`, `quickSearch`, `getCategories`, `getBook`, `getAuthor`, `getPublisher`, `getSeller`, `getDirectory` |
| Top 20 | `GET /chart` | `getChart` (same "not enough data yet" rule as web) |
| Reviews | `GET /books/:slug/reviews`, `POST /reviews` | `listReviews`, `writeReview` |
| Account | `GET /me`, `POST /me/terms`, `DELETE /me` | `getSessionUser`, `acceptTerms`, new deletion flow |
| Bag & checkout | `POST /bag/quote`, `GET /checkout/defaults`, `POST /orders` | `quoteBag`, `getCheckoutDefaults`, `placeOrder` |
| Payments | `POST /orders/:n/pay/mobile-money`, `POST /orders/:n/pay/card`, `POST /orders/:n/pay/check` | `startMobileMoneyPayment`, `startCardPayment`, `checkPayment` |
| Orders | `GET /orders`, `GET /orders/:n`, `POST /orders/:n/delivered`, `POST /orders/:n/problem`, `POST /orders/:n/dispute-response`, `POST /orders/:n/rating` | `getMyOrders`, `getOrder`, `confirmDelivered`, `reportProblem`, `respondToDispute`, `rateParcel` |
| Offers | `GET /offers`, `POST /offers`, `POST /offers/:id/answer`, `POST /offers/:id/withdraw` | `getMyOffers`, `makeOffer`, `answerOffer`, `withdrawOffer` |
| Selling | `GET /seller`, `PUT /seller`, `PUT /seller/delivery`, `PUT /seller/payout-details`, `GET /seller/balance`, `POST /seller/pay-me-now`, `GET /seller/standing` | `getMySeller`, `saveSellerProfile`, `saveDeliverySettings`, `savePayoutDetails`, `getMyBalance`, `payMeNow`, `getMyStanding` |
| Listings | `GET /listings`, `POST /listings`, `PATCH /listings/:id`, `GET /listings/find-book`, `GET /listings/suggest`, `GET /listings/price-guide` | `getMyListings`, `createListing`, `updateListing`, `findBookForSale`, `suggestTitles`/`suggestBookNames`, `getPriceGuide` |
| Drafts | `GET/POST/PUT/DELETE /drafts`, `POST /drafts/:id/publish` | `listDrafts`, `getDraft`, `createDraft`, `saveDraft`, `deleteDraft`, `publishDraft` |
| Sales | `GET /sales`, `POST /sales/:id/shipped` | `getMySales`, `markShipped` |
| Uploads | `POST /uploads/cover` | `uploadCover` (R2 `COVERS`) |
| AI helpers | `POST /ai/read-photos`, `POST /ai/school-list` | `readPhotos`, `readSchoolList` |
| Reports | `POST /reports` | `reportListing` |
| Push | `POST /push-tokens`, `DELETE /push-tokens/:token` | new |
| Bag sync | `GET /bag`, `PUT /bag` (optional) | new (bag is localStorage-only on web today) |

Staying web-only in v1: everything in `admin.functions.ts`, `verification.functions.ts`, `claims.functions.ts`, `author.functions.ts`. The app links to those pages.

### 3. Push notifications

- **New table `push_tokens`:** `id`, `profile_id`, `token` (Expo push token, unique), `platform` (`ios` | `android`), `app_version`, `created_at`, `last_seen_at`. Migration SQL gets shown for approval before it runs (dev and prod share one database).
- **New `src/server/push.server.ts`:** `sendPush(profileId, message)` batches to the Expo Push API and deletes tokens Expo reports as `DeviceNotRegistered`.
- **Where to send from:** the same places that already call `sendEmail`:
  - `offers.server.ts`: new offer, accepted, declined, countered, expired, "accepted, pay within 24h"
  - `orders.server.ts`: payment confirmed (buyer), new sale (seller), shipped
  - `reminders.server.ts`: "offer expires soon", "ship your order", "confirm delivery"
  - `refunds.server.ts`: refund issued
  - `payouts.server.ts`: payout sent
- **Tap targets:** every push carries a deep link path (`/account/offers`, `/orders/KB-123`) the app opens.
- **Preferences:** per-category toggles (offers, orders, selling) stored on the profile. Email stays the record; push is a nudge.

### 4. Account deletion

Required by both stores. Add `DELETE /me` plus a web equivalent in account settings. Behaviour has to respect open orders, pending payouts and disputes (block or defer until settled), anonymise reviews and ratings rather than delete them, and remove push tokens. The exact behaviour goes into `src/data/legal.ts`.

### 5. Hosted card checkout page

Lenco card payments run through Lenco's inline JS (`LencoPay.getPaid` in `src/components/payment-panel.tsx`); there is no React Native SDK.

Add a minimal page, e.g. `/pay/:orderNumber?app=1`, that only renders the card step using the existing payment panel, authenticated by a short-lived one-time token the API issues (not the long-lived access token in a URL). The app opens it in a WebView, watches for a `kuwala://payment-done` redirect or a `postMessage`, closes the WebView, and calls `POST /orders/:n/pay/check`. The Lenco webhook (`src/routes/api/webhooks/lenco.ts`) still settles the payment if the app is killed mid-flow.

Mobile money needs none of this: `startMobileMoneyPayment` sends the prompt to the buyer's phone and the app polls `checkPayment`, exactly as the web does.

### 6. Deep links

- `public/.well-known/assetlinks.json` (Android App Links) and `public/.well-known/apple-app-site-association` (iOS Universal Links), served with `Content-Type: application/json`.
- Paths the app handles: `/books/*`, `/authors/*`, `/publishers/*`, `/sellers/*`, `/orders/*`, `/account/*`, `/top-20`, `/search`, `/auth/callback`.
- Email links (sign-up confirmation, password reset, offer and order emails) therefore open the app when installed and the web otherwise.
- Auth emails: the app handles `/auth/callback` itself, calling `verifyOtp` / `exchangeCodeForSession` on the device, so the session lands in the app rather than in browser cookies.

## The app

### Screens (v1)

Separate phone layout only (no tablet layout in v1). Native tab bar at the bottom.

**Tabs:** Home · Search · Sell · Bag · Account

| Area | Screens |
|---|---|
| Browse | Home, Search (with filters), Category, Book, Author, Publisher, Seller, Directory, Zambia Top 20 |
| Buy | Bag, Checkout (address, delivery, payment), Mobile money waiting screen, Card WebView, Order confirmation |
| Orders | My orders, Order detail (track, confirm delivered, report a problem, rate parcel) |
| Offers | Make an offer sheet, My offers (buying / selling), Offer detail with accept / decline / counter and the 24h countdown |
| Sell | Start selling onboarding, Snap covers (camera), AI photo read, Listing form, Drafts, My listings, Sales, Mark shipped, Balance and payouts, Delivery settings, Payout details |
| Account | Sign in, Sign up, Forgot password, Terms acceptance, Profile, Notification settings, Delete account, Legal pages, Links to web-only features |
| System | Force update, Offline, Error |

### Behaviour that must match the web

- **Offers:** one counter each side; 24h per reply; silence declines; accepting holds the copy and the buyer gets 24h to pay. All enforced server-side; the app shows the state and countdown the API returns.
- **Delivery:** sellers can't set a rate above the platform delivery rate. The server enforces it; the app's form shows the cap.
- **Money:** integer ngwee everywhere; display through `formatMoney` from `src/lib/money.ts`. USD shown only as a display conversion.
- **Top 20:** hidden until the API says there's enough real data.
- **Terms:** if `TERMS_VERSION` changes, the API returns `termsRequired` and the app shows the acceptance screen before anything else.

### Design

Same rules as the web (see `CLAUDE.md`): one burgundy accent on semantic tokens, Plus Jakarta Sans 400/500/700, Heroicons solid used sparingly, minimal copy, no decorative effects, ghost empty states and skeletons, light and dark mode following the system setting. Use native controls (pickers, sheets, haptics) rather than imitating web components.

### State and storage

- Server data: TanStack Query, persisted to disk for fast cold starts.
- Session: Supabase client with `expo-secure-store` as its storage.
- Bag: on the device (AsyncStorage), quoted by the server on open. Optional server sync later so a bag follows the user between web and app.
- Recently viewed and onboarding drafts: on the device, as on the web.

### Performance and data costs

Mobile data is expensive in Zambia, so:

- Request resized cover variants, not originals.
- Cache covers on disk with `expo-image`.
- Paginate everything; no infinite prefetching.
- Keep the JS bundle lean; check size on every release.
- Test on a low-end Android phone (2–3 GB RAM) on a 3G connection.

## Legal and privacy

The app introduces new personal data handling, so `src/data/legal.ts` and `LEGAL_UPDATED` change in the same PR that adds each item:

- Push tokens and notification preferences (what's stored, why, how to turn off).
- Camera and photo library access (only when selling; photos used for covers and AI reading).
- Account deletion (what's deleted, what's kept and for how long, e.g. order records).
- Any crash reporting or analytics SDK. Name it, say what it collects. On mobile there's no cookie banner, so consent is an in-app toggle mirroring `hasConsent()`, and the SDK only starts after consent. List it alongside the web entries in `src/data/cookies.ts`.

Whether these are "material" enough to bump `TERMS_VERSION` is a judgment call at the time; adding push alone probably isn't.

Store declarations must match that text:

- **Apple:** App Privacy "nutrition label", camera and photo library usage strings in `app.config.ts`.
- **Google:** Data Safety form, account-deletion URL.

## App Store and Play Store

### Requirements checklist

- [ ] App name "Kuwala Books", icon from `public/brand/`, splash screen in brand colours
- [ ] Bundle IDs, e.g. `com.kuwalabooks.app` (both stores; can't change later)
- [ ] Screenshots for phone sizes (6.7" and 5.5" iPhone, Android phone)
- [ ] Short and full descriptions, keywords, category (Shopping or Books)
- [ ] Privacy policy URL: `https://kuwalabooks.com/privacy`
- [ ] Support URL and email
- [ ] In-app account deletion
- [ ] Demo reviewer account with a seller profile and sample orders (sandbox payments)
- [ ] Age rating questionnaires
- [ ] Apple: Sign in with Apple is only required if you add other third-party sign-in (Google etc.). Email and password alone doesn't trigger it.
- [ ] Payments: physical goods, so Lenco is allowed on both stores and no in-app purchase or store commission applies. Say so in the review notes.

### Release tracks

1. Internal: EAS development builds on team phones.
2. Closed testing: Google Play internal testing + Apple TestFlight with a small group of buyers and sellers in Lusaka.
3. Google requires new personal developer accounts to run a closed test with at least 12 testers for 14 days before production. Plan for it.
4. Production, staged rollout (10% → 50% → 100%) on Android.

### Updates

- JS-only changes: EAS Update, published per channel (`preview`, `production`).
- Native changes (new SDKs, permissions): a new store build.
- API breaking changes: bump `minAppVersion` only once the new build is live in both stores.

## Environments

- The app reads the API base URL and Supabase public URL/anon key from EAS environment config. No secrets in the app; everything privileged stays in the Worker.
- Dev and production share one database. Testing the app against production data means test purchases use Lenco sandbox mode, as on the web.
- `eas.json` profiles: `development`, `preview` (TestFlight / internal), `production`.

## Testing

- **API:** request tests for each v1 route (auth, validation, ownership checks: one user can never read another's orders or offers).
- **App:** component tests for money formatting, offer state display, checkout steps; Maestro flows for sign in → search → buy with mobile money (sandbox), make and answer an offer, list a book.
- **Devices:** one low-end Android, one recent Android, one iPhone. MTN and Airtel mobile money prompts both checked end to end in sandbox.

## Phases

| Phase | Scope | Rough time |
|---|---|---|
| 0. Setup | Apple and Google accounts (start D-U-N-S now), Expo project in `mobile/`, EAS config, tokens and fonts ported, shared-code aliases | 3–5 days |
| 1. Browse | Bearer auth, v1 catalogue endpoints, Home, Search, Book, Author, Publisher, Seller, Top 20, deep links | 1.5–2 weeks |
| 2. Buy | Sign in/up, terms, bag, checkout, mobile money, hosted card WebView, order confirmation, my orders | 2 weeks |
| 3. Offers and push | `push_tokens` migration, push from offers/orders/reminders, offer screens with countdown, notification settings | 1.5–2 weeks |
| 4. Sell | Seller onboarding, camera covers, AI photo read, listings, drafts, sales, mark shipped, balance, payouts | 2–3 weeks |
| 5. Store prep | Account deletion, legal updates, store listings, screenshots, privacy forms, closed testing (Google's 14 days) | 2–3 weeks |
| 6. Launch | Staged rollout, crash monitoring, fix-forward with EAS Update | ongoing |

About 2.5–3 months for one developer. Phases 1–2 produce a buy-only app that could ship on its own if you want something in the stores sooner.

## Risks and open questions

- **Apple review** is the least predictable step; allow time for at least one rejection round.
- **Lenco card flow in a WebView:** confirm with Lenco that inline checkout and 3-D Secure work inside a WebView before building phase 2's card step. If not, open the hosted page in the system browser (`expo-web-browser`) instead.
- **Keeping web and app in step:** any new marketplace feature (auctions especially) now needs an API endpoint and app screens too. Build new features API-first.
- **Old app versions:** keep v1 stable; use `minAppVersion` sparingly.
- **Push deliverability** on some Android brands (aggressive battery savers) is unreliable; email remains the source of truth.
- **Open questions:**
  - Bag sync between web and app: v1 or later?
  - Google sign-in? It's convenient on Android but would require Sign in with Apple on iOS too.
  - Who owns the Apple and Google developer accounts (personal or company)? This affects the D-U-N-S requirement and Google's 12-tester rule.

## Immediate next steps

1. Start Apple Developer (organisation) enrolment and D-U-N-S application.
2. Create the Google Play developer account.
3. Bearer-token support in `src/server/auth.ts`.
4. First v1 endpoints: `/site`, `/home`, `/search`, `/books/:slug`.
5. Scaffold `mobile/` with Expo Router, NativeWind, the shared-code alias, and Home and Book screens running against the API.
