# VitalSense UI/UX Design Tokens v2.0

## Visual reference is authoritative for composition
Use `references/VitalSense-Health-App-Showcase.png` as the primary visual reference. Match its overall composition and visual language: desktop light/dark dashboards at the top; a row of purpose-designed mobile screens below; compact sidebar; hero with anatomical illustration; pastel metric tiles; analytics cards; charcoal dark theme.

## Colour system
### Light
- Canvas `#F4F1EC`; surface `#FBF9F5`; elevated `#FFFFFF`; sidebar `#F0EDE7`.
- Primary text `#252C32`; secondary `#69727A`; border `#E5E0D8`.
- Brand teal `#285F58`; mint primary CTA `#B9D6BE`.
- Metric accents: coral `#E98F8E`, mint `#A9C9B9`, lavender `#B8A9E6`, blue `#8EB9D8`, peach `#F0B58D`.

### Dark
- Canvas `#202326`; surface `#292D31`; elevated `#30353A`; sidebar `#24282C`.
- Primary text `#F2F2EF`; secondary `#B8BEC0`; border `#3B4145`.
- Brand teal `#A9CDBB`; primary CTA `#E9E0CF`.
- Metric accents: coral `#F19B9B`, mint `#A8C9B8`, lavender `#B6A6E8`, blue `#8EBDE0`, peach `#E9B28F`.

Green/teal is a restrained brand accent, not a dominant page background or oversized block colour.

## Typography
Manrope/Inter/system sans. Data uses tabular numerals. Scale: 42, 32, 25, 20, 16, 16, 14, 12, 10px. Headings 1.18 line-height; body 1.5.

## Layout
Desktop content max 1480px; compact sidebar 142px; desktop header 60px. Mobile header 60px and bottom nav 64px. Gutters 16px mobile, 24px tablet, 28px desktop. Breakpoints: 767px / 768–1023px / 1024px+.

## Components
Cards radius 19px, standard padding 18px. Buttons 34/42/50px, pill-shaped. Inputs 44px, pill-shaped. Metric cards use circular pastel icon tiles. Charts show units, date range, subtle grid and a textual summary.

## Screen composition
Desktop: compact left navigation, search/header row, wide hero with anatomical art and health score summary, four metric cards, then activity overview/body metrics/next workout modules. Mobile: separate welcome/onboarding, home overview, trends, body explorer and family health/settings screens as allowed by approved product phase and permissions. Bottom navigation must remain touch-friendly.

## Product/data integrity
No AI slope. Do not fabricate health data. Clearly distinguish measured, manual, imported, AI and ML data; show source/freshness. Missing data is not zero and must not be labeled Normal. AI/ML is non-diagnostic. Respect Phase 1 scope and future-phase gates. Sample values/names in the visual reference are placeholders only.
