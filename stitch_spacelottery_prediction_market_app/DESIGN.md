---
name: Orbital Parimutuel
colors:
  surface: '#0e1223'
  surface-dim: '#0e1223'
  surface-bright: '#34384b'
  surface-container-lowest: '#090d1e'
  surface-container-low: '#171b2c'
  surface-container: '#1b1f30'
  surface-container-high: '#25293b'
  surface-container-highest: '#303446'
  on-surface: '#dee1fa'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#dee1fa'
  inverse-on-surface: '#2c2f42'
  outline: '#849495'
  outline-variant: '#3b494b'
  surface-tint: '#00dbe9'
  primary: '#dbfcff'
  on-primary: '#00363a'
  primary-container: '#00f0ff'
  on-primary-container: '#006970'
  inverse-primary: '#006970'
  secondary: '#e0b6ff'
  on-secondary: '#4c007d'
  secondary-container: '#6d11ad'
  on-secondary-container: '#d7a4ff'
  tertiary: '#dbffde'
  on-tertiary: '#003918'
  tertiary-container: '#34f885'
  on-tertiary-container: '#006e35'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7df4ff'
  primary-fixed-dim: '#00dbe9'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f54'
  secondary-fixed: '#f2daff'
  secondary-fixed-dim: '#e0b6ff'
  on-secondary-fixed: '#2e004e'
  on-secondary-fixed-variant: '#6a0baa'
  tertiary-fixed: '#62ff96'
  tertiary-fixed-dim: '#00e475'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005226'
  background: '#0e1223'
  on-background: '#dee1fa'
  surface-variant: '#303446'
typography:
  display-hero:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-hero-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-telemetry-lg:
    fontFamily: Space Grotesk
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 18px
    letterSpacing: 0.06em
  label-telemetry-sm:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.08em
  data-mono-num:
    fontFamily: Space Grotesk
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  space-3xl: 4rem
  gutter-mobile: 1rem
  gutter-desktop: 1.5rem
  max-container: 1320px
---

## Brand & Style

This design system establishes a high-trust, futuristic Web3 parimutuel and trivia-prediction experience where astrophysics meets verifiable computation. The aesthetic merges **cybernetic DeFi precision** with **translucent orbital glassmorphism** and subtle **deep-space atmosphere**. 

### Brand Archetype & Tone
- **Atmospheric & Immersive:** Grounded in deep cosmic vacuums, avoiding pitch-black voids in favor of layered dark slate and interstellar navy.
- **Instrument-Grade & Auditable:** Evoking real-time aerospace mission control displays, telemetry HUDs, and immutable decentralized ledgers. 
- **High-Stakes & Exhilarating:** Electric cyan accents and cosmic violet gradients signal high-velocity prediction rounds, countdown tension, and algorithmic transparency.

### Design Language: Deep-Space Glass Telemetry
The visual identity relies on fine hairline borders (1px) with neon refraction, layered semi-translucent dark slate surfaces, subtle radial luminosity, tabular telemetry monospace accents, and tactile glowing status indicators. Interactive components balance rounded tactile forms with crisp, mathematically aligned data surfaces.

## Colors

The palette operates in default `dark` mode, utilizing specialized layers of space-black, luminescence, and functional state indicators to maximize contrast and auditability.

### Base Canvases & Surface Hierarchy
- **Void Floor (`#080B14`):** Primary system background canvas; represents deep-space vacuum.
- **Orbital Surface (`#0D1122`):** Primary structural surface for rails, headers, and container viewports.
- **Elevated Slate Layer (`#12192F`):** Semi-translucent base for interactive prediction cards, floating sheets, and modals (applied typically at `85%` opacity with backdrop blur).
- **Surface Hover / Active (`#1A2342`):** Interactive response tier for rows, card focus, and secondary surfaces.

### Accents & Kinetic Highlights
- **Electric Cyan (`#00F0FF`):** The primary signal driver. Used for active market liquidity, core CTAs, selected wager outcomes, and primary countdown timers. Glow effect: `0 0 16px rgba(0, 240, 255, 0.35)`.
- **Galactic Purple (`#9D4EDD`):** The secondary protocol driver. Designates prediction pools, orbital rounds, multipliers, and secondary telemetry badges. Glow effect: `0 0 16px rgba(157, 78, 221, 0.35)`.

