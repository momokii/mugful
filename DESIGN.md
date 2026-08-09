# Mugful Design System

## 1. Atmosphere & Identity

The product feels like a private shared room: warm enough to invite affection, calm enough to feel safe, and playful without becoming childish. Its signature is **paired moments**—two clear states moving toward one shared reveal—expressed through restrained coral accents, quiet tonal surfaces, and purposeful motion.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--surface-primary` | `#F7F8F6` | `#101417` | Main application background |
| Surface/secondary | `--surface-secondary` | `#EEF1EF` | `#171D20` | Grouped sections and panels |
| Surface/elevated | `--surface-elevated` | `#FFFFFF` | `#20282C` | Dialogs and focused activity surfaces |
| Text/primary | `--text-primary` | `#192023` | `#F3F6F3` | Main text and headings |
| Text/secondary | `--text-secondary` | `#536064` | `#AAB6B5` | Supporting text |
| Text/tertiary | `--text-tertiary` | `#7C898B` | `#778486` | Muted metadata and disabled text |
| Border/default | `--border-default` | `#D6DEDD` | `#303B3F` | Form controls and functional boundaries |
| Border/subtle | `--border-subtle` | `#E6EBE9` | `#252E32` | Quiet separators |
| Accent/primary | `--accent-primary` | `#E85D4A` | `#FF806B` | Primary actions and focus |
| Accent/hover | `--accent-hover` | `#C94739` | `#FF9A8A` | Hover and pressed emphasis |
| Status/success | `--status-success` | `#208A68` | `#43B98B` | Completed and healthy states |
| Status/warning | `--status-warning` | `#B87919` | `#E6A63C` | Caution and pending attention |
| Status/error | `--status-error` | `#C43D4C` | `#F06E7A` | Errors and destructive actions |
| Status/info | `--status-info` | `#3D7CA8` | `#75B8E0` | Informational notices |

### Rules

- The coral accent is the only decorative accent color.
- Status colors are semantic and must not become decorative gradients.
- Every new color must first be added as a semantic token here.
- All light and dark combinations must meet WCAG 2.2 AA contrast requirements.
- Do not use AI-purple gradients, random neon glows, or emoji as icons.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Tracking | Usage |
|-------|------|--------|-------------|----------|-------|
| Display | `48px / 3rem` | 700 | 1.1 | -0.02em | Public landing hero and major moments |
| H1 | `36px / 2.25rem` | 700 | 1.2 | -0.015em | Page titles |
| H2 | `28px / 1.75rem` | 600 | 1.3 | -0.01em | Activity and section headings |
| H3 | `22px / 1.375rem` | 600 | 1.4 | 0 | Component headings |
| Body/lg | `18px / 1.125rem` | 400 | 1.6 | 0 | Lead copy and prompt text |
| Body | `16px / 1rem` | 400 | 1.6 | 0 | Default text |
| Body/sm | `14px / 0.875rem` | 400 | 1.5 | 0 | Supporting information |
| Caption | `12px / 0.75rem` | 500 | 1.4 | 0.02em | Metadata and status labels |

### Font Stack

- Primary: Geist, system-ui, -apple-system, sans-serif.
- Mono: Geist Mono, ui-monospace, SFMono-Regular, monospace.
- Serif: none by default.

### Rules

- Use at most two font families.
- Body text must not be smaller than 14px.
- Use the same family for emphasis; do not mix a decorative serif into headings.

## 4. Spacing & Layout

### Base Unit

All spacing derives from a base of 4px.

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Icon-to-label and tiny gaps |
| `--space-2` | 8px | Compact groups |
| `--space-3` | 12px | Form field internals |
| `--space-4` | 16px | Standard control spacing |
| `--space-5` | 20px | Comfortable local grouping |
| `--space-6` | 24px | Default panel padding |
| `--space-8` | 32px | Group separation |
| `--space-10` | 40px | Section internals |
| `--space-12` | 48px | Major section breaks |
| `--space-16` | 64px | Page rhythm |
| `--space-20` | 80px | Hero spacing |

### Grid

- Maximum content width: 1200px.
- Desktop: 12-column grid with 24px gutters.
- Mobile: single-column flow with 16px page margins.
- Breakpoints: `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`.

### Rules

- No arbitrary spacing values; use tokens or documented one-off layout decisions.
- Multi-column layouts must specify an explicit mobile collapse.
- Prefer asymmetric composition and meaningful negative space over repeated card grids.

## 5. Components

Components are documented here when they are reused at least twice. The first planned patterns are:

### Activity shell

- **Structure:** activity title, partner state, current state content, primary action, secondary escape action.
- **States:** idle, loading, waiting, success, error, reconnecting, cancelled.
- **Accessibility:** landmark structure, visible focus, status announcements for state changes.

### Prompt card

- **Structure:** prompt text, category metadata, optional refresh action.
- **States:** default, selected, loading, unavailable, error.
- **Accessibility:** prompt is readable as a single labeled region; refresh action has a descriptive label.

### Answer composer

- **Structure:** labeled input, helper text, validation message, submit action.
- **States:** empty, editing, submitting, submitted/locked, error.
- **Accessibility:** label above input, keyboard submission, clear error association.

### Reveal panel

- **Structure:** two partner answer regions, match indicator, reaction action.
- **States:** waiting, reveal transition, revealed, content-deleted.
- **Accessibility:** reveal state is announced without relying on animation or color alone.

## 6. Motion & Interaction

### Timing

| Type | Duration | Easing | Usage |
|------|----------|--------|-------|
| Micro | 120ms | ease-out | Button press and toggles |
| Standard | 240ms | ease-in-out | Panels, tabs, and status changes |
| Emphasis | 450ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Reveal and meaningful transitions |

### Rules

- Animate only `transform`, `opacity`, and approved composited properties.
- Motion must communicate feedback, hierarchy, or state transition.
- Respect `prefers-reduced-motion` and disable non-essential animation.
- Presence and reveal motion must never be the only way to understand state.
- No infinite decorative shimmer, floating cards, or automatic attention loops.

## 7. Depth & Surface

### Strategy

Use **tonal shift** as the primary depth strategy. Surfaces create hierarchy through small palette steps rather than heavy shadows or decorative borders. Borders remain available for functional form controls, focus states, and error states.

- Primary background → secondary grouping → elevated activity surface.
- No pure-black shadows on light surfaces.
- Rounded corners use one documented scale: 12px for panels, 8px for controls, and full-pill only for compact status chips.
- A surface should exist only when it communicates grouping, focus, or interaction hierarchy.
