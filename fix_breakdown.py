path = r"d:/projects/nail-attribution-console-demo/output/weekly-review-dashboard/3.0/app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

old_right = "breakdown-right"

# The search terms for the old right side
search1 = 'breakdown-right"><div class="breakdown-mini-card">'
idx = content.find(search1)
if idx < 0:
    search1 = 'breakdown-right'
    idx = content.find(search1)

if idx >= 0:
    # Find the end of the right div
    snippet = content[idx:idx+500]
    # Find the closing </div></div> pattern
    end_idx = snippet.find('</div></div>:renderEmpty')
    if end_idx < 0:
        end_idx = snippet.find('</div></div>')

    if end_idx > 0:
        old_block = snippet[:end_idx + len('</div></div>')]
        new_block = r'''breakdown-right">
  <div class="breakdown-side-card">
    <div class="label">📌 最大贡献周</div>
    <div class="value">${escapeHtml(breakdown.rows[0]?.key || "暂无")} · ${breakdown.rows[0]?.exposure ? formatCompact(breakdown.rows[0].exposure) : "-"} · ${breakdown.rows[0]?.exposureShare ? formatPct(breakdown.rows[0].exposureShare) : "-"}</div>
    <div class="note">${breakdown.rows[0]?.key === matrix[0]?.key ? "本周发布帖子贡献最大，新帖表现强劲" : breakdown.rows[0]?.key === (matrix[1]?.key || "") ? "上周帖子正处于爆发峰值" : "历史帖子仍在持续释放曝光"}</div>
  </div>
  <div class="breakdown-side-card">
    <div class="label">📊 新老帖占比</div>
    <div class="mini-stacked-bar">
      <span class="seg-current" style="width:${((breakdown.rows.find(r=>r.key===matrix[0]?.key)?.exposureShare||0)*100).toFixed(1)}%"></span>
      <span class="seg-last" style="width:${((breakdown.rows.find(r=>r.key===matrix[1]?.key)?.exposureShare||0)*100).toFixed(1)}%"></span>
      <span class="seg-older" style="flex:1"></span>
    </div>
    <div class="mini-legend">
      <span><span style="display:inline-block;width:8px;height:8px;background:var(--blue);border-radius:2px;vertical-align:middle;"></span> 本周帖 ${breakdown.rows.find(r=>r.key===matrix[0]?.key)?.exposure ? formatCompact(breakdown.rows.find(r=>r.key===matrix[0]?.key).exposure) : "-"} · ${breakdown.rows.find(r=>r.key===matrix[0]?.key)?.exposureShare ? formatPct(breakdown.rows.find(r=>r.key===matrix[0]?.key).exposureShare) : "0%"}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:var(--green);border-radius:2px;vertical-align:middle;"></span> 上周帖 ${breakdown.rows.find(r=>r.key===matrix[1]?.key)?.exposure ? formatCompact(breakdown.rows.find(r=>r.key===matrix[1]?.key).exposure) : "-"} · ${breakdown.rows.find(r=>r.key===matrix[1]?.key)?.exposureShare ? formatPct(breakdown.rows.find(r=>r.key===matrix[1]?.key).exposureShare) : "0%"}</span>
      <span><span style="display:inline-block;width:8px;height:8px;background:var(--line);border-radius:2px;vertical-align:middle;"></span> 更早 ${(()=>{const c=(breakdown.rows.find(r=>r.key===matrix[0]?.key)?.exposureShare||0)+(breakdown.rows.find(r=>r.key===matrix[1]?.key)?.exposureShare||0);return formatPct(Math.max(0,1-c));})()}</span>
    </div>
  </div>
  <div class="breakdown-side-card">
    <div class="label">⚡ 数据成熟度</div>
    <div class="value">${matrix[0]?.maturityText || "0"} · ${typeof matrix[0]?.maturity === "number" ? formatPct(matrix[0].maturity) : "0%"}</div>
    <div class="note" style="color:var(--amber);">${matrix[0]?.maturity && matrix[0].maturity >= 1 ? "本周数据已跑满，进入第2周跟踪期。" : "本周帖子数据未跑满，下周继续跟踪。"}</div>
  </div>
</div'''

        content = content.replace(old_block, new_block)
        print(f"Replaced: {old_block[:80]}...")
    else:
        print("Could not find end of right div")
else:
    print("Could not find breakdown-right")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