### Functional Semantic Engine
- **Telemetry Emerald (`#00E676`):** Signals verified consensus, resolved oracle states, confirmed wallet signatures, and winning pool distributions.
- **Orbital Amber (`#FF9100`):** Alerts users to disputed oracle reports, grace-period cutoffs, slippage warnings, or network telemetry lag.
- **Critical Red (`#FF3366`):** Liquidation, pool closure, lost positions, or invalid smart contract interactions.

### Text & Telemetry Contrast Tiers
- **Optic White (`#FFFFFF`):** Primary headlines, active numbers, parimutuel odds, and current price balances.
- **Starlight Muted (`#94A3B8`):** Secondary metadata, inactive states, table headers, and telemetry labels.
- **Deep Space Subdued (`#475569`):** Disabled inputs, passive borders, and grid markings.

## Typography

The typographical structure balances sleek consumer readability with high-density scientific readouts.

- **Display & Headlines (Plus Jakarta Sans):** Brings soft geometry and approachable prestige to prediction questions, prize pools, and landing views.
- **Body & Editorial (Inter):** Applied across explanations, terms, voting mechanics, and governance details for neutral, high-legibility rendering at standard DPI.
- **Telemetry & Technical Layer (Space Grotesk):** Designed specifically for satellite identifiers, countdown chronometers, parimutuel pools, crypto wallet hashes, and oracle verification proofs. All numerical readouts in this style must enforce CSS `font-variant-numeric: tabular-nums` to eliminate jitter during active real-time ticker updates.

## Layout & Spacing

The layout is built around a **12-column adaptive fluid grid** bounded by an ultra-wide structural ceiling of `1320px` to maintain cockpit density.

### Breakpoints & Spatial Adaptations
- **Desktop (≥ 1200px):** 12 columns, 24px gutters, dynamic side margins up to max container width. Primary views adopt a multi-column dashboard layout (e.g., Live Orbital Visualizer & Active Trivia Market in 8 columns, Telemetry Ledger & Bet Slip in 4 columns).
- **Tablet (768px – 1199px):** 8 columns, 16px gutters, 24px side margins. Telemetry and wager actions stack underneath primary prediction cards or dock into persistent bottom sheets.
- **Mobile (≤ 767px):** 4 columns, 12px gutters, 16px outer safety margins. Odds buttons shift into full-width tap targets with bottom-docked execution drawers.

### Spacing Rhythm
Built upon an immutable 4px/8px incremental rhythm. Spacing between independent cards follows `space-xl` (32px), while internal component padding follows `space-lg` (24px) for cards, and `space-xs` to `space-sm` for interactive pills and telemetry chips.

## Elevation & Depth

Visual depth is achieved through **multi-layered frosted glass planes** and **chromatic ambient glow**, simulating light radiating inside an orbital vehicle command console against the void of space.

### Depth Architecture
1. **Tier 0 (Void Canvas):** Base background `#080B14` augmented with subtle CSS radial gradients (`radial-gradient(ellipse at 50% 0%, rgba(157, 78, 221, 0.12), transparent 70%)`) representing deep-space nebulae.
2. **Tier 1 (Static Panels):** Background `#0D1122`, bounded by low-contrast hairline borders `1px solid rgba(148, 163, 184, 0.1)`. No shadow.
3. **Tier 2 (Interactive Glass Cards):** Background `rgba(18, 25, 47, 0.75)` with `backdrop-filter: blur(16px)` and a directional border highlight `linear-gradient(135deg, rgba(0, 240, 255, 0.3) 0%, rgba(157, 78, 221, 0.1) 50%, rgba(255, 255, 255, 0.05) 100%)`. Soft shadow: `0 12px 32px -4px rgba(0, 0, 0, 0.6)`.
4. **Tier 3 (Modals & Wager Slips):** Background `rgba(18, 25, 47, 0.95)`, `backdrop-filter: blur(24px)`, active outer glow: `0 0 24px rgba(0, 240, 255, 0.2), 0 20px 40px rgba(0, 0, 0, 0.8)`.

