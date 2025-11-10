# MSF Field Sales Application - Design Guidelines

## Design Approach
**Selected System**: Material Design with Carbon Design influences for data-heavy components
**Rationale**: Enterprise productivity tool requiring clear information hierarchy, efficient data input, and mobile-responsive design for field teams

## Core Design Principles
1. **Efficiency First**: Minimize clicks to complete tasks, prioritize speed of data entry
2. **Mobile-Optimized**: Field sales teams work on-the-go - touch-friendly, thumb-reachable navigation
3. **Data Clarity**: Clear visual hierarchy for scanning large datasets quickly
4. **Progressive Disclosure**: Show critical info first, details on demand

## Typography System
- **Primary Font**: Inter (via Google Fonts CDN)
- **Headings**: 
  - H1: text-3xl font-bold (Dashboard titles)
  - H2: text-2xl font-semibold (Section headers)
  - H3: text-xl font-medium (Card titles, Form sections)
- **Body**: text-base font-normal (Default content)
- **Labels**: text-sm font-medium uppercase tracking-wide (Form labels, table headers)
- **Data/Numbers**: text-lg font-semibold tabular-nums (Metrics, statistics)

## Layout System
**Spacing Units**: Use Tailwind units of 4, 6, 8, 12, 16 for consistency
- Component padding: p-4 to p-6
- Section spacing: space-y-8
- Card gaps: gap-6
- Form field spacing: space-y-4

**Grid Structure**:
- Desktop: Two-column split (sidebar + main content)
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Data tables: Full-width with horizontal scroll
- Mobile: Single column stack, bottom navigation

## Component Library

### Navigation
- **Desktop**: Fixed left sidebar (w-64) with collapsible option
- **Mobile**: Bottom tab bar (fixed bottom) with 4-5 primary actions
- **Structure**: Logo top, main nav items, user profile bottom
- Use Heroicons for all navigation icons

### Dashboard Cards
- Elevated cards with subtle shadow
- Header: Icon + Title + Action button
- Body: Key metric (large, bold) + trend indicator + sparkline chart placeholder
- Grid layout: 3 columns on desktop, 2 on tablet, 1 on mobile

### Data Tables
- Sticky header row
- Alternating row background for readability
- Row actions: Icon buttons (right-aligned)
- Sortable columns with arrow indicators
- Pagination at bottom
- Mobile: Convert to card-based list view

### Forms
- Single-column layout (max-w-2xl)
- Grouped related fields with dividers
- Floating labels or top-aligned labels
- Required field indicators (*)
- Inline validation messages
- Primary action button: Full-width on mobile, auto on desktop
- Secondary actions: Text links below primary button

### Customer/Lead Cards
- Compact card design with avatar/initial circle
- Name, company, last contact date
- Status badge (top-right corner)
- Quick actions: Call, Email, Notes icons
- Swipeable on mobile for quick actions

### Route Planning View
- Map integration placeholder (full-height container)
- Floating action button for "Start Route"
- Bottom sheet with customer list
- Timeline view showing visit schedule

### Reporting Dashboard
- Date range selector (top-right)
- KPI cards row (4 metrics across)
- Charts section: Bar/line chart placeholders
- Filterable data table below

## Mobile-Specific Patterns
- Bottom sheet modals for forms/details
- Sticky action buttons (floating or bottom bar)
- Swipe gestures for card actions
- Pull-to-refresh on lists
- Thumb-zone consideration: Primary actions in bottom 1/3 of screen

## Animations
**Minimal and Purposeful**:
- Page transitions: Simple fade (150ms)
- Card hover: Subtle lift shadow
- Button press: Scale down slightly
- NO scroll animations or parallax

## Images
This is a data-focused enterprise application - images are minimal:
- **User Avatars**: Circular, 40px default size, fallback to initials
- **Company Logos**: Small, contained in cards where relevant
- **Empty States**: Simple illustrations for "No data" states
- NO hero images or decorative photography

## Status Indicators
- Use color-coded badges: Success (green), Warning (yellow), Error (red), Info (blue)
- Pill-shaped with subtle background
- Icon + text for clarity

## Accessibility
- Minimum touch target: 44px × 44px
- High contrast text (WCAG AA minimum)
- Focus indicators on all interactive elements
- Aria labels for icon-only buttons
- Form error announcements

This design creates a professional, efficient tool that prioritizes the field sales team's productivity while maintaining clarity across devices.