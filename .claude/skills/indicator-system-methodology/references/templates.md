# Indicator System Templates

Use these templates directly in docs/sheets.

## 1) Metric Tree Template

| Layer | Metric | Purpose | Formula | Owner | Cadence |
|---|---|---|---|---|---|
| L0 Outcome |  |  |  |  | Monthly |
| L1 Pillar |  |  |  |  | Weekly |
| L2 Diagnostic |  |  |  |  | Weekly |
| L3 Action |  |  |  |  | Daily/Weekly |

## 2) Metric Dictionary Template

| Field | Content |
|---|---|
| Metric Name |  |
| Business Definition |  |
| Numerator |  |
| Denominator |  |
| Formula |  |
| Unit |  |
| Granularity |  |
| Scope/Cohort |  |
| Data Source |  |
| Refresh Timing |  |
| Owner |  |
| Backup Owner |  |
| Baseline |  |
| Commit Target |  |
| Stretch Target |  |
| Floor Threshold |  |
| Guardrail Metrics |  |
| Typical Misread |  |
| Notes/Exclusions |  |

## 3) KPI Review Meeting Template

### Input

1. Dashboard snapshot.
2. Top 3 improving metrics.
3. Top 3 deteriorating metrics.
4. Ongoing actions and owners.

### Discussion order

1. Outcome change (`L0/L1`): what changed.
2. Driver diagnosis (`L2`): why changed.
3. Action review (`L3`): what to continue/stop/start.
4. Risk check: quality/cost/compliance guardrails.

### Output

1. Confirmed decisions.
2. Action items with owner and due date.
3. Metrics to watch next cycle.
4. Escalations and dependencies.

## 4) Traffic-Light Threshold Template

| Metric | Green | Yellow | Red | Action Trigger |
|---|---|---|---|---|
|  | >= Target | Between floor and target | < Floor | Red for 2 periods -> launch fix plan |

## 5) 30-60-90 Day Rollout Template

### Day 1-30

1. Freeze definitions for top 10 metrics.
2. Build first version metric tree.
3. Assign owners and cadence.

### Day 31-60

1. Add guardrails and thresholds.
2. Stabilize dashboard and data refresh.
3. Start weekly review ritual.

### Day 61-90

1. Remove unused vanity metrics.
2. Link actions to metric movement history.
3. Finalize operating playbook and escalation path.
