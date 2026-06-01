# Insert narrative sections and buildNarrative function into app.js
import re

path = r"d:/projects/nail-attribution-console-demo/output/weekly-review-dashboard/3.0/app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Insert buildNarrative function before renderWeekMeta
narrative_func = r'''
function buildNarrative(tabKey){
  const all = deriveForScope("all"), curExp = all.currentTotals.exposure, curInt = all.currentTotals.interaction, prevExp = all.previousTotals.exposure, prevInt = all.previousTotals.interaction;
  const wowExp = safeWoW(curExp, prevExp), wowInt = safeWoW(curInt, prevInt);
  const lines = [], green = "var(--green)", red = "var(--red)", amber = "var(--amber)";

  if (tabKey === "cohort") {
    const breakdown = buildWeekBreakdown(all.poolPosts, reviewWindow.start, reviewWindow.end);
    const topWeek = breakdown.rows[0] || {};
    lines.push(`本周总曝光 ${formatCompact(curExp)}，环比${wowExp > 0 ? "增长" : wowExp < 0 ? "下降" : "持平"} ${formatPct(Math.abs(wowExp))}。${Math.abs(wowExp) > 0.1 ? (wowExp > 0 ? "涨幅超10%，表现强势。" : "跌幅超10%，需要关注。") : "变化在正常范围内。"}`);
    if (topWeek.exposureShare > 0.3) lines.push(`${topWeek.key || "最新发布周"} 贡献了本周 ${formatPct(topWeek.exposureShare)} 的曝光，是本周最大的曝光来源。`);
    const allPosts = preprocessPosts(source.posts || []);
    const matrix = buildCohortMatrix(allPosts, reviewWindow.end);
    if (matrix.length >= 2 && matrix[0].weeks && matrix[1].weeks) {
      const curW1 = matrix[0].weeks[0]?.exposure || 0, prevW1 = matrix[1].weeks[0]?.exposure || 0;
      if (curW1 > 0 && prevW1 > 0) {
        const cmp = safeWoW(curW1, prevW1);
        lines.push(`本周发布帖子首周曝光 ${formatCompact(curW1)}，比上周同期 ${cmp > 0 ? "高" : "低"} ${formatPct(Math.abs(cmp))}。`);
      }
    }
    const rows = [...matrix].reverse();
    for (let ri = 1; ri < rows.length; ri++) {
      if ((rows[ri]?.cumulativeExposure || 0) > (rows[ri - 1]?.cumulativeExposure || 0)) {
        lines.push(`${rows[ri].key} 累计曝光反超 ${rows[ri - 1].key}，该周帖子存在衰减异常。`);
        break;
      }
    }
  }

  else if (tabKey === "channel") {
    const allCh = buildChannelRows(all.poolPosts, all.currentTotals);
    const prevCh = buildChannelRows(all.poolPosts, all.previousTotals);
    const withWow = allCh.map(ch => ({ ...ch, wow: safeWoW(ch.exposure, prevCh.find(p => p.label === ch.label)?.exposure || 0) })).sort((a, b) => b.wow - a.wow);
    const bestCh = withWow[0], worstCh = withWow[withWow.length - 1];
    if (bestCh && bestCh.wow > 0.1) lines.push(`${bestCh.label} 曝光环比增长 ${formatPct(bestCh.wow)}，涨幅最大。`);
    if (worstCh && worstCh.wow < -0.1) lines.push(`${worstCh.label} 曝光环比下降 ${formatPct(Math.abs(worstCh.wow))}，跌幅最大。`);
    const mismatch = allCh.find(ch => Math.abs(safeRate(ch.exposure, curExp) - safeRate(ch.interaction, curInt)) > 0.15);
    if (mismatch) lines.push(`${mismatch.label} 曝光占比 ${formatPct(safeRate(mismatch.exposure, curExp))} 与互动占比 ${formatPct(safeRate(mismatch.interaction, curInt))} 存在明显错位，曝光和互动不在同一渠道。`);
  }

  else if (tabKey === "ranking") {
    const top5 = all.poolPosts.map(p => ({ ...p, m: diffMetrics(p, reviewWindow.start, reviewWindow.end) })).sort((a, b) => b.m.exposure - a.m.exposure).slice(0, 5);
    const top5Share = safeRate(sum(top5, p => p.m.exposure), curExp);
    lines.push(top5Share < 0.3 ? `Top 5 帖子合计占曝光 ${formatPct(top5Share)}，头部不集中，没有单帖爆款。` : `Top 5 帖子合计占曝光 ${formatPct(top5Share)}，头部集中度较高。`);
    const quality = all.poolPosts.filter(p => (asText(p.featuredQuality) === "1.0" || asText(p.featuredQuality) === "1")).length;
    lines.push(`本周优质内容 ${formatInteger(quality)} 条。`);
    const pl = deriveProductLineRows(all.poolPosts);
    if (pl.length) {
      const bestPL = [...pl].sort((a, b) => b.interactionRate - a.interactionRate)[0];
      const maxExpPL = [...pl].sort((a, b) => b.exposure - a.exposure)[0];
      lines.push(`${bestPL.label} 互动率最高（${formatPct(bestPL.interactionRate)}）${bestPL.label !== maxExpPL?.label ? "，" + maxExpPL?.label + " 曝光最大但互动率仅 " + formatPct(maxExpPL?.interactionRate || 0) : "，同时也是曝光最大的品线"}。`);
    }
  }

  else if (tabKey === "detail") {
    const audit = state.importAudit;
    if (audit) {
      lines.push(`导入 ${formatInteger(audit.totalRows)} 行，有效 ${formatInteger(audit.acceptedRows)} 行，跳过 ${formatInteger(audit.totalRows - audit.acceptedRows)} 行。`);
      const mf = [];
      if (audit.missingRequired?.publishDate) mf.push(`发布时间${formatInteger(audit.missingRequired.publishDate)}行`);
      if (audit.missingRequired?.statDate) mf.push(`统计日期${formatInteger(audit.missingRequired.statDate)}行`);
      if (audit.missingRecommended?.owner) mf.push(`负责人${formatInteger(audit.missingRecommended.owner)}行`);
      if (audit.missingRecommended?.link) mf.push(`链接${formatInteger(audit.missingRecommended.link)}行`);
      if (mf.length) lines.push(`缺失最多：${mf.slice(0, 3).join("、")}。`);
      if (audit.statDateRange) lines.push(`数据跨度 ${audit.statDateRange}。${audit.duplicateLinks ? "重复链接 " + formatInteger(audit.duplicateLinks) + " 条。" : ""}`);
    } else {
      lines.push("当前为内置样例数据，导入 Excel 后显示真实数据质量摘要。");
    }
  }

  if (!lines.length) return "";
  return `<section class="panel" style="border-left:4px solid var(--blue);background:linear-gradient(90deg,#eff6ff 0%,#fff 30%);">
    <div class="panel-head"><div class="panel-title"><h3>本周综述</h3><p>程序自动生成的事实汇总，不解释原因。</p></div></div>
    <div style="font-size:13px;line-height:2;color:var(--ink);">${lines.map((l, i) => `<p style="margin:2px 0;">${i + 1}. ${l}</p>`).join("")}</div>
  </section>`;
}
'''
content = content.replace("function renderWeekMeta(", narrative_func + "\nfunction renderWeekMeta(")

# 2. Insert narrative into 4 render functions
# renderCohort: before first <section
cohort_start = "return `<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>本周总曝光拆解"
content = content.replace(cohort_start, "return `${buildNarrative(\"cohort\")}<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>本周总曝光拆解")

# renderChannelDiagnosis: before first <section
channel_start = "return `<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>渠道热力图"
content = content.replace(channel_start, "return `${buildNarrative(\"channel\")}<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>渠道热力图")

# renderRanking: before first <section
ranking_start = "return `<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>内容排行榜"
content = content.replace(ranking_start, "return `${buildNarrative(\"ranking\")}<section class=\"panel\"><div class=\"panel-head\"><div class=\"panel-title\"><h3>内容排行榜")

# renderDetail: before first <section
detail_start = "return `<section class=\"panel\" data-detail-table-id"
content = content.replace(detail_start, "return `${buildNarrative(\"detail\")}<section class=\"panel\" data-detail-table-id")

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("Done")
