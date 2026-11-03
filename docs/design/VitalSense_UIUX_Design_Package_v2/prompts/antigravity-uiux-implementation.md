# Antigravity — VitalSense UI/UX implementation (reference-aligned v2)

Read all files in this package before editing. The supplied image
`references/VitalSense-Health-App-Showcase.png` is the primary visual
reference. The JSON tokens are the exact palette/layout starting point.

Implement the visual direction shown in the reference:
- Desktop light and charcoal dark dashboard compositions.
- Compact left navigation and search/header row.
- Hero panel with anatomical visualization and health summary.
- Four pastel metric cards with distinct icon accents.
- Activity analytics, body metrics and workout modules.
- Purpose-designed mobile welcome, home, trends, body explorer,
  family/settings screens where permitted by the approved product phase.
- Mobile bottom navigation and touch-friendly cards.

Use the exact theme tokens in `design/design-tokens.json`.
Do not revert to a green-dominant UI. Teal is restrained branding;
mint is a CTA/accent. No AI slope.

Before coding, inspect the current repository and map actual routes,
API capabilities and approved Phase 1 scope. Preserve working backend
integrations. Do not turn sample names, scores, metrics or values from
the reference into real user data. Do not invent health score formulas.
If the current backend does not support a visual element, show an
honest unavailable/empty state or request approval for the feature.

Build a shared reusable component system and theme architecture.
Implement desktop/tablet/mobile layouts intentionally, not by shrinking
desktop. Keep accessibility, keyboard focus, 44px touch targets,
reduced motion and chart text alternatives.

Connect controls to real APIs/local operations. Do not fake successful
actions. Distinguish measured, manual, imported, AI and ML data.
Respect approved release phases; do not activate future features
without authorization.

Run builds, type checks, lint and tests. Capture desktop light,
desktop dark, mobile light and mobile dark screenshots. Report changed
files, verified interactions, test evidence and limitations. Do not
commit, push, merge or deploy without explicit user approval.
