# Crown & Cross — Code Documentation (CC-Inventory-Stock)

This document details the code architecture, API contracts, data layers, and process workflows for the private administration repository `CC-Inventory-Stock`.

---

## 1. Directory Structure

```
CC-Inventory-Stock/
├── admin/
│   ├── app/
│   │   ├── api/products/route.js    # Next.js App Router API endpoint
│   │   ├── globals.css              # Olive Green & Gold design tokens & Lucide styles
│   │   ├── layout.jsx               # Root HTML & metadata wrapper
│   │   └── page.jsx                 # Client-side Admin Dashboard, CRUD UI & Storefront link
│   ├── components/
│   │   ├── BrandSettingsTab.jsx     # Store name, WhatsApp, UPI & brand identity
│   │   ├── ShippingExchangeTab.jsx  # Delivery rules, thresholds & return policies
│   │   ├── TaxonomyTab.jsx          # Categories & quality tiers management
│   │   └── RawJsonTab.jsx           # Live JSON syntax editor, validator & backup exporter
│   ├── lib/
│   │   └── generateJson.js          # Dynamic root traversal, file I/O & data formatting
│   ├── public/
│   │   └── images/logo.jpeg         # Crown & Cross brand emblem
│   └── package.json                 # Admin project manifest
├── CC-Hosting-Public/               # Git submodule (Public Storefront repo)
│   └── public/data/products.json    # Target data contract
├── scripts/
│   ├── start.js                     # Unified Node.js launcher with ANSI filtering & HTTP health checks
│   ├── start.bat                    # Windows shell launcher wrapper with UTF-8 code page
│   └── start.sh                     # Unix/macOS shell launcher wrapper
├── .gitignore                       # Multi-tier ignore rules
├── package.json                     # Root orchestrator manifest
└── Crown-and-Cross-Execution-Plan.md
```

---

## 2. Data Layer: `admin/lib/generateJson.js`

Provides atomic file read/write operations targeting `CC-Hosting-Public/public/data/products.json`.

```javascript
// Resolves the repository root by upward directory traversal
const jsonFilePath = getJsonFilePath();
```

### Exported Functions:
- **`findRepoRoot()`**: Recursively ascends directory tree from `process.cwd()` and `__dirname` to locate the repository root containing `CC-Hosting-Public`.
- **`getJsonFilePath()`**: Dynamically returns absolute path to `CC-Hosting-Public/public/data/products.json`.
- **`getProductsData()`**: Reads and parses `products.json`. Throws informative error if file is missing or contains invalid JSON.
- **`saveProductsData(fullData)`**: Safely formats with 2-space indentation and writes `fullData` synchronously to `jsonFilePath`. Returns `{ success: true, timestamp }`.
- **`createSlug(name)`**: Converts jersey names to clean SEO URL slugs (e.g. `"Real Madrid 23/24 Home"` → `"real-madrid-23-24-home"`).

---

## 3. API Contract: `admin/app/api/products/route.js`

| Method | Purpose | Request Body / Params | Response |
|---|---|---|---|
| **`GET`** | Load complete catalog & settings | None | Complete JSON object containing `brand`, `categories`, `subCategories`, and `products` |
| **`POST`** | Add product | `{ product: { name, price, ... } }` | `{ success: true, product, total }` |
| **`POST`** | Update brand settings | `{ action: "updateBrand", brand: { ... } }` | `{ success: true, message, data }` |
| **`POST`** | Update shipping & exchanges | `{ action: "updateShippingExchange", shipping: { ... }, exchange: { ... } }` | `{ success: true, message, data }` |
| **`POST`** | Update taxonomy | `{ action: "updateTaxonomy", categories: [ ... ], subCategories: [ ... ] }` | `{ success: true, message, data }` |
| **`POST`** | Direct raw JSON edit | `{ action: "updateRawJson", rawJson: "{ ... }" }` | `{ success: true, message, data }` |
| **`POST`** | Full catalog sync | `{ fullSync: true, data: { ... } }` | `{ success: true, message, data }` |
| **`PUT`** | Update existing product | `{ id: "cc-001", updates: { price: 1499, ... } }` | `{ success: true, product }` |
| **`PATCH`** | Quick stock status toggle | `{ id: "cc-001", stockStatus: "Low Stock", inStock: true }` | `{ success: true, product }` |
| **`DELETE`** | Remove product | Query Param: `?id=cc-001` | `{ success: true, remaining }` |

