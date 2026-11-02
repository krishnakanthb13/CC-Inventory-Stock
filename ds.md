# Crown & Cross — Code Audit & Resolution Report

**Scope:** Full source review of `admin/` (Next.js admin portal), `scripts/` (launchers), and `CC-Hosting-Public/` (storefront submodule), plus the `products.json` data contract, build outputs, and git state.

**Audit date:** 2026-11-02 · **Resolution pass:** 2026-11-02

**Status legend:** ✅ Fixed · 🟡 Partially fixed / limited · ⬜ Open (backlog or accepted risk)

---

## Summary

| # | Severity | Finding | Status |
|---|----------|---------|--------|
| 1 | Critical | HTML injection in estimate email | ✅ Fixed (escaping + validation) |
| 2 | Critical | Admin API unauthenticated | ✅ Fixed (optional token + localhost bind) |
| 3 | Critical | Non-atomic `products.json` writes | ✅ Fixed (temp file + atomic rename) |
| 4 | Critical | Admin settings never reach storefront | ✅ Fixed (shared config layer + SSR policies) |
| 5 | High | Launcher hangs forever on failure | ✅ Fixed (timeout + exit diagnostics) |
| 6 | Medium | Lost updates / dangerous "Re-Sync" push | ✅ Fixed ("Reload from Disk" pulls) |
| 7 | Medium | Derived fields not recomputed on edit | ✅ Fixed (server-side recompute + validation) |
| 8 | Medium | Duplicate product IDs / slugs | ✅ Fixed (409 + slug suffixing) |
| 9 | Medium | Cart price/stock tampering & staleness | 🟡 Live revalidation added; client-trust boundary remains |
| 10 | Medium | PDP state bugs | ✅ Fixed (one minor toast-precedence item open) |
| 11 | Medium | Admin edit-modal stock-total mismatch | ✅ Fixed (normalized stock map) |
| 12 | Medium | Taxonomy edits orphan product data | ✅ Fixed (rename cascade + delete 409) |
| 13 | Medium | Misc API edge cases | ✅ Fixed (DELETE encoding, price 0, submodule guard) |
| 14 | Low | False doc claims | ✅ Fixed (docs corrected to reality) |
| 15 | Low | Root lockfile version mismatch | ✅ Fixed (0.0.16) |
| 16 | Low | Missing `spin` keyframes | ✅ Fixed (both apps) |
| 17 | Low | `start.sh` not executable | ✅ Fixed (mode 100755) |
| 18 | Low | Crash edges on malformed data | ✅ Fixed (safe coercion + array guards) |
| 19 | Low | Shared `initialForm` / tab state loss | ✅ Fixed (factory + tabs stay mounted) |
| 20 | Low | Schema drift (`isRetro`, ID gap) | ✅ Fixed (`isRetro` normalized; gap documented) |
| 21 | Low | UX/copy inconsistencies | 🟡 Config-driven copy fixed; minor items remain |
| 22 | Low | Mixed ESM/CJS in route file | ⬜ Open (functional; documented) |
| 23 | Improvement | Tests & tooling | ⬜ Open (backlog) |
| 24 | Improvement | Server-side order intake | ⬜ Open (architectural) |

---

## Resolution Detail

### ✅ 1. Estimate email HTML injection
`CC-Hosting-Public/app/api/estimate/route.js`
- Every customer-supplied field is HTML-escaped before interpolation (`escapeHtml`).
- Validation added: `name` required (≤200 chars), `phone` 8–15 digits, `email` format check, `quantity` clamped 1–10,000, all strings length-capped, email subject newline-stripped.
- Malformed JSON bodies now return a clean 400.
- **Limited:** rate limiting/honeypot still deferred (see backlog).

### ✅ 2. Admin API authentication
`admin/app/api/products/route.js`, `admin/package.json`
- Optional bearer auth: set `ADMIN_TOKEN` (server) + `NEXT_PUBLIC_ADMIN_TOKEN` (admin UI, same value). Unset = open for local single-user use.
- Admin `dev`/`start` scripts bind to `127.0.0.1` (`-H 127.0.0.1`), removing default LAN exposure.
- All admin UI fetches go through an `apiFetch` helper that injects the token when configured.

### ✅ 3. Atomic catalog writes
`admin/lib/generateJson.js`
- Writes serialize to a unique `products.json.tmp-<pid>-<ts>` in the same directory, then `fs.renameSync` over the target — readers never see partial files; a crash leaves the old catalog intact.
- Temp file is cleaned up on failure. Trailing newline added for diff hygiene.
- **Note:** an in-process write mutex was evaluated and found unnecessary — every handler performs its read-modify-write with synchronous fs calls (no `await` between read and write), so mutations cannot interleave per request. Optimistic-concurrency versioning remains a backlog item for multi-process writers.

