# FireOps AI 企业应用规格

#### Requirement: Government isolation and backup

The enterprise repository MUST NOT modify the government source repository. Verification MUST compare the government repository's absolute path, HEAD commit, tree, known tracked-diff/status/untracked fingerprints, and the complete Git bundle refs against the recorded migration baseline.

#### Requirement: Human-gated operational state

The application MUST enforce the documented alarm, workorder, rectification, and recheck state transitions in the repository layer. AI output MUST remain read, analysis, recommendation, evidence, or draft data; verification, dispatch, start, completion, and recheck MUST require a human API/UI action. Illegal transitions MUST return a stable conflict response and repeated terminal actions MUST be idempotent.

#### Requirement: Evidence-grounded Copilot

Copilot MUST support the five canonical Scenario fixtures and an optional Live provider. It MUST expose plan, tool trace, accepted evidence, rejected evidence, missing fields, approval points, model/provider identity, and fallback reason. Evidence MUST be limited to references returned by executed tools, and a run bound to an existing event MUST NOT create a duplicate event.

#### Requirement: Inspection vision provider

Inspection recognition MUST expose the current provider/model, confidence, evidence references, and abstention or failure reason. Missing images, unsupported formats, low confidence, and provider failures MUST preserve human entry and MUST NOT create a workorder or change an operational state. A Live provider MUST be replaceable without changing the workflow state machine.

#### Requirement: Enterprise dossier context

The enterprise dossier MUST aggregate backend enterprise, point, event, maintenance, finding, workorder, and evidence data. Navigation from the dossier and between operational routes MUST preserve `enterprise_id` and any applicable event, incident, workorder, or finding identifier.

#### Requirement: Complete action contract

Every visible primary action MUST have a working handler or native navigation. Unavailable actions MUST be disabled with a visible prerequisite. Business statuses MUST be shown in Chinese, mutually exclusive transitions MUST not be shown together, and desktop/mobile routes MUST not contain unexplained empty primary regions.

#### Requirement: Reproducible local runtime

The project MUST start PostgreSQL, API, and static frontend through a documented local command with health waiting and actionable failure output. Demo and automated test databases MUST be isolated. A safe reset command MUST restore synthetic Scenario and workflow state and MUST be repeatable.

#### Requirement: Graceful situational 3D

The 3D map MUST remain a situational entry rather than a required workflow dependency. Successful loading MUST produce a visible canvas with selectable varied factory buildings and risk beacons; loading failure or timeout MUST show a reason and retain equivalent 2D operational actions.

#### Requirement: Consistent competition package

The external brand MUST be `FireOps AI｜工厂消防设备运维 Agent`. The repository MUST include current enterprise documentation, a distinct local SVG logo, a 12-page 16:9 PPTX/PDF, and an 85–95 second 1920×1080 H.264/AAC narrated demo using the final tested interface. Government-product narratives MUST not appear in competition-facing materials.

#### Requirement: GOAI completion audit

Before delivery, the project MUST pass the documented backend, domain, route, Scenario, cross-page, action-contract, mobile, artifact, video, and consistency checks. A final GOAI checklist MUST cover target user, pain, workflow, model/Agent, tools, knowledge, data source, deployment, safety/compliance, evaluation, iteration, and open-source reuse with no required item left incomplete.
