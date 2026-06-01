# Feishu Table Authoring Guide

## Purpose

Use this guide when writing into Feishu Sheets through browser automation.

Goal: make outputs truly tabular, readable, and analyzable.

## Core Principles

1. Treat rows as records, columns as fields.
2. Write headers first.
3. Keep each field independent in its own cell.
4. Use short phrases, not paragraph blocks.
5. Make the table usable for filtering, sorting, and pivot analysis.

## Temporary vs Long-Term Tables

### Temporary table (one-off or short-cycle)

Strategy:

1. Keep setup light and fast.
2. Confirm only `sheet + startCell + headers + overwrite/append`.
3. Allow scenario-specific ad-hoc fields.

Guardrails:

1. Still keep row/column structure.
2. Do not collapse multiple fields into one cell.

### Long-term table (reused weekly/monthly/quarterly)

Strategy:

1. Lock canonical headers and column order.
2. Keep a stable metric/field dictionary.
3. Prefer append-only updates to avoid history corruption.

Guardrails:

1. Do not rename or repurpose existing columns silently.
2. Add new fields only after schema confirmation.
3. Keep key columns (`ID`, `日期`, `负责人`, `状态`) stable.

Reference:

1. [high-frequency-table-templates.md](high-frequency-table-templates.md)

## Table vs Document

A spreadsheet is for structured data operations.
A document is for narrative explanation.

If users ask for "comparison", "list", "台账", "指标看板", or "统计", choose spreadsheet structure first.

Anti-pattern:

1. Putting "model + pros + cons + scenarios" in one cell.

Correct pattern:

1. One column per field (`模型`, `优势`, `局限`, `适用场景`).
2. One row per model.

## Default Layout Templates

### 1) Comparison table

Use when comparing products, vendors, or solutions.

Columns:

1. `对象/模型`
2. `优势`
3. `局限`
4. `适用场景`
5. `备注` (optional)

### 2) Tracking table

Use for work items or issue lists.

Columns:

1. `ID`
2. `事项`
3. `负责人`
4. `状态`
5. `优先级`
6. `截止日期`
7. `风险`

### 3) KPI table

Use for metric review.

Columns:

1. `指标`
2. `口径定义`
3. `当前值`
4. `目标值`
5. `环比/同比`
6. `责任人`
7. `行动项`

For high-frequency production patterns, use:

1. [high-frequency-table-templates.md](high-frequency-table-templates.md)

## Writing Procedure (Browser MCP)

### Two-phase commit (recommended)

1. Phase 1 - Structure confirmation:
   - propose table headers, start cell, and expected row count.
   - provide a preview table (header + one sample row).
   - wait for confirmation.
2. Phase 2 - Data write:
   - clear target range when replacement is requested.
   - write full dataset after structure is locked.
   - verify saved status.

Why:

1. Avoid slow rewrite loops.
2. Catch header/scope mistakes early.
3. Keep edits predictable for collaborative documents.

### Execution sequence

1. Confirm start cell from name box (`A1` by default).
2. Write header row first.
3. Write data row by row.
4. Use tab-separated cells per row.
5. Move to next row after each record.
6. Avoid line breaks inside a cell unless explicitly requested.
7. Re-check active cell and visible row content after writing.

## Quality Checklist

1. Header exists and is complete.
2. Same column contains same data type (text/number/date).
3. No merged cells in core data region.
4. No paragraph-style prose inside data cells.
5. Required fields are not empty.
6. Saved status shows cloud sync.

## Practical Feishu Sheet Techniques

1. Freeze first row to keep headers visible during scroll.
2. Enable filter on header row for quick slicing.
3. Use data validation (dropdown) for `状态`, `优先级`, `类型`.
4. Use conditional formatting for risk/state highlights.
5. Use pivot tables for summarized views.
6. Use protected ranges for formula columns.
7. Use separate "raw" and "summary" sheets for maintainability.

## Office Tool Strengths (Choose Correct Surface)

### Feishu Docs / Wiki

Strength:

1. Narrative writing and explanation.
2. Rich text collaboration and commentary.

Not ideal for:

1. High-volume structured data entry.
2. Aggregation-heavy analysis.

### Feishu Sheets

Strength:

1. Row/column structured tabular workflows.
2. Formula, sorting, filtering, and pivot analysis.
3. Lightweight operations dashboards.

### Feishu Bitable (多维表格)

Strength:

1. Database-like business objects with richer field types.
2. Multiple views (grid, kanban, form, dashboard).
3. Workflow automation and permission granularity.

Use when data model and process orchestration are more important than spreadsheet formulas.

### Excel

Strength:

1. Deep modeling and advanced formulas.
2. Heavy offline computation and large workbook ecosystems.

## Failure Patterns and Fixes

Pattern: all fields collapsed into one cell.

Fix:

1. Clear the wrong range.
2. Rewrite with explicit headers and per-column values.
3. Validate at least one full row by reading across columns (`A2:D2` style).
