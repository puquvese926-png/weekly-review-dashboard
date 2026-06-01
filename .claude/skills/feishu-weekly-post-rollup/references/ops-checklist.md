# Operations Checklist

## Pre-Run Checklist

1. Browser MCP is connected to fixed Chrome session.
2. User is logged into Feishu and source/target tables are accessible.
3. `source_tables`, `weekly_table`, `premium_table` URLs are valid.
4. Channel field mappings are present for all sources.
5. Channel color mappings are present and use background color values.
6. Weekly table contains helper columns:
   `周区间`, `汇总批次`, `临时标记`.

## Run Steps (Operator View)

1. Calculate target week (default current week minus two natural weeks).
2. Validate double-run guard for target week.
3. Read rows in target week from each source table.
4. Normalize all rows to weekly schema.
5. Append normalized rows to weekly table (including duplicate color rows).
6. Copy premium color rows to premium table.
7. Delete `临时标记 = batch_id|DUP` rows from weekly table.
8. Clear `临时标记 = batch_id|OK` on remaining weekly rows.

## Post-Run Validation

1. Weekly table contains new rows for `周区间 = target_week`.
2. Premium table received premium rows.
3. Duplicate-marked rows are absent in weekly table.
4. Source tables remain unchanged.
5. No unresolved unknown-color anomalies.

## Fixed Run Report Template

```text
【周汇总执行回执】
target_week: 2026-03-30~2026-04-05
batch_id: WEEKLY-RUN-20260330-20260405
source_channels: 渠道A, 渠道B
read_count_by_channel:
  渠道A: 32
  渠道B: 27
weekly_written_count: 59
premium_copied_count: 9
duplicate_deleted_count: 6
anomaly_count: 1
blocked_by_double_run: false
```

## Force Rerun Rule

If target week already exists in weekly table and rerun is needed:

1. Require explicit user confirmation text indicating force rerun.
2. Set `force_rerun = true` for that run only.
3. Keep full report and anomaly detail for audit.