---

## 4. `products.json` Schema Contract

```json
{
  "brand": {
    "name": "Crown & Cross",
    "tagline": "Some wear fashion. We wear football.",
    "phone": "+917695924602",
    "email": "crownandcross29@gmail.com",
    "location": "Chennai, Tamil Nadu",
    "upiId": "jasonclement.jm-1@okhdfcbank",
    "payeeName": "Jason Clement",
    "shipping": {
      "standardFee": 80,
      "freeShippingThreshold": 1499
    }
  },
  "products": [
    {
      "id": "cc-001",
      "slug": "real-madrid-23-24-home-bellingham",
      "name": "Real Madrid 23/24 Home Kit — Bellingham #5",
      "category": "Club",
      "subCategory": "Player Version",
      "team": "Real Madrid",
      "season": "2023/24",
      "price": 1499,
      "mrp": 2499,
      "inStock": true,
      "stockStatus": "In Stock",
      "stockQuantity": 24,
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "images": ["https://..."],
      "featured": true,
      "description": "..."
    }
  ]
}
```

---

## 5. Launcher Architecture: `scripts/start.js` & `scripts/start.bat`

Coordinates both Next.js applications in a non-blocking cross-platform manner:
- **Clean Windows Console Output:** `scripts/start.bat` initializes UTF-8 mode (`chcp 65001 >nul`) and clears the screen.
- **ANSI Code Sanitization:** `scripts/start.js` intercepts `child.stdout` and `child.stderr` through custom stream parsers that strip ANSI escapes (`\u001b\[...`), cursor positioning controls, and unprintable byte noise.
- **Color & Spinner Control:** Injects `FORCE_COLOR: "0"` and `CI: "1"` into child environments to prevent Next.js interactive spinners from scrambling terminal rows.
- **Node v24 Windows Compatibility:** Spawns commands with `{ shell: true }` on `win32` to eliminate Node v24 `EINVAL` spawn errors.
- **Port Allocation:** Spawns `Admin` on `http://localhost:3000` and `Storefront` on `http://localhost:3001`.
- **HTTP Health Polling (`waitForUrlAndOpen`):** Periodically tests endpoints via lightweight Node `http.get` requests.
- **Automated Staggered Browser Opener (`openBrowser`):** Automatically opens default browser tabs (immediate for Admin, 800ms offset for Storefront) once each respective server returns an active HTTP status.
- **Process Cleanup:** Handles `SIGINT` and `SIGTERM` signals with aggressive process tree destruction (`taskkill /pid <PID> /T /F` on Windows) to prevent orphaned Node/port instances.

---

## 6. Vercel Deployment & Secret Configuration

The public storefront (`CC-Hosting-Public`) is designed for automatic continuous deployment on Vercel:

### Environment Variables on Vercel:
Add these in **Vercel Dashboard** → `CC-Hosting-Public` → **Settings** → **Environment Variables**:

