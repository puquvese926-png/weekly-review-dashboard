---
name: feishu-browser-mcp
description: "Use this skill when operating Feishu pages (docs/sheets/wiki) via browser MCP: stable login session control, reliable writing, persistent rich-text formatting in docs, structured spreadsheet editing, and troubleshooting (debugging disconnects, page load failures, Chinese mojibake). Use especially when the task requires writing into Feishu Sheets as real table rows/columns instead of prose-like single-cell text, or when Feishu doc formatting such as bold, headings, and colors must survive refresh."
---

# Feishu Browser MCP

## Overview

Use this skill to perform stable, repeatable Feishu web automation via browser MCP in Chinese workflows.

Always decide editing mode first:

1. `doc-mode`: prose blocks in Feishu docs/wiki pages.
2. `sheet-mode`: structured rows/columns in Feishu Sheets.

Never treat a spreadsheet like a document paragraph.

## Workflow

### 1. Bind to a fixed browser session

Always prefer a dedicated Chrome debugging session so login persists and actions are repeatable.

Recommended launch (Windows):

```powershell
& "C:\Users\HP\AppData\Local\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9333 `
  --remote-allow-origins=* `
  --user-data-dir="D:\codex\chrome-profile-9333"
```

Then:

1. Login to Feishu in that dedicated window once.
2. Reuse the same port/profile for later automation.
3. Avoid switching to temporary profiles during the task.

### 2. Open target URL and assert page state

After navigation, always check:

1. `location.href` is the expected Feishu URL.
2. `document.title` looks like a real doc title (not generic error page).
3. `document.body.innerText` does not contain login or no-permission hints.

If login/permission prompts appear, stop and ask user to finish the login/permission step in the same fixed session.

### 3. Identify editor type before writing

Detect whether the current page is a text editor or spreadsheet UI:

1. If there is a name box (`A1`, `B2`) and sheet toolbar (`筛选`, `插入`, `AI 写公式`), use `sheet-mode`.
2. Otherwise, use `doc-mode`.

### 4. Write safely in doc-mode

Preferred non-handoff path:

1. Find the bottom-most visible `text-editor` block from `[contenteditable="true"]`.
2. Focus that block.
3. Use `Selection + Range` to collapse caret to block end.
4. Send `Enter`, then `Input.insertText`.

If non-handoff path fails:

1. Ask user to manually place caret at target location.
2. Use handoff append only (`Input.insertText`) without re-positioning.

Always use idempotent logic:

1. Check marker already exists near tail before writing.
2. Append only when marker missing.

### 4.1 Apply persistent formatting in doc-mode

Use this order for Feishu docs:

1. Prefer real editor actions first:
   - headings via markdown-like conversion when Feishu supports it
   - bold via normal selection plus shortcut/toolbar action
   - color via the floating `颜色` submenu when the palette is stably exposed
2. Verify persistence with a refresh, not just by checking the live DOM before reload.
3. Treat "looks correct before reload" as insufficient evidence.

Working rules from real runs:

1. `加粗` and `标题` can persist through normal editor actions.
2. `颜色` is stricter than `加粗` and `标题`.
3. Do not write arbitrary CSS colors (`#hex`, inline style, ad-hoc DOM patch) and assume success.
4. If the page shows `已经保存到云端` but the color disappears after refresh, the change did not enter Feishu's document model.
5. For color, use Feishu's own text attribute path and Feishu-approved preset RGB values.

Read [references/doc-formatting.md](references/doc-formatting.md) before doing non-trivial doc formatting or when color persistence matters.

### 5. Write safely in sheet-mode (mandatory structure rules)

Apply these rules by default unless the user explicitly requests otherwise:

1. Define a table schema first:
   - one row = one record
   - one column = one field
   - row 1 = header
2. Build/write headers first, then rows.
3. Keep each point in its own cell; do not concatenate multiple fields into one cell.
4. Do not paste prose paragraphs into a single cell for comparison/reporting tasks.
5. Prefer matrix-style writing (`tab` between columns, new row per record).
6. Use a deterministic start cell (`A1` or user-specified location) from the name box.
7. For comparison tasks, default schema:
   - `模型 | 优势 | 局限 | 适用场景`
8. If table placement is not specified, append below existing header or use a new clean block starting at `A1` when sheet is empty.
9. Use a schema-confirmation gate before writing full data:
   - propose `sheet`, `startCell`, `headers`, `row count`
   - show a tiny sample (header + 1 row) in chat first
   - write full table only after user confirms structure
10. Choose schema rigidity by table lifetime:
   - `temporary table`: allow ad-hoc headers after quick confirmation
   - `long-term table`: prefer fixed canonical headers and stable column order
11. For long-term tables, enforce:
   - no silent header rename
   - no mixed meaning in one column
   - append new fields only after explicit confirmation

Default behavior for speed and quality:

1. `phase-1` (design): confirm table structure and placement.
2. `phase-2` (write): batch write after confirmation.

Useful finishing actions when appropriate:

1. Freeze header row.
2. Add filter to header row.
3. Keep text concise so rows remain scannable.

### 6. Verify and report

Return a compact result:

1. `ok`
2. `inserted` or `alreadyAtEnd`
3. `mode` (`doc-mode` or `sheet-mode`)
4. for sheets: `startCell`, `headerWritten`, `rowsWritten`
5. `hasMarker` / `hasChineseMark` (if marker strategy is used)
6. `hasSaved` (`已经保存到云端` or `已保存到云端`)
7. `hasWarn` (`本次操作可能不会保存` or `保存失败`)
8. `url` and `title`
9. optional `tail` for quick inspection

## Chinese Text Reliability Rules

When the task includes Chinese input/output, enforce all rules:

1. Set shell/runtime encoding to UTF-8 before running Python.
2. Prefer Unicode-safe payloads (JSON-escaped strings or `\u` escapes) for browser injection.
3. If environment encoding is unstable, construct Chinese text from Unicode code points in Python, then send with `Input.insertText`.
4. Distinguish terminal rendering issue from actual page corruption by checking marker existence in DOM text.
5. If mojibake is detected (`?? Codex...` or similar), remove corrupted fragment and reinsert proper Chinese text.

Practical note from real runs:

1. A write can be cloud-saved but still be mojibake if source text is already corrupted before insertion.
2. Validate both `hasSaved=true` and human-readable marker text.

## Failure Recovery

Use this order:

1. Reattach to existing target tab (same URL domain).
2. Retry once with same session.
3. If debugging channel is dead, confirm port endpoint health.
4. If still unstable, ask user to keep only one dedicated browser session and retry.

Do not repeatedly spawn new ad-hoc sessions during one edit task.

## Known Pitfalls

See detailed troubleshooting notes in:

- [references/doc-formatting.md](references/doc-formatting.md)
- [references/troubleshooting.md](references/troubleshooting.md)
- [references/table-authoring.md](references/table-authoring.md)
- [references/high-frequency-table-templates.md](references/high-frequency-table-templates.md)

This includes practical fixes for:

1. `ERR_CONNECTION_CLOSED` on Feishu URLs
2. WebSocket disconnects (`10053/10054`) and timeouts
3. Remote debugging port not ready
4. Chinese mojibake (`??`) caused by encoding path
5. writes that are saved but unreadable due to pre-insert encoding corruption
6. spreadsheet content mistakenly written into a single cell instead of row/column structure
7. document color appears correct in-session but is lost after refresh because the change only touched DOM, not Feishu's content-state attributes