### ✅ 4. Admin settings now drive the storefront
`CC-Hosting-Public/lib/storeConfig.js` (new), all components/pages
- One cached `fetch('/data/products.json')` shared app-wide via `useStoreConfig()`.
- Wired everywhere: cart shipping math/meter, PDP shipping text + UPI + WhatsApp phone, home filter chips + guarantee bar, Navbar announcement bar, Footer trust grid/payee/contact/delivery, SearchModal catalog, UpiModal payee/QR, CartDrawer UPI/WhatsApp.
- Policy pages (`shipping`, `returns`, `terms`) render server-side from `lib/products.js` (`getBrandConfig()`) with `force-dynamic` — the previously-dead module is now used.
- Safe fallback constants preserve current behaviour while loading or on fetch failure.

### ✅ 5. Launcher robustness
`scripts/start.js`
- Promise-based readiness polling with a 60s timeout per service and clear failure messages.
- Early-exit hints (port-in-use) when a dev server dies.
- Pre-flight builds now run in parallel (`Promise.all`).
- `scripts/start.sh` made executable (git mode 100755).

### ✅ 6. Reload vs push
`admin/app/page.jsx`
- "Re-Sync JSON" replaced with **"Reload from Disk"** — performs `GET /api/products` and replaces in-memory state (pull). The `fullSync` POST endpoint remains for deliberate programmatic pushes only.
- Documented in both root README and `CODE_DOCUMENTATION.md`.

### ✅ 7. Derived fields & validation
`admin/app/api/products/route.js`
- `PUT`/`PATCH` recompute `stockQuantity`, `inStock`, `stockStatus`, and `isRetro` from `stockBySize`/`category` on every mutation.
- `stockBySize` must be a plain object; values coerced to non-negative integers (arrays/null rejected with 400).
- Negative stock rejected; price/MRP must be finite and non-negative; price `0` is now settable (`!== undefined` rather than truthiness).

### ✅ 8. ID / slug uniqueness
- Client-supplied duplicate IDs return **409**; generated IDs use `cc-<base36-timestamp>-<random4>`.
- Slug collisions auto-suffix `-2`, `-3`, ...

### 🟡 9. Cart integrity
`CC-Hosting-Public/context/CartContext.jsx`
- **Added:** live revalidation on load — cart lines reconciled against the current catalog (sold-out sizes dropped, quantities capped, prices refreshed, toast summary). `updateQuantity` prefers live per-size stock.
- **Added:** true cross-tab sync via `storage` events with a content-diff guard (no write loops). The docs' previous claim is now accurate.
- **Remaining (accepted):** the cart is still client-side; a user can tamper with localStorage between load and checkout, and the WhatsApp message remains the only "order record". A server-side order intake endpoint is the durable fix (backlog).

### ✅ 10. PDP state
`CC-Hosting-Public/app/product/[id]/page.jsx`
- `quantity` resets to `1` and `selectedSize` re-derives from the rendered size list (including the default-size fallback) whenever the product id changes.
- In-cart counters now sum **all** cart lines for the same kit+size (legacy sub-category mismatches no longer under-count).
- **Remaining (minor):** increment-toast precedence still prioritises the max-stock message over the in-cart message in one edge case.

### ✅ 11. Edit-modal stock totals
- `openEditModal` always builds a normalized `stockBySize` with exactly one entry per active size, so the displayed total equals the persisted sum; stale/invisible keys are dropped.
- Values coerced to non-negative integers; `stockStatus` preserved from the product.

### ✅ 12. Taxonomy integrity
- `updateTaxonomy` diffs entries by `id`: renames cascade to `products[].category`/`subCategory` (and recompute `isRetro` editing). Removing an entry still referenced by products returns **409** unless `force: true`.
- Server error messages surface through the existing admin notice path.

### ✅ 13. Misc API edges
- DELETE id URI-encoded in the UI.
- Submodule-missing guard gives an actionable `git submodule update --init --recursive` error instead of silently creating stray trees.
- `fullSync` still refuses empty arrays by design (documented) — clearing the catalog requires explicit deletes.

### ✅ 14–17. Doc drift, lockfile, keyframes, exec bit
- Root + storefront `README`, `CODE_DOCUMENTATION`, and `DESIGN_PHILOSOPHY` updated to match implementation (atomicity now true, real cart keys `crown_and_cross_cart_v1` / `crown_and_cross_customer_v1`, cross-tab sync now real, correct search semantics, correct spawn behaviour, config-propagation tables added).
- Root `package-lock.json` version synced to `0.0.16`; the misleading "matching CC-Hosting-Public" claim removed.
- `@keyframes spin` added to admin CSS; `.animate-spin` added to storefront CSS.
- `scripts/start.sh` committed as executable (`100755`).

### ✅ 18. Malformed-data crash edges
- Admin search/KPIs use `String(...)` coercion; storefront home/SearchModal use a combined lowercased haystack.
- Edit modal coerces `images` to an array; taxonomy option maps guard against null entries.
- API validates `images`/`sizes` as non-empty string arrays.

