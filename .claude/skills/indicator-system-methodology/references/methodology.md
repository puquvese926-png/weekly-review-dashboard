# Enterprise Indicator Methodology (Large-Company Style)

## Why this method works

Large organizations avoid metric chaos by combining:

1. Strategic outcome metrics.
2. Diagnostic drill-down metrics.
3. Actionable team metrics.
4. Governance and ownership.

This file provides a practical hybrid playbook.

## Framework Map

### 1) North Star + Metric Tree

Use as the backbone for product/business growth.

1. Pick one core value outcome (`L0`).
2. Decompose into 3-6 value drivers (`L1`).
3. Add diagnostics (`L2`) and team actions (`L3`).

Use when:

1. Need alignment across teams.
2. Need clear cause-effect path from team action to business result.

### 2) AARRR (growth funnel)

Use for growth lifecycle:

1. Acquisition
2. Activation
3. Retention
4. Referral
5. Revenue

Use when:

1. Need to locate growth leakage by stage.
2. Need to split marketing/product/ops responsibilities clearly.

### 3) HEART + GSM (Google UX metric method)

HEART dimensions:

1. Happiness
2. Engagement
3. Adoption
4. Retention
5. Task Success

GSM process:

1. Goals
2. Signals
3. Metrics

Use when:

1. Feature quality and user experience matter as much as volume growth.
2. Product has high interaction complexity.

### 4) Balanced Scorecard (executive balance)

Use four perspectives to avoid over-optimizing one side:

1. Financial
2. Customer
3. Internal Process
4. Learning & Growth

Use when:

1. Executive committee needs cross-function balance.
2. Team tends to chase single-number wins.

### 5) Input vs Output split (operations discipline)

Use two classes:

1. Output metrics: lagging outcomes (revenue, churn, margin).
2. Input metrics: controllable drivers (coverage, cycle time, quality pass rate).

Use when:

1. Teams need weekly operations steering, not only monthly result reading.

## Standard Design Sequence (8 Steps)

### Step 1: Define decision and horizon

1. Decision owner.
2. Decision frequency.
3. Time horizon (30/90/365 days).

### Step 2: Define strategic outcomes

1. 1-3 outcomes only.
2. Each outcome must be measurable and time-bound.

### Step 3: Build metric tree

1. Build L0-L3 hierarchy.
2. For each child metric, explain parent linkage.

### Step 4: Build metric dictionary

1. Freeze formulas and scope.
2. Assign owner and fallback owner.
3. Record edge cases and exclusions.

### Step 5: Set baseline and target bands

1. Baseline: recent stable period.
2. Commit target.
3. Stretch target.
4. Floor/risk threshold.

### Step 6: Add guardrails

For every core metric add at least one:

1. Quality guardrail.
2. Cost guardrail.
3. Risk/compliance guardrail.

### Step 7: Set review cadence

1. Daily anomaly scan (leading metrics).
2. Weekly diagnosis + action assignment.
3. Monthly target and threshold recalibration.
4. Quarterly tree restructuring with strategy updates.

### Step 8: Close loop with experimentation

1. Hypothesis.
2. Intervention.
3. Expected metric movement.
4. Post-check and rollback conditions.

## Quality Rules

1. One metric, one definition.
2. One dashboard value, one source of truth.
3. Do not mix stock and flow in one ratio without clear normalization.
4. Distinguish leading and lagging indicators.
5. Separate health metrics and performance metrics.

## Anti-Patterns

1. Vanity metrics without decision use.
2. Targets without baselines.
3. Metrics without owner.
4. Single KPI with no guardrail.
5. Frequent formula drift across teams.

## Recommended Reading Anchors

1. Google HEART paper: [Measuring the User Experience on a Large Scale](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)
2. Google archived PDF mirror: [research.google.com/pubs/archive/36299.pdf](https://research.google.com/pubs/archive/36299.pdf)
3. North Star framework overview: [Amplitude North Star Framework](https://amplitude.com/books/north-star/about-north-star-framework)

Note:

1. Use these as conceptual anchors.
2. Always adapt metric definitions to your business model and data reality.
