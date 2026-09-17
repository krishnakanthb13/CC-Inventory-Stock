# Crown & Cross — Admin & Inventory System

> **Private administration portal and inventory engine for Crown & Cross football jerseys.**  
> *"Some wear fashion. We wear football."*

---

## ⚡ Quick Start (< 5 Minutes)

### Prerequisites
- **Node.js**: v18.0+ (Tested on v24)
- **npm**: v9.0+

### 1. Install All Dependencies
Dependencies are co-located in their respective project directories (`admin/node_modules/` and `CC-Hosting-Public/node_modules/`):

```bash
npm run install:all
```

### 2. Launch Local Environment
Run the unified cross-platform launcher:

```bash
npm run launch
```
*(Or on Windows, double click `scripts/start.bat`; on macOS/Linux run `bash scripts/start.sh`)*

The launcher executes health-polling readiness checks, strips ANSI artifacts for crystal-clear terminal output in UTF-8, and **automatically opens your default browser** to both applications once ports are ready:
- **Admin Portal:** [http://localhost:3000](http://localhost:3000) *(auto-opened)*
- **Public Storefront:** [http://localhost:3001](http://localhost:3001) *(auto-opened)*

---

## 🏗️ Architecture & JSON Pipeline

Crown & Cross uses a lean, serverless, no-backend-database architecture:

```
CC-Inventory-Stock/                 (Repo 1 — Private Admin)
├── admin/                          Next.js Admin Dashboard (Port 3000)
│   ├── app/                        App router, Lucide UI tabs & styles
│   ├── app/api/products/route.js   CRUD & JSON sync API
│   ├── components/                 BrandSettings, ShippingExchange, Taxonomy, RawJson
│   └── lib/generateJson.js         Dynamic root traversal & atomic JSON I/O
├── CC-Hosting-Public/               (Repo 2 — Public Git Submodule, Port 3001)
│   ├── ...                          (Vercel Next.js storefront)
│   └── public/data/products.json    <-- Admin directly writes here
├── scripts/
│   ├── start.js                    Cross-platform Node launcher (ANSI-stripped, HTTP polled)
│   ├── start.bat                   Windows UTF-8 clean launcher wrapper
│   └── start.sh                    Mac/Linux launcher
└── package.json
```

### How the Data Hand-Off Works:
1. **Admin CRUD**: When you add, edit, or toggle stock in the Admin UI, the API directly updates `CC-Hosting-Public/public/data/products.json`.
2. **Instant Preview ("View Store")**: An integrated header button in the Admin portal provides 1-click navigation to the live storefront on port 3001.
3. **Submodule Git Commit**: Commit the updated `products.json` inside `CC-Hosting-Public` and push to its GitHub repository.
4. **Vercel Auto-Deploy**: Vercel is connected solely to `CC-Hosting-Public` — every push automatically triggers a fresh deployment of the public store within 60 seconds.
5. **Persistent Storefront Shopping**: Customers on the storefront experience zero-loss shopping sessions via client-side scoped local storage (`cc_cart_v1`, `cc_customer_v1`) without database latency or login barriers.

---

## ✨ Comprehensive Admin Modules

The Crown & Cross Admin Portal (`http://localhost:3000`) provides comprehensive control over all data stored in `products.json`, enhanced with a modern Lucide icon design system:

1. **👕 Jerseys & Inventory Catalog**:
   - Add, edit, and delete football jerseys with multi-image previews and size tags (`S`, `M`, `L`, `XL`, `XXL`).
   - Inline stock status toggle (`In Stock`, `Low Stock`, `Out of Stock`) and quantity tracking.
   - Dynamic KPI counters: Total jerseys, active stock, sold-out alerts, and aggregate retail valuation (₹).
   - Real-time search and multi-facet filtering by category, quality grade, and stock level.
   - "View Store" header button with Lucide external link icon for instantaneous catalog validation.

2. **🏛️ Brand & Store Identity**:
   - Store Name, primary hero tagline, and secondary story value proposition.
   - WhatsApp direct ordering phone number (`+917695924602`), official support email, and store headquarters.
   - Merchant UPI ID (`jasonclement.jm-1@okhdfcbank`) and registered payee name that power client-side dynamic QR code payments.

3. **🚚 Shipping & Exchange Rules**:
   - Standard shipping fee (₹80) and free shipping threshold (₹1,499) that dynamically adjusts the Cart Drawer progress meter.
   - Metro city (`3-5 Business Days`) and Pan-India (`5-8 Business Days`) delivery timeframes.
   - Sizing exchange window (`5-7 Days`) and mandatory return conditions.

4. **🏷️ Categories & Quality Grades**:
   - Add, edit, and delete primary categories (`Club`, `Country`, `Retro`) with auto-slug generation.
   - Configure the 5 quality sub-categories (`Player Version`, `Master Copy`, `Fan Version Set`, `Embroidered`, `Sublimation`) and their customer-facing spec descriptions.
   - Dynamically populates jersey forms and filter buttons across the application.

5. **💻 Raw JSON Inspector & Backups**:
   - Live formatted JSON viewer and emergency syntax editor for `products.json`.
   - In-browser JSON formatter, syntax validator, and clipboard copy.
   - One-click `.json` snapshot download for manual backups.

6. **📲 Universal WhatsApp Engine**:
   - Integrated cross-platform deep-linking (`whatsapp://send` and modern `https://wa.me/` bridge).
   - Automatically pre-types order details, itemized quality tiers, and customer address for 1-click dispatch across Windows, macOS, Android, and iOS (iPhone/iPad).
   - Clean ASCII formatting prevents mobile browser character truncation.

7. **📱 Full Responsive Multi-Screen Compatibility**:
   - **Large Screens (Desktop & 4K):** Max-width constraints and clamp-based fluid typography.
   - **Medium Screens (Tablets & Laptops):** Multi-column auto-fit grids and responsive layout transitions.
   - **Small Screens (Mobile Phones):** Fluid single-column collapse (`minmax(min(100%, ...), 1fr)`), touch-swipe carousels, and viewport-safe modals with zero horizontal overflow.

8. **🎨 Storefront Visual & Trust Hierarchy**:
   - Distinct static **Vintage Amber** (`#f59e0b`) accent for **Retro Kits** navigation.
   - Action-oriented **"Contact Us"** and **"Email Us"** controls replacing cluttered raw phone and email strings.
   - High-trust footer architecture prioritizing merchant payee identity (**Jason Clement**) above support links.
   - Vertically centered brand emblem and manifesto headings on the `/about` story page.
   - **Horizontal Scrolling Banner**: Mobile-responsive dual-track infinite marquee ticker for top announcements with touch swipe support.
   - **Official Instagram Presence**: Clickable Instagram logo (`@_crown_and_cross_`) beside WhatsApp in navbar and throughout footer.
   - **Universal Product Search Modal**: Magnifying glass icon opening live search (`Ctrl+K`) displaying names of all available kits, quality tags, and 1-click drilldown navigation.

---

## 🛠️ Available Scripts

| Command | Description |
|---|---|
| `npm run launch` | Launches both Admin (`:3000`) and Storefront (`:3001`) simultaneously |
| `npm run install:all` | Installs dependencies in both `admin/` and `CC-Hosting-Public/` |
| `npm run dev --prefix admin` | Runs only the Admin dashboard on `:3000` |
| `npm run build --prefix admin` | Creates an optimized production build for the Admin portal |

---

## 📜 Changelog

### [Unreleased]
#### Added
- **Global Interactive Product Search**: Header magnifying glass button and `Ctrl+K`/`Cmd+K` shortcut opening a live modal with real-time product search, available kit names, thumbnails, pricing, and 1-click drilldown.
- **Instagram Channel Integration**: Clickable Instagram button (`nav-insta-btn`) beside WhatsApp on desktop and mobile, mobile drawer entry, and prominent footer follow card for official handle `@_crown_and_cross_`.
- **Responsive Announcement Bar Marquee**: Seamless dual-track infinite horizontal scrolling ticker on narrow screens ($\le 860\text{px}$) with touch-drag support and hover pause.

#### Fixed
- **Product Drill-down Crash**: Resolved `ReferenceError: relatedKits is not defined` on `/product/[id]` pages by aligning the related items query variable name.

#### Changed
- **Storefront Navigation**: Streamlined header actions with semantic **Contact Us** button linking directly to WhatsApp.
- **Storefront Header**: Implemented permanent static **Vintage Amber** (`#f59e0b`) accent on **Retro Kits** link.
- **Storefront Footer**: Reordered **Support & Orders** column to prioritize **UPI Payee: Jason Clement** at position #1, followed by clean **Contact Us** and **Email Us** links.
- **Storefront About Page**: Centered the brand logo emblem and manifesto headings using flexbox column alignment and fluid clamp typography.

---

## 📚 Documentation
- [Code Documentation (Architecture & APIs)](CODE_DOCUMENTATION.md)
- [Design Philosophy (Architecture & Ideology)](DESIGN_PHILOSOPHY.md)
- [Full Execution Plan](Crown-and-Cross-Execution-Plan.md)

---

## 👤 Owner & Team
- **Owner:** Jason Clement (`crownandcross29@gmail.com`)
- **Instagram:** [@_crown_and_cross_](https://www.instagram.com/_crown_and_cross_)
- **WhatsApp:** [+91 76959 24602](https://wa.me/917695924602)
- **Location:** Chennai, Tamil Nadu, India