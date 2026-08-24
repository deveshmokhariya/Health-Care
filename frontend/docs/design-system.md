# Healthcare Appointment & Follow-up Manager - Design System

This document outlines the single spacing, sizing, and styling system used across the application to ensure pixel-perfect consistency.

## 1. Grid & Spacing Scale (Base: 4px)
We strictly adhere to the Tailwind spacing scale. No arbitrary values (e.g., 13px, 22px) are permitted.
- 2 (8px) - Tight gaps (e.g., icon and label, small lists)
- 3 (12px) - Minor inner padding (e.g., small badges, tight buttons)
- 4 (16px) - Standard inner padding (e.g., form inputs, buttons)
- 6 (24px) - Standard component gap (e.g., spacing between form fields, standard card padding)
- 8 (32px) - Large component gap (e.g., main sections within a card)
- 12 (48px) - Section gaps (e.g., spacing between minor page sections)
- 16 (64px) - Large section padding (e.g., landing page sections)

## 2. Typography Scale
We use standard Tailwind classes for typography. Line heights must match the default tailwind scale.
- 	ext-xs (12px): Badges, tiny metadata, uppercase labels.
- 	ext-sm (14px): Secondary text, helper text, table data.
- 	ext-base (16px): Primary body text, standard inputs, buttons.
- 	ext-lg (18px): Card titles, prominent buttons.
- 	ext-xl (20px): Section headers within cards.
- 	ext-2xl (24px): Minor page headers.
- 	ext-3xl (30px): Main dashboard headers.
- 	ext-5xl (48px) - 	ext-6xl (60px): Landing page hero text.

**Font Weights:**
- ont-medium (500): Standard body text and secondary buttons.
- ont-bold (700): Buttons, headers, important labels.
- ont-extrabold (800): Landing page hero, large numbers, active states.

## 3. Border Radius System
- ounded-md (6px): Badges, tiny UI elements.
- ounded-lg (8px): Inputs, standard buttons.
- ounded-xl (12px): Large buttons, secondary cards.
- ounded-2xl (16px): Standard cards, dashboard panels.
- ounded-3xl (24px): Large prominent cards (e.g., appointment summary).
- ounded-full (9999px): Pills, avatars, circular icon buttons.

## 4. Shadow & Elevation Scale
- Level 1: shadow-sm (Inputs, subtle cards)
- Level 2: shadow-md (Buttons, dropdowns, hovered standard cards)
- Level 3: shadow-lg (Prominent buttons, active dragging states)
- Level 4: shadow-xl (Modals, primary dashboard containers)

## 5. Container & Max-Width System
- **Main Layout Wrapper:** max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 (Applied to all dashboards and landing sections)
- **Authentication Forms:** max-w-md w-full mx-auto
- **Dashboard Sections:** Allow natural expansion within the max-w-7xl grid (e.g., grid-cols-1 md:grid-cols-2 lg:grid-cols-3).

## 6. Color Themes (Per Portal)
- **Landing / Patient Portal:** Clinical Teal (	eal-50 to 	eal-900)
- **Doctor Portal:** Indigo (indigo-50 to indigo-900)
- **Admin Portal:** Slate (slate-50 to slate-900)
- **Status / Urgency:**
  - Low/Success: Soft Green (green-100 bg, green-800 text)
  - Medium/Warning: Amber/Gold (mber-100 bg, mber-800 text)
  - High/Danger: Coral-Red (ed-100 bg, ed-800 text)

## 7. Component Alignment Rules
- **Buttons with Icons:** Must use lex items-center justify-center gap-2.
- **Forms:** Labels, inputs, and error text must be consistently left-aligned with a space-y-2 gap.
- **Card Action Rows:** Actions placed at the bottom of a card must use mt-auto (flex layout) to align to the bottom universally across a row.
- **Badges:** Vertically centered with adjacent text using lex items-center gap-2.
- **Truncation:** Use 	runcate (overflow-hidden, text-overflow: ellipsis, whitespace-nowrap) for dynamic text like doctor names or long medicine names inside rigid containers.
- **Touch Targets:** Minimum min-h-[44px] or p-2 on mobile for icon-only buttons to ensure they are easily tappable.
