---
name: feishu-weekly-post-rollup
description: "Use this skill for Feishu web weekly post rollups: read multiple source tables, filter by publish date for the target week (default current week minus two), normalize to weekly schema, split by background-color semantics (premium/duplicate), write to weekly and premium tables, delete duplicate-marked rows only in weekly table, and return a fixed run report with double-run protection."
---

# Feishu Weekly Post Rollup

## Overview

Use this skill when the user asks to aggregate post data from multiple Feishu web tables into a weekly summary table.

This skill is designed for operations workflows with:

1. Multiple channel source tables
2. Slightly different source headers
3. Background-color-based semantics (premium, duplicate)
4. Weekly rollup with one run per week

## Required Inputs

Before execution, collect or confirm these inputs:

1. `source_tables`: list of channel names and source table URLs
2. `weekly_table`: weekly summary table URL
3. `premium_table`: premium content table URL
4. `publish_date_field`: publish date column name in each source table
5. `weekly_schema`: target columns in weekly table (authoritative schema)
6. `channel_field_mapping`: per-channel mapping from source columns to `weekly_schema`
7. `channel_color_map`: per-channel background color semantics
8. `force_rerun`: default `false`; only `true` when user explicitly asks for force rerun

Use the template in [references/config-template.md](references/config-template.md).

## Week Window Rule

Default target week is the natural week two weeks before current week:

1. Find current week Monday to Sunday
2. Shift back by 14 days
3. Use shifted Monday 00:00 to Sunday 23:59

Example:

1. Run date `2026-04-17` (week `2026-04-13` to `2026-04-19`)
2. Target week becomes `2026-03-30` to `2026-04-05`

If user provides an explicit week range, use it as override.

## Table Contract

Treat weekly table headers as authoritative. Source-specific extra columns must not enter weekly table.

Weekly table helper columns (create once if missing):

1. `周区间` (e.g., `2026-03-30~2026-04-05`)
2. `汇总批次` (e.g., `WEEKLY-RUN-20260330-20260405`)
3. `临时标记` (ephemeral values during current run)

Do not edit source tables.

## Execution Workflow

### 1. Preflight

1. Ensure user is logged in and has read/write permissions
2. Validate all required inputs are present
3. Open weekly table and ensure helper columns exist

### 2. Double-Run Protection

1. Build `week_label` and `batch_id`
2. Check weekly table for any row where `周区间 == week_label` and `汇总批次` is non-empty
3. If found and `force_rerun == false`, stop and return a blocked report
4. Continue only when no prior run exists or user explicitly requests force rerun

### 3. Extract and Normalize

For each source table:

1. Read rows where `publish_date_field` falls in target week
2. Map fields to `weekly_schema` using `channel_field_mapping`
3. Drop non-schema columns
4. Fill missing schema fields with empty values
5. Attach metadata:
   `周区间 = week_label`
   `汇总批次 = batch_id`
   `来源渠道 = channel_name` (if present in weekly schema)

### 4. Color Semantics (Background Only)

Use background color only. For each candidate row:

1. Resolve row semantic from `channel_color_map`:
   `premium` / `duplicate` / `normal`
2. If semantic is unknown, move row to anomaly list (do not write silently)
3. Set `临时标记`:
   `batch_id|OK` for normal/premium
   `batch_id|DUP` for duplicate

### 5. Write, Split, Delete

1. Append all normalized rows (including duplicate-marked rows) to weekly table
2. Copy `premium` rows to premium table (weekly table keeps them)
3. In weekly table, delete rows where `临时标记 == batch_id|DUP`
4. Clear `临时标记` for remaining `batch_id|OK` rows

Delete operation scope is weekly table only.

### 6. Report

Return a fixed summary:

1. `target_week`
2. `batch_id`
3. `source_channels`
4. `read_count_by_channel`
5. `weekly_written_count`
6. `premium_copied_count`
7. `duplicate_deleted_count`
8. `anomaly_count`
9. `blocked_by_double_run` (`true/false`)

Use the output format in [references/ops-checklist.md](references/ops-checklist.md).

## Failure Handling

1. If a source table is inaccessible, continue other channels and record anomaly
2. If a required mapped field is missing in one channel, record anomaly and skip that row
3. If weekly table write fails, stop and report partial progress
4. If deletion fails, keep `临时标记` as recovery anchor and report failure immediately

## Trigger Examples

This skill should trigger on requests like:

1. "按上上周汇总多个渠道帖子到周表"
2. "把本周要统计的目标周帖子汇总并分流优质内容"
3. "跑一次多渠道帖子周汇总，重复色先入后删"
