# UI Guidelines & Design System

This document outlines the UI standards, design patterns, and reusable components used throughout the Beverage POS System. The application is built using React and styled exclusively with Tailwind CSS to ensure a consistent, modern, and highly responsive user experience.

---

## Design Principles

1. **Brand-Centric Interface:** Core workflows, such as product selection, are heavily visual, utilizing brand logos (`public/images/`) for rapid recognition by workers.
2. **High-Contrast Indicators:** Critical business metrics (e.g., credit limits, stock expiry) rely on immediate visual cues (Green, Yellow, Red).
3. **Mobile-Ready Administration:** Admin views are structurally responsive to allow monitoring via tablets or mobile devices, whereas Worker billing focuses on dense desktop grids.
4. **Non-Destructive Actions:** Buttons carrying destructive implications (e.g., Cancel Bill) are styled strictly with danger variants to prevent accidental clicks.

---

## Typography & Colors

### Typography
The application relies on Tailwind's default sans-serif font stack (Inter/System Fonts).
- **Page Titles:** `text-2xl font-bold text-gray-900`
- **Card Titles:** `font-semibold text-gray-800`
- **Data Labels:** `text-sm text-gray-500`
- **Numeric Values (Prices/Metrics):** Bolded, often paired with brand colors (e.g., `text-blue-600` for revenue).

### Colors
Tailwind CSS utility colors are used to enforce semantic meaning:
- **Primary Actions:** `blue-600` (Hover: `blue-700`)
- **Success / Additions:** `green-600` (Hover: `green-700`)
- **Warnings / Alerts:** `yellow-500` or `orange-500`
- **Destructive / Errors:** `red-600`
- **Backgrounds:** Off-white `bg-gray-50` for application background; pure white `bg-white` for elevated cards.

---

## Reusable Components

All reusable UI components are housed in `src/components/common/index.tsx`.

### Buttons
The `Button` component accepts a `variant` and `size` prop.

| Variant | Styling | Usage |
|---|---|---|
| **Primary** (Default) | Blue background, white text | Standard actions (Save, Submit, Next) |
| **Secondary** | Gray border, transparent background | Cancel, Back, or low-priority actions |
| **Danger** | Red background, white text | Deletions, Voiding bills, Logout |

*Sizes:* `sm`, `md` (default), `lg`.
*Accessibility:* Disabled states apply `opacity-50 cursor-not-allowed`.

### Form Inputs
The `Input` and `Select` components are controlled React components wrapped with standard labeling and error handling.
- **Styling:** `border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500`.
- **Validation State:** If an error prop is passed, the border turns red (`border-red-500`) and a small red helper text appears below the input.

### Cards
The `Card` component is the primary container for grouping related content (e.g., Dashboard metrics, Product grids).
- **Styling:** `bg-white rounded-xl shadow-sm border border-gray-200`.
- **Props:** Accepts an optional `title` which renders a standardized header inside the card.

### Badges
The `Badge` component is a small, pill-shaped indicator used primarily in tables to denote status.

| Status | Color | Example Usage |
|---|---|---|
| **Success** | Green | `Paid` bills, `Active` users |
| **Warning** | Yellow | `Partial` payments, `Low Stock` |
| **Danger** | Red | `Voided` bills, `Expired` stock |
| **Info** | Blue | Standard tags |

### Modals & Dialogs
The common `Modal` component (in `src/components/common/index.tsx`) renders a centered overlay dialog.
- **Portalled Rendering:** Implemented via React Portals (`createPortal`) rendering directly into `document.body` to avoid overflow/stacking issues.
- **Structure:** Features a fixed header (Title + Close X), scrollable body content (`overflow-y-auto`), and a footer for action buttons.
- **Advanced UX Behavior:**
  - **Body Scroll Lock:** Disables body scroll and offsets layout shift when active.
  - **Escape Close:** Closes automatically on Escape key press.
  - **Click Outside:** Closes automatically when clicking the backdrop overlay.
  - **Focus Restoration:** Automatically returns focus to the button that triggered the modal once closed.
  - **Aria Roles:** Native role attributes (`role="dialog"`, `aria-modal="true"`) for full accessibility compliance.
- **Size Options:** Accepts a `size` prop (`sm` / `md` / `lg`) to control dialog max width.

---

## Layout & Navigation

### Application Shell (`Layout` component)
- **Sidebar:** Fixed on the left side (collapses on smaller screens). Contains `Lucide React` icons paired with route names. Active routes are highlighted with a `bg-blue-50 text-blue-700` styling.
- **Top Header:** Displays the application title and current user context with a prominent Logout button.
- **Page Container:** Provides standard padding (`p-6`) for all routed page content.

### Dynamic Drill-Down UI
Implemented specifically in the Sales and Inventory product views:
1. **Tier 1 (Brands):** Displays large square cards with centered product images (from `public/images/`) and a hover scale effect (`hover:scale-105`).
2. **Tier 2 (Variants):** Upon clicking a brand, the grid switches to display specific variants with a "← Back to brands" navigation link at the top.

---

## Application States

### Loading States
As the frontend transitions to integrate with backend APIs, the UI uses standard loading patterns:
- **Skeleton Loaders:** Renders gray placeholders with pulse animation (`animate-pulse`) while tables fetch data.
- **Form Disabling:** Buttons display spinner icons and turn `disabled` when saving form contents to prevent double requests.

### Empty States
When tables or grids have no data (e.g., empty cart, no search results):
- Rendered as a centered column.
- Contains a muted gray icon (`text-gray-400`).
- Includes a short descriptive text: `"No products found matching your filters."`

### Error States & Notifications
The global `Notifications` component (rendered in `App.tsx`) handles transient feedback.
- **Behavior:** Toast notifications slide in at the top-right corner.
- **Auto-dismiss:** Toasts automatically disappear after 5 seconds.
- **Styling:** Colors map strictly to the notification type (Green = Success, Red = Error, Yellow = Warning).

---

**Last Updated**: June 26, 2026  
**Version**: 2.0.0  