| Variable Name | Required | Description | Example |
|---|---|---|---|
| `RESEND_API_KEY` | **Yes** (for estimates) | Secret API key from [Resend](https://resend.com/api-keys) | `re_123456789...` |
| `ESTIMATE_NOTIFICATION_EMAIL` | Optional | Inbox receiving team jersey quotation requests | `crownandcross29@gmail.com` |
| `RESEND_FROM_EMAIL` | Optional | Custom verified sender address once domain is verified | `Crown & Cross <orders@yourdomain.com>` |

> **Note on Security:** Secret keys should **never** be committed to Git. `.env.local` remains in `.gitignore`. Vercel securely injects these variables into the serverless environment at build/runtime. After setting or updating keys in Vercel, trigger a **Redeploy** on the latest deployment.

---

## 7. Universal WhatsApp Engine: `CC-Hosting-Public/lib/whatsapp.js`

Provides unified deep-linking that guarantees pre-filled recipient phone (`+91 76959 24602`) and pre-typed order messages across all client operating systems:

- **Protocol Scheme (`whatsapp://send`):**
  - Directly invokes native WhatsApp applications on Windows, macOS, Android, and iOS (iPhone/iPad).
  - Bypasses intermediate browser landing prompts.
- **Universal Click-to-Chat Fallback (`https://wa.me/`):**
  - Direct Meta click-to-chat bridge replacing legacy `api.whatsapp.com`.
  - Ensures clean desktop tab reuse and reliable mobile webview fallback without dropped parameters.
- **Text Sanitization (`sanitizeWhatsAppText`):**
  - Converts multi-byte Unicode box characters (`━`, `─`, `═`) into standard ASCII hyphens (`-`).
  - Prevents query parameter truncation and URL decoding failures across mobile browser intent handlers.

---

## 8. Multi-Screen Responsive Architecture

1. **Viewport Scaling:** Exported Next.js 14 `viewport` metadata in `app/layout.jsx` ensures strict `1:1` device-width scaling across mobile and tablets.
2. **Fluid Grids:** Replaced fixed minimums with fluid constraints: `repeat(auto-fit, minmax(min(100%, 280px), 1fr))` on catalog, PDP, and footer sections.
3. **Gesture Navigation:** `JerseyCarousel.jsx` features touch swipe listeners (`onTouchStart`, `onTouchMove`, `onTouchEnd`) with a 45px distance threshold.
4. **Adaptive Modals:** `UpiModal.jsx` incorporates `maxHeight: '90vh'` and `overflowY: 'auto'` to maintain usability on compact and landscape mobile screens.
5. **Scroll Management:** Route change scroll-to-top resets and sticky header anchor scroll margins prevent content occlusion.
6. **Action-Oriented Navigation Labels:** Replaced raw phone number and email text in `Navbar.jsx` and `Footer.jsx` with **"Contact Us"** and **"Email Us"** action hooks with descriptive tooltip metadata.
7. **Static Accent Styling:** Styled **Retro Kits** (`.retro-highlight`, `.retro-mobile-link`) with a permanent **Vintage Amber** (`#f59e0b`) accent with matching `:hover` rules for consistent visual anchoring.
8. **Centered Brand Storytelling Layout:** Wrapped the brand emblem and manifesto headings on `/about` in a centered flex column with `clamp(28px, 5vw, 42px)` fluid typography and `objectFit: 'cover'`.
9. **Trust-Ranked Support Order:** In `Footer.jsx`, hoisted `UPI Payee: Jason Clement` to the #1 position under "Support & Orders" for instantaneous merchant legitimacy.
10. **Dual-Track Infinite Announcement Marquee:** On narrow screens ($\le 860\text{px}$), `.navbar-announcement` activates a dual-track CSS keyframe loop (`bannerMarquee` over 26s). Track cloning ensures zero visual stutter or gap, while `-webkit-overflow-scrolling: touch` allows manual swipe inspection and auto-pauses on hover/focus.
11. **Global Search Modal Architecture (`components/SearchModal.jsx`):**
    - Triggered via top navbar magnifying glass icon, mobile drawer, or keyboard shortcut (`Ctrl+K` / `Cmd+K`).
    - Caches catalog from `/data/products.json` and performs multi-token matching over `name`, `team`, `season`, `category`, `subCategory`, and `description`.
    - Explicitly surfaces available product names, team badges, quality tier tags, stock status, and live pricing.
    - 1-click drilldown navigates to `/product/[id]` and cleans up modal state.
12. **Instagram Channel Routing (`@_crown_and_cross_`):**
    - Integrated clickable Instagram icon button (`nav-insta-btn`) beside WhatsApp on desktop and mobile viewports.
    - Mobile drawer features a direct follow button (`.mobile-dropdown-insta`).
    - Footer brand column includes a dedicated luxury follow card with gradient badge, inline support list entry, and bottom metadata link.
13. **Minimalist Icon-Only Header Actions & Footer Contact Standardization (`Navbar.jsx`, `Footer.jsx`):**
    - Removed text labels for Search and Instagram in `Navbar.jsx`, deploying sleek `38px x 38px` circular icon buttons with centered Lucide icons.
    - Standardized footer support links strictly as `Contact Us: Whatsapp` and `Contact Us: Instagram` with matching hover effects.
14. **Two Products Per Row Mobile Grid (`ProductCard.jsx`, `globals.css`):**
    - Configured `@media (max-width: 640px)` 2-column grid layout (`repeat(2, minmax(0, 1fr))`) across catalog, featured, and related product sections.
    - Proportional card typography, compact padding, and responsive badges tailored for mobile tap boundaries.
15. **Mobile-Only 1-Tap UPI App Launcher (`UpiModal.jsx`, `CartDrawer.jsx`, `app/product/[id]/page.jsx`):**
    - Universal `upi://pay` intent deep-linking triggering native app choosers across Android and iOS (Google Pay, PhonePe, Paytm, CRED, BHIM).
    - Isolated strictly to mobile viewports (`<= 768px`) with high-conversion active CTA styling.
16. **Mobile Section Spacing & Bottom Padding Optimization (`globals.css`, `app/page.jsx`, `app/product/[id]/page.jsx`):**
    - Tightened desktop-scale section margins (`margin: 90px auto 0` down to `24px`), container paddings, and footer gaps after product grids on mobile viewports.
17. **Size-Specific Stock Quantity System (`admin`, `CC-Hosting-Public`, `products.json`):**
    - **Data Schema (`stockBySize`)**: Stored per-product object mapping individual sizes (`S`, `M`, `L`, `XL`, `XXL`) to exact inventory counts, auto-synchronizing with total `stockQuantity` and `stockStatus`.
    - **Admin Matrix**: Integrated visual stock matrix inside product add/edit modals with real-time sum auto-calculation, size toggle controls, and quick-glance size badges in the inventory table.
    - **Storefront PDP UX**: Dynamically disables sold-out sizes with "Sold Out" strikethroughs, displays clean `● In Stock` without unit count leakage when stock is healthy ($> 2$), renders low-stock urgency alerts ("Only X left in Size L!") when $\le 2$, and caps maximum quantities.
18. **Limited Stock Notification & Cart Overflow Protection (`CartContext.jsx`, `LayoutClientWrapper.jsx`, `CartDrawer.jsx`):**
    - **Stock Toast System**: Dispatches auto-dismissing (3.8s) floating glassmorphism amber toasts with `AlertTriangle` icon on illegal increment attempts.
    - **In-Cart Stock Deduction**: PDP dynamically cross-checks cart quantities for the selected size (`remainingStock = availableStock - inCartQty`).
    - **Button Auto-Disable**: Automatically disables the Add to Cart button with text `All Stock in Cart (X/X)` and an inline alert banner when all available inventory for that size is already in the cart.
    - **Tactile Feedback**: Implemented `animate-shake` on the quantity stepper and disabled `+` buttons across both PDP and slide-out Cart Drawer when inventory ceiling is reached.
19. **Automated Pre-Flight Production Build Launcher (`scripts/start.js`, `start.bat`, `start.sh`):**
    - Integrated sequential compilation step (`npm run build`) in `admin/` and `CC-Hosting-Public/` prior to spawning local development servers.
    - Prevents runtime Next.js bundle corruption and guarantees zero deployment surprises across Windows, Mac, and Linux environments.



