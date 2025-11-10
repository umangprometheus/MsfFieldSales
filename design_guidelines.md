# MSP Diesel Field Sales Route App - Design Guidelines

## Design Approach

**System-Based Approach**: Drawing from Linear's clean functionality, Google Maps' mobile map patterns, and modern mobile-first productivity tools. This is a utility-focused field application requiring clarity, efficiency, and mobile optimization for outdoor use.

**Core Principles**:
- Mobile-first, one-handed operation priority
- Map-centric interface with contextual overlays
- High contrast for outdoor visibility
- Instant visual feedback for proximity events
- Minimal cognitive load during driving

---

## Color Palette

### Light Mode (Primary for Outdoor Use)
- **Primary**: 220 90% 45% (Deep blue for trust/reliability)
- **Primary Hover**: 220 90% 38%
- **Surface**: 0 0% 100% (Pure white for maximum outdoor readability)
- **Surface Secondary**: 220 15% 97%
- **Border**: 220 20% 88%
- **Text Primary**: 220 25% 15%
- **Text Secondary**: 220 15% 45%
- **Success**: 142 75% 42% (Check-in confirmation)
- **Warning**: 38 92% 50% (Proximity alerts)
- **Danger**: 0 85% 55%

### Dark Mode (Driving/Low Light)
- **Primary**: 220 85% 60%
- **Surface**: 220 20% 12%
- **Surface Secondary**: 220 18% 16%
- **Border**: 220 15% 25%
- **Text Primary**: 220 10% 95%
- **Text Secondary**: 220 10% 65%

---

## Typography

**Font Stack**: 
- Primary: 'Inter' (Google Fonts) - exceptional readability at small sizes
- Monospace: 'JetBrains Mono' (for coordinates/technical data)

**Scale**:
- Hero/Page Titles: text-2xl font-bold (24px)
- Section Headers: text-lg font-semibold (18px)
- Body: text-base font-normal (16px)
- Secondary: text-sm font-normal (14px)
- Captions: text-xs font-medium (12px)

**Usage**:
- Map overlays: font-semibold for visibility
- Lists: font-medium for company names
- Metadata: text-sm text-secondary

---

## Layout System

**Spacing Primitives**: Use Tailwind units of 3, 4, 6, 8, 12 for consistent rhythm
- Compact spacing: p-3, gap-3
- Standard spacing: p-4, gap-4, m-6
- Section spacing: p-6, py-8
- Large spacing: p-12 (desktop only)

**Container Strategy**:
- Full-bleed map views
- Content overlays: max-w-md mx-auto p-4
- Lists: max-w-2xl with p-4
- Bottom sheets: rounded-t-2xl with safe-area-inset

---

## Component Library

### Map Interface
- Full-viewport map (Mapbox GL)
- Floating UI overlays with backdrop-blur-md
- Custom markers: company pins (blue), current location (pulsing blue ring), route waypoints (numbered)
- Route polyline: 4px width, primary color with 80% opacity

### Navigation/Header
- Fixed top bar: h-14 with backdrop-blur-lg bg-white/90
- Logo/app name left, profile/settings right
- Search bar integration on planning view
- Safe area padding for mobile notch

### Company List Cards
- White cards with shadow-sm hover:shadow-md transition
- Company name: text-base font-semibold
- Distance badge: absolute top-3 right-3, pill-shaped with success color
- Address: text-sm text-secondary
- Touch target: min-h-[72px] with active:bg-gray-50

### Route Panel
- Step-by-step list with connecting lines
- Current stop: highlighted with primary background
- Completed: opacity-60 with checkmark
- ETA badges: text-xs bg-gray-100 rounded-full px-2

### Proximity Alert (Check-In Prompt)
- Bottom sheet: slides up from bottom with spring animation
- Bold company name with location icon
- Large primary CTA: "Check In" (h-12 w-full)
- Secondary actions: "Skip" text button
- Backdrop: bg-black/40

### Check-In Form
- Full-screen modal with close button
- Company header with map thumbnail
- Textarea: min-h-[120px] for notes
- Timestamp display: text-sm font-mono
- GPS coordinates: text-xs font-mono text-secondary

### Summary Dashboard
- Card-based metrics: 3 columns on desktop, stack on mobile
- Visit count, total miles, time stats
- Timeline list: chronological check-ins with mini-map pins
- Export button: outline variant top-right

### Bottom Navigation (Mobile)
- Fixed bottom: h-16 with 4 items
- Icons: 24px size, active state with primary color + label
- Safe area bottom padding
- Items: Plan, Route, History, Profile

---

## Interaction Patterns

### Proximity Detection
- Visual pulse animation on map marker when within 250m
- Bottom sheet auto-slides up with haptic feedback (if supported)
- Audio chime option for drivers

### Route Building
- Drag-to-reorder stops (desktop)
- Swipe actions on mobile: swipe left to remove stop
- Optimize toggle: switch component with loading state

### Map Controls
- Floating action buttons: bottom-right cluster
- Recenter GPS: circular button with location icon
- Zoom controls: +/- stacked buttons
- Layer toggle: satellite/streets

### Loading States
- Skeleton screens for company lists
- Inline spinners for route optimization
- Progress bar for HubSpot sync

---

## Mobile-Specific Guidelines

**Touch Targets**: Minimum 44px height for all interactive elements

**One-Handed Reach**: 
- Primary actions in bottom 40% of screen
- Critical buttons within thumb zone
- Top nav minimal (status only)

**Orientation**: 
- Portrait primary
- Landscape: split view (map left, list right) on tablets

**Performance**:
- Lazy load company cards (virtualized lists)
- Map marker clustering above 50 items
- Debounced GPS updates (2-3 second intervals)

---

## Accessibility

- High contrast mode toggle
- Large text support (up to 200% zoom)
- ARIA labels on all map markers
- Keyboard navigation for route planning (desktop)
- VoiceOver announcements for proximity events
- Color-blind safe palette (avoid red/green only indicators)

---

## Images

**No hero images required** - this is a utility app, not marketing

**Functional Images**:
- Map tiles: Mapbox Streets style (light mode), Navigation Night (dark mode)
- Company logos: 32px circular avatars in list view (optional, fallback to initials)
- Empty states: Simple line illustrations for "no routes" or "no companies nearby"
- Profile photos: 40px circular for user avatar

---

## Animation Budget

**Essential Only**:
- Proximity alert slide-up: 300ms ease-out
- Route step transitions: 200ms fade
- Button press: 100ms scale(0.97)
- Map marker pulse: infinite 2s for current location

**Avoided**:
- Page transitions (instant for speed)
- Decorative effects
- Scroll-triggered animations