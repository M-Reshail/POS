# AbdulHaq POS — Design Tokens

This is the single source of truth for color, type, radius, and card usage across the app.
Every page redesign (Dashboard, Retailers, Workers, Inventory, Bills, Reports) should pull from
this file instead of picking new colors ad hoc. This is what fixes the "rainbow of random
gradients" problem — one navy/gold brand system, used consistently, with real semantic colors
reserved only for real status meaning.

## Why this palette

The brand color is a vivid indigo-blue (`#5654E3`), paired with the warm gold accent for hero
CTAs. This gives the app a modern, energetic software feel rather than a purely corporate navy
look — while still keeping the gold accent as a distinct, attention-grabbing highlight for the
one primary action per page.

Note: the login page's background photo (warehouse/truck scene) was originally paired with a
deep navy glass card to match its lighting. If the login page hasn't been updated to the new
indigo brand yet, treat that as a known follow-up — decide whether the login card should also
shift to indigo, or intentionally stay navy as a one-off since it's tied to a photo, not the UI
chrome.

## Light-first principle — read this before using navy anywhere

The app is a **light-themed app with a navy/gold brand accent**, not a dark app. Default page
background is light (`surface: #F7F8FA`), and cards are white (`surface-card: #FFFFFF`). Navy
(`brand-900/800`) is a strong, saturated color — use it only in small, deliberate doses:
- The top hero/header banner on a page (one per page, not every card)
- Buttons, active nav items, icon badges
- The login screen (already dark by design, tied to the warehouse photo)

**Never** make a whole page, a whole sidebar, or every card dark navy. If you're styling a table,
a form, a settings page, a modal, or any content-heavy screen, it should be light (white cards on
the light `surface` background) with navy/gold showing up only in accents — buttons, headings,
small icon badges, focus rings. Treat navy the way a designer treats a bold accent color, not a
base color: a little goes a long way, especially on screens shop workers stare at all day.

## Color

| Token | Hex | Use for |
|---|---|---|
| `brand-900` | `#383794` | Deep indigo — sidebar, header bars, dark hero sections |
| `brand-800` | `#4342B1` | Indigo gradients, hover states on brand-900 |
| `brand-700` | `#4D4CCC` | Links, secondary brand accents |
| `brand-600` | `#5654E3` | Active/selected states, focus rings, primary buttons |
| `accent-600` | `#D69A1E` | Gold text on light backgrounds (meets contrast) |
| `accent-500` | `#F5B93C` | Bright gold — reserved for hero CTAs only (see rule below) |
| `accent-400` | `#FFD666` | Gold hover/lift state, subtle highlights |
| `surface` | `#F7F8FA` | App background (page canvas) |
| `surface-card` | `#FFFFFF` | Card background |
| `surface-muted` | `#EEF1F5` | Table stripe, disabled fields, subtle section backgrounds |
| `border-DEFAULT` | `#E2E6EC` | Default card/input borders |
| `border-strong` | `#CBD3DE` | Dividers, table borders that need more definition |
| `ink-DEFAULT` | `#101828` | Primary text, headings |
| `ink-muted` | `#5B6472` | Secondary text, labels |
| `ink-subtle` | `#8A93A3` | Placeholder text, timestamps, helper text |
| `success-500` | `#1F9D66` | Paid, in-stock, completed |
| `danger-500` | `#DC3545` | Overdue, out-of-stock, delete/destructive |
| `warning-500` | `#D9A63E` | Low stock, pending, due-soon (shares the accent gold — a low-stock warning already visually matches the brand, no new color needed) |
| `info-500` | `#2563A8` | Informational banners, neutral notices |

### Rule: gold is for ONE hero moment per page, not every "Add" button

Gold (`accent-500`) is a bold, attention-grabbing color — it should appear **once per page, at
most**, on the single most important action: the Login button, the Dashboard's "New Sale"
button. It is NOT the default color for every "Add Retailer" / "Add Worker" / "Add Expense"
button — those are routine, repeated actions, not a hero moment, and should stay
`brand-700`/`brand-600` (navy), matching how they looked before this system was introduced.
If gold shows up on more than one button on the same screen, that's a sign it's being used
decoratively rather than as a genuine highlight — undo it.

### Rule: no decorative rainbow

Indigo, purple, pink, cyan, teal, orange, rose — none of these appear in the token system, and
none should appear in component code. If a stat card or icon needs a color, it's either:
- **brand** (navy/gold) — for anything that's just "this app's default styling," or
- **a semantic color** (success/danger/warning/info) — only when it actually communicates status.

A stat card showing "Total Retailers" is not a status — it should be brand-colored, not a random
purple gradient. A stat card showing "Overdue Bills" is a status — that one earns `danger`.

## Typography

- **Display / headings** — `Sora` (600/700 weight). Used for page titles, card titles, modal
  headings. Distinct enough to give the app personality without being a generic system font.
- **Body / UI** — `Inter` (400/500/600). All body text, labels, buttons, form fields.
- **Numeric / money / quantities** — `IBM Plex Mono` with `font-variant-numeric: tabular-nums`.
  Every price, balance, RGB count, and quantity in the app should render in this face. It's the
  one deliberate signature choice: numbers look like they're printed on a ledger or a thermal
  receipt, which is literally what this business runs on (Udhaar ledgers, receipt printer is on
  the roadmap). This also makes columns of numbers actually align, which they don't today.

Add to `index.html` `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
```

## Radius scale

| Token | Value | Use for |
|---|---|---|
| `rounded-control` | `10px` | Inputs, buttons, small badges |
| `rounded-card` | `16px` | Standard cards |
| `rounded-hero` | `22px` | Hero banners, login card, modals |

Stop mixing `rounded-lg` / `rounded-xl` / `rounded-2xl` arbitrarily across pages — pick from these
three depending on the element type, everywhere.

## Spacing convention

Stick to Tailwind's default scale, but standardize which values mean what, so cards don't end up
oversized with dead space:
- Card padding: `p-5` (mobile) → `p-6` (desktop). Never `p-8`+ for a data card.
- Gap between cards in a grid: `gap-4` → `gap-5` (desktop).
- Section spacing (between major blocks on a page): `space-y-6` → `space-y-8`.

## Empty space / empty state rule

Never give a table or list container a fixed `min-h-[350px]`-style minimum height. If there's no
data (or only 2-3 rows), show an explicit empty state (icon + one line of text + primary action)
inside a normally-sized card, rather than a mostly-blank card padded out to a fixed height.

## Card usage

Use the shared `<Card>` component (`src/components/ui/Card.tsx`) instead of hand-writing
`bg-white rounded-2xl p-6 border ...` on every page. Variants:
- `variant="default"` — standard white card, `border-DEFAULT`, `rounded-card`
- `variant="stat"` — dashboard stat tile, brand-tinted icon badge, no random gradient background
- `variant="hero"` — dark navy hero banner (`rounded-hero`, `brand-900` → `brand-800` gradient).
  Use at most once per page, at the top, for the page title/quick actions — never for regular
  content cards below it.