# Doc Formatting

Use this reference when formatting Feishu docs via browser MCP and the result must survive refresh.

## Goal

Make formatting persistent in Feishu's document model, not just visually correct in the current session.

## Validation Standard

A formatting change is only considered successful when all checks pass:

1. The page shows `已经保存到云端` or `已保存到云端`.
2. Reload the document.
3. Re-find the target text.
4. Confirm the expected structure/class/computed style is still present after reload.

If the effect disappears after reload, treat it as failure even if it looked correct before reload.

## Reliable Findings

### Bold

1. Normal selection plus Feishu's own bold action can persist.
2. Recheck after refresh.

### Heading

1. Real heading conversion can persist.
2. Verify both the block structure and, when relevant, outline/catalog appearance.

### Text Color

Text color is the fragile case.

Do not rely on:

1. `style=\"color: ...\"` DOM patches
2. arbitrary `#hex` values
3. ad-hoc DOM click hacks without post-refresh verification

These can produce a false success: the text changes color in-session, Feishu shows cloud-save, but the color disappears after reload.

## Color Persistence Strategy

### Preferred path

1. Select the exact text range.
2. Try the real floating toolbar path first:
   - open text toolbar
   - open `颜色`
   - choose a text color swatch
3. If the palette is not stably clickable through MCP, use Feishu's own content-state attribute path instead of raw DOM style mutation.

### Attribute key

For text color, the relevant inline attribute is:

```text
textHighlight
```

### Accepted values

`textHighlight` does not reliably accept:

1. `red`
2. `#D4380D`
3. arbitrary CSS color strings

It does accept Feishu preset RGB strings. Verified examples:

1. default: `""`
2. gray: `rgb(143,149,158)`
3. red: `rgb(216,57,49)`
4. orange: `rgb(222,120,2)`
5. yellow: `rgb(220,155,4)`
6. green: `rgb(46,161,33)`
7. blue: `rgb(36,91,219)`
8. purple: `rgb(100,37,208)`

Using an unsupported value can corrupt the block and trigger `正文加载错误`.

## Browser-Side Inspection Hints

Useful signals in real runs:

1. Selected text can expose the floating toolbar as `.docx-menu-wrapper.text-toolbar`.
2. The color submenu can appear under `[data-name=\"highlight submenu\"]`.
3. The visible palette labels can include `字体颜色`, `背景颜色`, and `恢复默认`.

If the visible UI path is unstable, inspect the current span after applying color:

1. `className` should include `textHighlight`.
2. `getComputedStyle(span).color` should match the chosen preset RGB.
3. After reload, the color class should still be present.

Example persistent red class from a verified run:

```text
textHighlight textHighlight-pink-text textHighlight-ccmtoken-doc-textcolor-red
```

## Implementation Notes

When interacting with Feishu internals, prefer Feishu's editor/content-state interfaces over direct DOM mutation.

Observed behaviors from real runs:

1. `setAttributes(range, { textHighlight: 'rgb(216,57,49)' })` persisted color when applied to the selected range.
2. `setAttributes(range, { textHighlight: '#D4380D' })` caused load errors.
3. `execCommand('textHighlight', { color: '#D4380D' })` did not supply a valid persisted color value.

Therefore:

1. Use Feishu's native UI path when it is stably controllable.
2. Otherwise, use Feishu's own inline attribute mechanism with a validated preset RGB string.
3. Never treat raw CSS color injection as a durable solution.

## Suggested Operating Sequence

1. Create or locate a dedicated test line.
2. Apply one formatting change at a time.
3. Wait for save confirmation.
4. Reload immediately.
5. Re-check text, structure, class, and computed style.
6. Only then report success.
