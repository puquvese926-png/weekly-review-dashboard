# Feishu Browser MCP Troubleshooting

## 1) Feishu URL cannot open (`ERR_CONNECTION_CLOSED`)

Symptom:

- Browser control channel opens normal sites but Feishu URL fails immediately.

Checklist:

1. Confirm you are using the dedicated debug session (`--remote-debugging-port=9333`).
2. Confirm the user can open the same Feishu URL manually in that same browser window.
3. Retry by attaching to existing tab before creating new tab.

Fallback:

1. Keep user on manual login page.
2. Re-run automation only after user confirms page is visible in the dedicated session.

## 2) WebSocket connection drops (`10053`, `10054`, timeout)

Symptom:

- MCP operations fail mid-run with remote host closed/reset/timeout.

Checklist:

1. Reattach to the existing target tab and retry once.
2. Avoid opening many tabs during one run.
3. Avoid repeated restart loops across different debug ports/profiles.

Guideline:

- In one task, prefer one stable session over aggressive restart logic.

## 3) Remote debugging endpoint unavailable

Symptom:

- `http://127.0.0.1:9333/json/version` not reachable.

Checklist:

1. Verify Chrome process was launched with `--remote-debugging-port=9333`.
2. Ensure no conflicting session occupies unexpected profile/port.
3. Restart only the dedicated debug window, not all browser variants.

## 4) Text appears not saved across browsers

Symptom:

- Content appears in automation browser but not in other browser/device.

Common causes:

1. Input changed only front-end DOM but not Feishu editor transaction.
2. Caret was not inside the real text editor block.
3. Save warning state happened during input.

Fix:

1. Use non-handoff path: focus text-editor block + selection collapse to end + `Enter` + `Input.insertText`.
2. Confirm marker exists in body text.
3. Confirm no save warning text.
4. Confirm cloud-save text appears (`已经保存到云端` or `已保存到云端`).

## 5) Chinese text turns into `??` (mojibake)

Symptom:

- Input line is saved but displays as `????...`.

Root causes seen in practice:

1. Shell/heredoc encoding mismatch.
2. Text passing through non-UTF-8 path before browser insertion.
3. Terminal rendering confusion mistaken for document corruption.

Fix pattern:

1. Set `PYTHONIOENCODING=utf-8`.
2. Use JSON-escaped payload (`\uXXXX`) when uncertain.
3. For high reliability, build Chinese string from Unicode code points in Python source (ASCII-safe file) and send via `Input.insertText`.
4. Verify a readable Chinese marker in DOM, not only `hasSaved`.

Important:

- A write can be cloud-saved and still be mojibake if the source string was already corrupted.

## 6) Mojibake cleanup

Symptom:

- Old corrupted line remains in doc (for example `???????...Codex????`).

Cleanup strategy:

1. Target only the corrupted marker line.
2. Delete that line without touching nearby valid content.
3. Reinsert clean marker with Unicode-safe method.

## 7) Duplicate append on retries

Symptom:

- Same marker appears multiple times.

Prevention:

1. Check marker existence before append.
2. Use `alreadyAtEnd`/`inserted` style return fields.
3. Keep retries idempotent.

## 8) Minimal safe return payload

Return these fields after each write attempt:

1. `ok`
2. `inserted`
3. `alreadyAtEnd`
4. `hasMarker` / `hasChineseMark`
5. `hasSaved`
6. `hasWarn`
7. `url`
8. `title`

Optional:

- `tail` snippet for quick visual confirmation.

## 9) Spreadsheet content collapsed into one cell

Symptom:

- Comparison or list content appears as one long sentence in `A2`/`A3` instead of multiple columns.

Root causes:

1. Treated sheet editing like doc paragraph appending.
2. Wrote values with spaces only, without column boundaries.
3. Skipped table schema definition (headers + fields).

Fix:

1. Define columns first (for example `模型 | 优势 | 局限 | 适用场景`).
2. Rewrite rows using tab-separated fields.
3. Verify one full row across columns (`A2:D2`) before continuing bulk write.
4. Confirm saved state after rewrite.
