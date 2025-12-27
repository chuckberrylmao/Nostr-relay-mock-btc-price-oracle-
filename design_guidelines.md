# BTC Price Nostr Relay - Design Guidelines

## Design Approach

**Selected System**: Material Design 3 with developer-focused customization

**Rationale**: This is a utility-focused research demo for technical users requiring:
- Clear data hierarchy for prices, events, and console logs
- Functional efficiency over visual storytelling
- Information-dense displays (real-time streams, keypair management)
- Developer-friendly aesthetics that inspire confidence

**Key Principles**:
- Data clarity: Information should be scannable and unambiguous
- Technical credibility: Design reflects the serious nature of financial data
- Efficiency: Minimize cognitive load for technical workflows
- Real-time feedback: Clear visual states for WebSocket connections and data updates

---

## Typography

**Font Stack**:
- Primary: 'Inter' (Google Fonts) - body text, forms, data
- Monospace: 'JetBrains Mono' (Google Fonts) - keypairs, event IDs, console output, prices

**Hierarchy**:
- H1 (Logo/Title): Inter Bold, 28px
- H2 (Section Headers): Inter Semibold, 20px
- H3 (Subsections): Inter Medium, 16px
- Body: Inter Regular, 14px
- Data/Console: JetBrains Mono Regular, 13px
- Small Labels: Inter Medium, 12px

---

## Layout System

**Spacing Units**: Tailwind units of 2, 4, 6, 8, 12, 16
- Tight spacing (p-2, gap-2): Within cards, between related elements
- Standard spacing (p-4, gap-4): Between components, card padding
- Section spacing (p-8, gap-8): Major layout sections

**Grid Structure**:
- Single-column dashboard layout (max-w-6xl centered)
- Two-column splits for authentication flows (form + info)
- Card-based organization for discrete functions

---

## Component Library

### Navigation
- **Top Bar**: Fixed header with app title, connection status indicator (dot: green/connected, red/disconnected), and account menu
- Height: h-16, border-b with shadow

### Cards & Containers
- **Primary Cards**: Rounded corners (rounded-lg), border, shadow-sm
- **Console/Output**: Monospace background panel, border, max-height with scroll

### Data Display
- **Price Display**: Large monospace numbers (text-4xl) in prominent card
- **Event Stream**: Scrollable console with timestamp + event content rows
- **Stats Row**: Grid of metric cards (3-column on desktop, 1-column mobile)

### Forms
- **Account Creation**: Two-step card flow
  - Step 1: Passphrase input (password field with strength indicator)
  - Step 2: Display pubkey (copyable, monospace), encrypted privkey stored indicator
- **Price Request**: Simple form with aggregation method dropdown + submit button

### Buttons
- **Primary CTA**: Filled button for main actions (Create Account, Request Price)
- **Secondary**: Outlined button for cancel/alternative actions
- **Icon Buttons**: Copy-to-clipboard, refresh icons using Heroicons

### Status Indicators
- **Connection Badge**: Pill shape with dot + text ("Connected" / "Disconnected")
- **Loading States**: Spinner with status text for API fetches
- **Toast Notifications**: Bottom-right toasts for events (success, error)

---

## Key Screens & Sections

### 1. Welcome/Authentication Screen
**Layout**: Centered card (max-w-md) on viewport
- App title and brief description
- Two CTAs: "Create New Account" / "Import Existing"
- Info callout: "Your keys never leave this browser"

### 2. Main Dashboard (Authenticated)
**Layout**: Full viewport with fixed header, scrollable main

**Header Section**:
- Left: App title + Nostr icon
- Right: Connection status, account pubkey (truncated, click to copy), logout

**Main Content** (vertical stack, gap-6):

**Price Display Card** (prominent, top):
- Large BTC price in monospace
- Timestamp of last update
- Source count badge ("Aggregated from 4 sources")
- Request Price button

**Request Form Card**:
- Aggregation method selector (dropdown: Median, Trimmed Mean, Mean)
- Max age input (seconds)
- Submit button

**Real-time Event Console**:
- Header: "Event Stream" with clear/pause controls
- Scrollable monospace log area (h-96)
- Each event: timestamp, kind badge, content preview
- Auto-scroll to latest

**Sources Status Grid** (3-column):
- Card per source (Coinbase, Kraken, CoinGecko, Bitstamp)
- Status indicator (success/failed)
- Last fetched price + timestamp

### 3. Account Management Modal
- Display full pubkey (copyable)
- Encrypted privkey backup download
- Delete account (clear local storage) warning

---

## Images

**No hero images required**. This is a functional dashboard - focus on data clarity over visual storytelling.

**Icons Only**:
- Heroicons for UI actions (copy, refresh, logout, info)
- Connection status dots
- Source logos optional but not required

---

## Animations

**Minimal, functional only**:
- Fade-in for toast notifications (200ms)
- Pulse on connection status change
- Smooth scroll for console auto-scroll
- Button hover states (inherent)

**No decorative animations** - maintains focus on data and functionality.