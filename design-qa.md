# Design QA

## Reference

- Selected direction: option 3 overall structure with option 1 central floor map.
- Visual system: warm white workspace, near-black type, lavender interaction accent, red reserved for fire/risk.
- Unsupported evacuation-route recommendation was intentionally omitted.

## Verified

- Desktop monitoring view renders the floor plan, alarm point, event queue, evidence summary and human verification gate without the legacy 3D fallback covering the map.
- Event selection updates the monitored enterprise and highlighted position.
- Mobile routes fit a 390×844 viewport without horizontal page overflow; primary actions retain at least 44 px touch height.
- Dark cyber styling no longer dominates the main workspace. Legacy dark screenshots remain only as evidence of already implemented secondary flows in presentation/video materials.
- PPTX has 11 slides, no detected slide overflow, and was inspected as a complete montage. PDF was rebuilt from the verified high-resolution slide renders to preserve Chinese text.

## Evidence

- Desktop: `tmp/design-reference/fireops-monitoring-after.png`
- Mobile: `tmp/design-reference/fireops-monitoring-mobile.png`
- Deck montage: `tmp/ppt-v2/montage.png`
- PDF montage: `tmp/ppt-v2/pdf-montage-v2.png`

final result: passed