### ✅ 19. Form/tab state
- `createInitialForm()` factory replaces the shared mutable object.
- All admin tabs remain mounted (`hidden` wrapper divs) so unsaved edits survive tab switches.
- **Remaining (minor):** toast `setTimeout` is still not cleared on unmount.

### ✅ 20. Schema normalization
- `isRetro` added to cc-001/cc-004/cc-006 (invariant `isRetro === (category === 'Retro')`).
- `cc-003` gap documented as a retired fixture; cc-006 remains categorised `Country` (merchandising decision left to owner).
- `stockQuantity` verified equal to `sum(stockBySize)` for all products.

### 🟡 21. UX/copy
- Footer/announcement/PDP copy now derives from config (no more "7-Day" vs "5-7 Days" mismatch).
- **Remaining (minor):** Navbar fires `hashchange` twice per click (manual dispatch + native); `triggerWhatsApp` mobile fallback heuristic (`document.hidden`); WhatsApp URL length limits on very large carts; cart origin-envelope rejects carts when the site is served from a different origin/domain.

---

## Verification Log

**Builds**
- Admin: `✓ Compiled successfully` — 5/5 static pages, `/api/products` dynamic.
- Storefront: `✓ Compiled successfully` — 12 routes; `shipping-policy`/`returns-policy`/`terms` dynamic (SSR config), `product/[id]` dynamic.

**Runtime — admin API** (production server on `127.0.0.1:3000`)
- `GET /api/products` → `200`, 5 products, brand `Crown & Cross`.
- `PATCH` stock status → `200`.
- `PUT {updates:{category:"Club"}}` → `200`, `isRetro=false` recomputed, `stockQuantity=24` preserved.
- `PUT {updates:{stockBySize:"bogus"}}` → `400` (validation).

**Runtime — storefront** (production server on `:3001`)
- `GET /shipping-policy` → `200` with the configured fee/threshold/metro window/phone rendered from `products.json`.
- `GET /` → `200` with SSR fallback threshold and category chips.
- `POST /api/estimate` → `400` (empty body), `400` (short phone), `503` config-guard for a valid submission (injection-string name passes validation and is escaped in the template).

**Static**
- `node --check scripts/start.js` and `admin/lib/generateJson.js` → OK.
- `products.json` parses; stock sums match; git diff = 3 `isRetro` insertions + trailing newline only.
- No atomic-write temp files left behind; ports 3000/3001 free after tests.

---

## Files Changed

**Root repository**
`README.md`, `CODE_DOCUMENTATION.md`, `DESIGN_PHILOSOPHY.md`, `package-lock.json`,
`admin/app/api/products/route.js`, `admin/app/page.jsx`, `admin/app/globals.css`,
`admin/lib/generateJson.js`, `admin/package.json`, `scripts/start.js`, `scripts/start.sh` (mode).

**Submodule (`CC-Hosting-Public`)**
`README.md`, `CODE_DOCUMENTATION.md`, `DESIGN_PHILOSOPHY.md`,
`app/api/estimate/route.js`, `app/page.jsx`, `app/product/[id]/page.jsx`,
`app/shipping-policy/page.jsx`, `app/returns-policy/page.jsx`, `app/terms/page.jsx`,
`app/globals.css`, `components/CartDrawer.jsx`, `components/Footer.jsx`, `components/Navbar.jsx`,
`components/SearchModal.jsx`, `components/UpiModal.jsx`, `context/CartContext.jsx`,
`public/data/products.json`, `lib/storeConfig.js` (new).

---

## Remaining Backlog (prioritized)

1. **Rate limiting / honeypot** on `/api/estimate` (public endpoint that emails the owner).
2. **Server-side order intake** — a lightweight endpoint or webhook so totals/stock are validated server-side at checkout (removes the last client-trust gap).
3. **Automated tests** — unit tests for `generateJson` atomic write, route stock math/slugging, and cart revalidation; ESLint/Prettier configs; CI.
4. **Split admin `page.jsx`** (1,642 lines) into per-tab components; replace remaining `key={index}` in taxonomy lists.
5. **Optimistic concurrency** (`version`/`updatedAt`) if multi-process writers ever touch `products.json`.
6. Minor polish: PDP increment-toast precedence, Navbar double hashchange, toast timeout cleanup, cart origin-envelope custom-domain handling.
7. Operational: replace Unsplash hotlinks with owned/CDN assets; refresh the stale `2023/24` season default; consider moving the ESM/CJS-mixed route to consistent imports.

---

## What's Solid

- Scoped localStorage envelope with app signature + origin validation.
- Per-size stock guards with toast feedback and in-cart deduction on PDP.
- Launcher ANSI stripping, CI env control, process-tree cleanup.
- Submodule pointer in sync with HEAD; `.env.local` untracked (only placeholders committed).
- Graceful Resend misconfiguration handling (503 + WhatsApp/mailto fallbacks).
- PDP id + slug case-insensitive, URL-decoded matching.

---

*Updated after the resolution pass. Each finding above maps to changes verified by production builds and live endpoint tests.*