### Chromatic Edge Lighting
Selected states do not simply thicken borders; they illuminate them using inner and outer neon diffusion. Cyan selections produce `box-shadow: 0 0 15px rgba(0, 240, 255, 0.25), inset 0 0 10px rgba(0, 240, 255, 0.1)`.

## Shapes

The design system employs a **Rounded (Level 2)** geometry to balance aerospace precision with accessible Web3 mobile interaction.

- **Primary Cards & Containers:** Standardized at `rounded-2xl` (`1rem` / `16px`). This softens dark UI hardness without compromising dense tabular data layouts.
- **Buttons & Primary Controls:** Standardized at `rounded-xl` (`0.75rem` / `12px`) for clear ergonomic affordance.
- **Telemetry Chips, Badges & Pills:** Full pill treatment (`rounded-full` / `9999px`) to immediately differentiate live signals, tags, oracles, and pool states from structural cards.
- **Form Controls & Inputs:** Styled at `rounded-xl` (`0.75rem` / `12px`), matching primary action controls for spatial consistency.

## Components

### Buttons
- **Primary Cybernetic Action:** Background: Electric Cyan (`#00F0FF`), Text: `#080B14` (Heavy weight), Shape: `rounded-xl`. Hover creates subtle expansion and neon aura: `box-shadow: 0 0 20px rgba(0, 240, 255, 0.5)`.
- **Secondary Galactic Pool Action:** Background: Galactic Purple (`#9D4EDD`), Text: `#FFFFFF`, Shape: `rounded-xl`. Active state triggers purple telemetry bloom.
- **Ghost Telemetry Button:** Background: `rgba(255, 255, 255, 0.03)`, Border: `1px solid rgba(148, 163, 184, 0.2)`, Text: `#FFFFFF`, Hover: Border color switches to Cyan with `rgba(0, 240, 255, 0.08)` surface tint.

### Prediction & Market Cards
- Structure: Constructed from Tier 2 glass surfaces with `rounded-2xl` geometry.
- Header Zone: Satellite pass name, live countdown chronometer with pulsating beacon dot, and parimutuel prize pool readout.
- Body Zone: Trivia/prediction inquiry presented in `headline-sm` with tabular consensus ratios.
- Footer Zone: Split dual-outcome prediction toggles with dynamic odds calculation.

### Telemetry Pills & Oracle Trust Badges
- **SatNOGS / GenLayer Verification Badge:** Shape: `rounded-full`, Background: `rgba(0, 230, 118, 0.08)`, Border: `1px solid rgba(0, 230, 118, 0.3)`, Text: `#00E676`, Typography: `label-telemetry-sm`. Prepended with an emerald radar ping animation.
- **Disputed / Consensus Lag Badge:** Shape: `rounded-full`, Background: `rgba(255, 145, 0, 0.08)`, Border: `1px solid rgba(255, 145, 0, 0.3)`, Text: `#FF9100`.

### Form & Bet Slip Inputs
- Text and currency entries feature an inset dark foundation (`#0A0E1A`) with `1px solid rgba(148, 163, 184, 0.15)` border.
- Focus state: Border transitions smoothly to Electric Cyan (`#00F0FF`) with a `0 0 10px rgba(0, 240, 255, 0.2)` illumination. Right-aligned token selectors and balance percentage shortcuts (`25%`, `50%`, `MAX`) styled in monospaced Space Grotesk.

### Selection Chips & Binary Odds Toggles
- Dual-selection cards ("YES/HIGH", "NO/LOW"): Divided layout with transparent slate backgrounds.
- Selected State: Outlined with `1.5px solid #00F0FF`, accompanied by an internal radial gradient accentuating the choice.

### Telemetry Lists & Ledger Tables
- Unbordered, separated by hairline dividers (`rgba(148, 163, 184, 0.08)`).
- Alternate rows highlight on cursor hover via `rgba(255, 255, 255, 0.02)`.
- Numeric data columns align strictly right with `data-mono-num` Space Grotesk formatting.