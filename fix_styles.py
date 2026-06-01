import re
path = r"d:/projects/nail-attribution-console-demo/output/weekly-review-dashboard/3.0/app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add card indicator classes (is-up/is-down/is-flat) to buildMetricCards
# Change the wowFoot to add class info
old_wow = """const wowFoot = (wow) => `<span style="color:${wowColor(wow)}">${arrow(wow)} ${formatPct(Math.abs(wow))}</span>`;"""
new_wow = """const wowFoot = (wow) => `<span style="color:${wowColor(wow)}">${arrow(wow)} ${formatPct(Math.abs(wow))}</span>`;
  const cardClass = (wow) => wow > 0.1 ? "is-up" : wow < -0.1 ? "is-down" : "is-flat";
  const cardWow = (label, value, wow) => `<div class="metric-card ${cardClass(wow)}"><strong>${typeof value === "number" ? formatCompact(value) : escapeHtml(String(value))}<span style="font-size:13px;">${wowFoot(wow)}</span></strong><p>${escapeHtml(label)}</p></div>`;"""
content = content.replace(old_wow, new_wow)

# Replace cohort cards to use cardWow
old_cohort_cards = 'return `<div class="metric-grid">${card("本周帖子数", curPosts, wowFoot(wowPosts))}${card("本周总曝光", curExp, wowFoot(wowExp))}${card("本周总互动", curInt, wowFoot(wowInt))}${card("本周互动率", formatPct(curRate), wowFoot(wowRate))}</div>`;'
new_cohort_cards = 'return `<div class="metric-grid">${cardWow("本周帖子数", curPosts, wowPosts)}${cardWow("本周总曝光", curExp, wowExp)}${cardWow("本周总互动", curInt, wowInt)}${cardWow("本周互动率", formatPct(curRate), wowRate)}</div>`;'
content = content.replace(old_cohort_cards, new_cohort_cards)

# 2. Add breakdown layout wrapper in renderCohort
old_breakdown = """<div class="week-breakdown">${breakdownHtml}</div>:renderEmpty("当前周期暂无可拆解曝光数据。")"""
new_breakdown = """<div class="breakdown-layout"><div class="breakdown-left"><div class="week-breakdown">${breakdownHtml}</div></div><div class="breakdown-right"><div class="breakdown-mini-card"><strong>${breakdown.rows[0]?.exposureShare ? formatPct(breakdown.rows[0].exposureShare) : "-"}</strong><p>最大贡献：${escapeHtml(breakdown.rows[0]?.key || "暂无")}</p></div><div class="breakdown-mini-card"><strong>${matrix[0]?.postCount ? formatInteger(matrix[0].postCount) + "帖" : "-"}</strong><p>本周发布 · 跑了 ${escapeHtml(matrix[0]?.maturityText || "0")}</p></div></div></div>:renderEmpty("当前周期暂无可拆解曝光数据。")"""
content = content.replace(old_breakdown, new_breakdown)

# 3. Remove gradient from narrative panel
content = content.replace('style="border-left:4px solid var(--blue);background:linear-gradient(90deg,#eff6ff 0%,#fff 30%);"', 'style="border-left:3px solid var(--blue);"')

# 4. Narrative line-height:2 -> line-height:1.8
content = content.replace('line-height:2;color:var(--ink);', 'line-height:1.8;color:var(--ink);')

# 5. Add debounce to owner search input in renderDetail
# Find the applyDetailFilters function call and wrap with debounce
old_filter_call = """if (action === "detail-filter") {
      const tableId = event.target.closest("[data-detail-table-id]")?.dataset.detailTableId;
      if (!tableId) return;
      applyDetailFilters(tableId);
      return;
    }"""
new_filter_call = """if (action === "detail-filter") {
      const tableId = event.target.closest("[data-detail-table-id]")?.dataset.detailTableId;
      if (!tableId) return;
      const el = event.target;
      if (el.matches("input[data-filter='owner']")) {
        clearTimeout(el._debounce);
        el._debounce = setTimeout(() => applyDetailFilters(tableId), 250);
      } else {
        applyDetailFilters(tableId);
      }
      return;
    }"""
content = content.replace(old_filter_call, new_filter_call)

# 6. Wrap table re-render in requestAnimationFrame in applyDetailFilters
old_raf = """if (tbody) {
      tbody.innerHTML = dataRows.length ? dataRows.map((row, index) => {"""
new_raf = """if (tbody) {
      requestAnimationFrame(() => {
      tbody.innerHTML = dataRows.length ? dataRows.map((row, index) => {"""
content = content.replace(old_raf, new_raf)

# Close the requestAnimationFrame after the tbody join
old_join = """).join("") || `<tr><td colspan="17">暂无数据</td></tr>`}</tbody>"""
new_join = """).join("") || `<tr><td colspan="17">暂无数据</td></tr>`}</tbody>})"""
content = content.replace(old_join, new_join)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
