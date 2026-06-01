---
name: indicator-system-methodology
description: "Use when building, reviewing, or upgrading KPI/指标体系 for business, product, operations, sales, finance, or management reviews. Provides enterprise-grade method: strategy decomposition, North Star + metric tree, guardrail metrics, metric dictionary, target setting, governance cadence, and anti-gaming checks."
---

# Indicator System Methodology

## Overview

Use this skill to build indicator systems that are actionable, consistent, and management-ready.
Focus on linking strategy to day-to-day actions instead of collecting vanity metrics.

## Workflow

### 1) Clarify decision scenario first

Define:

1. Business stage (0-1 growth / scaled growth / mature operation).
2. Decision cadence (daily / weekly / monthly / quarterly).
3. Core decision to support (resource allocation, growth diagnosis, risk control, etc.).

### 2) Choose framework mix by scenario

Use a combination instead of one framework only:

1. `North Star + Metric Tree`: primary strategy-to-execution backbone.
2. `AARRR`: growth funnel decomposition.
3. `HEART (Google)`: user-experience quality metrics.
4. `Balanced Scorecard`: executive cross-function balance.
5. `Input / Output metrics split`: keep controllable drivers and outcome results aligned.

Detailed definitions: [references/methodology.md](references/methodology.md).

### 3) Build L0-L3 metric architecture

Use four layers:

1. `L0 Outcome`: one North Star or top business outcome.
2. `L1 Pillars`: 3-6 strategic dimensions.
3. `L2 Diagnostic metrics`: explain why L1 moved.
4. `L3 Action metrics`: team-level controllable inputs.

Rule: each L2/L3 metric must trace to an upper-layer metric.

### 4) Define metric dictionary (mandatory)

For every metric define:

1. Metric name.
2. Business meaning.
3. Formula and unit.
4. Time granularity and cohort scope.
5. Data source and refresh schedule.
6. Owner and backup owner.
7. Baseline, target, and alert threshold.
8. Common misread and caveat.

Template: [references/templates.md](references/templates.md).

### 5) Set target system (not single-point target)

Use three bands:

1. `Commit`: expected achievement level.
2. `Stretch`: excellent level.
3. `Floor`: risk line triggering intervention.

### 6) Add guardrails and anti-gaming checks

For each core metric define at least one guardrail:

1. Growth guardrail (e.g., conversion up but complaints down?).
2. Cost guardrail (e.g., revenue up but CAC exploding?).
3. Quality guardrail (e.g., speed up but defect rate up?).

### 7) Define operating cadence

Use standard rhythm:

1. Daily: anomaly scan on leading indicators.
2. Weekly: diagnose movement and assign actions.
3. Monthly: review target fit, adjust thresholds/owners.
4. Quarterly: re-check metric tree with strategy updates.

### 8) Deliver output artifacts

Always produce:

1. One-page metric tree.
2. Metric dictionary table.
3. KPI review dashboard structure.
4. Meeting agenda and owner/action tracker.

## Output Quality Bar

1. No metric without clear owner.
2. No target without baseline.
3. No core metric without guardrail.
4. No KPI set that cannot drive a concrete decision.
5. No mixed-caliber metrics in one layer (outcome and process must be separated).

## References

1. Method and framework details: [references/methodology.md](references/methodology.md)
2. Ready-to-use templates: [references/templates.md](references/templates.md)
