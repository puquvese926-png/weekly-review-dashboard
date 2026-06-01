(function(){
  const initialSource = window.WeeklyReviewMockData;
  if (!initialSource) throw new Error("Weekly review mock data is missing.");
  let source = cloneData(initialSource);

  const DAY_MS = 24 * 60 * 60 * 1000;
  const CHANNEL_SCOPE_OPTIONS = [
    { key: "all", label: "总体" },
    { key: "社媒", label: "社媒" },
    { key: "社群", label: "社群" },
    { key: "KOL", label: "KOL" }
  ];
  const PLATFORM_ALL_OPTION = { key: "all", label: "全部平台" };
  const GRANULARITY_OPTIONS = [
    { key: "day", label: "天" },
    { key: "week", label: "周" }
  ];
  const REVIEW_PERIOD_OPTIONS = [
    { key: "7", label: "近 7 天", days: 7 },
    { key: "14", label: "近 14 天", days: 14 },
    { key: "30", label: "近 30 天", days: 30 }
  ];
  const VIEW_OPTIONS = [
    { key: "overview", label: "总览" },
    { key: "lifecycle", label: "生命周期" },
    { key: "channel", label: "渠道" },
    { key: "content", label: "内容" },
    { key: "offsite", label: "站外" },
    { key: "voice", label: "声量" }
  ];
  const THEME_OPTIONS = [
    { key: "atlantic", label: "墨蓝" },
    { key: "rose", label: "粉釉" },
    { key: "jade", label: "青瓷" },
    { key: "amber", label: "鎏金" }
  ];
  const DONUT_COLORS = ["#2f607c", "#6f93aa", "#238672", "#9ab0bf", "#b98231", "#c65e54"];
  const MONTHLY_GOAL_STORAGE_KEY = "weekly-review-dashboard.monthly-goal-exposure-target";
  const THEME_STORAGE_KEY = "weekly-review-dashboard.v2.theme";
  const REVIEW_END_STORAGE_KEY = "weekly-review-dashboard.v2.review-end";
  const REVIEW_PERIOD_STORAGE_KEY = "weekly-review-dashboard.v2.review-period";

  const state = { scope: "all", platform: "all", granularity: "day", view: "overview", theme: "atlantic", reviewEndDate: "", reviewPeriodDays: 7 };
  let dataSourceLabel = "内置数据";

  const dom = {
    tabStrip: document.getElementById("tab-strip"),
    heroMeta: document.getElementById("hero-meta"),
    reviewEndInput: document.getElementById("review-end-date"),
    reviewPeriodSelect: document.getElementById("review-period-select"),
    scopeSelect: document.getElementById("scope-select"),
    platformSelect: document.getElementById("platform-select"),
    granularityToggle: document.getElementById("granularity-toggle"),
    themeToggle: document.getElementById("theme-toggle"),
    controlNote: document.getElementById("control-note"),
    importBtn: document.getElementById("import-data-btn"),
    resetBtn: document.getElementById("reset-data-btn"),
    importInput: document.getElementById("import-file-input"),
    importStatus: document.getElementById("import-status"),
    goalWidget: document.getElementById("goal-widget"),
    metricGrid: document.getElementById("metric-grid"),
    insightGrid: document.getElementById("insight-grid"),
    lifecycleStack: document.getElementById("lifecycle-stack"),
    lifecycleTable: document.getElementById("lifecycle-table"),
    lifecycleKpis: document.getElementById("lifecycle-kpis"),
    channelMatrix: document.getElementById("channel-matrix"),
    channelTable: document.getElementById("channel-table"),
    channelKpis: document.getElementById("channel-kpis"),
    contentPanels: document.getElementById("content-panels"),
    contentKpis: document.getElementById("content-kpis"),
    contentTable: document.getElementById("content-table"),
    offsiteKpis: document.getElementById("offsite-kpis"),
    dtcSummary: document.getElementById("dtc-summary"),
    dtcTable: document.getElementById("dtc-table"),
    voiceKpis: document.getElementById("voice-kpis"),
    brandVoice: document.getElementById("brand-voice"),
    tooltip: document.getElementById("tooltip")
  };

  let reviewWindow;
  let previousWindow;
  let poolWindow;
  let previousPoolWindow;
  let posts;
  let poolPosts;
  recomputeBaseWindows();
  initMonthlyGoalTarget();
  initTheme();
  initReviewPeriod();
  initReviewEndDate();

  bindTooltip();
  bindTabs();
  bindTimeControls();
  bindDataImport();
  setImportStatus("内置数据");
  render();

  function render(){
    const filteredPosts = filterPostsByScope(poolPosts, state.scope, state.platform);
    const derived = buildDerived(filteredPosts);
    renderViewState();
    renderHero();
    renderControls();
    renderGoalWidget(derived);
    renderMetrics(derived);
    renderInsights(derived);
    renderLifecycle(derived);
    renderLifecycleKpis(derived);
    renderLifecycleTable(derived);
    renderChannelKpis(derived);
    renderChannelMatrix(derived);
    renderChannelTable(derived);
    renderContentKpis(derived);
    renderContentPanels(derived);
    renderContentTable(derived);
    renderOffsiteKpis();
    renderDtcSection();
    renderVoiceKpis();
    renderBrandVoice();
  }

  function recomputeBaseWindows(){
    const sourceWindow = parseReviewWindow(source.reviewWeek.dateRange);
    const selectedEnd = state.reviewEndDate ? parseDate(state.reviewEndDate) : sourceWindow.end;
    const safeEnd = Number.isNaN(selectedEnd.getTime()) ? sourceWindow.end : selectedEnd;
    const spanDays = Math.max(1, Number(state.reviewPeriodDays || 7));
    reviewWindow = { start: addDays(safeEnd, -(spanDays - 1)), end: safeEnd };
    previousWindow = { start: addDays(reviewWindow.start, -spanDays), end: addDays(reviewWindow.end, -spanDays) };
    poolWindow = { start: addDays(reviewWindow.end, -29), end: reviewWindow.end };
    previousPoolWindow = { start: addDays(poolWindow.start, -30), end: addDays(poolWindow.end, -30) };
    posts = preprocessPosts(source.posts || []);
    poolPosts = posts.filter(post => inDateRange(post.publishDateObj, poolWindow.start, poolWindow.end));
  }

  function buildDerived(filteredPosts){
    const currentTotals = sumPostsForRange(filteredPosts, reviewWindow.start, reviewWindow.end);
    const previousTotals = sumPostsForRange(filteredPosts, previousWindow.start, previousWindow.end);
    const currentPostCount = countPostsForRange(filteredPosts, reviewWindow.start, reviewWindow.end);
    const previousPostCount = countPostsForRange(filteredPosts, previousWindow.start, previousWindow.end);
    const monthStart = new Date(reviewWindow.end.getFullYear(), reviewWindow.end.getMonth(), 1);
    const monthToDateTotals = sumPostsForRange(filteredPosts, monthStart, reviewWindow.end);
    const channelRows = buildChannelRows(filteredPosts, currentTotals);
    const channelContributionRows = buildChannelContributionRows(filteredPosts, currentTotals);
    const batchRows = buildBatchRows(filteredPosts, currentTotals, previousTotals);
    const contentItems = buildContentItems(filteredPosts, currentTotals);
    return {
      filteredPosts,
      currentTotals,
      previousTotals,
      currentPostCount,
      previousPostCount,
      monthToDateExposure: monthToDateTotals.exposure,
      currentRate: safeRate(currentTotals.interaction, currentTotals.exposure),
      previousRate: safeRate(previousTotals.interaction, previousTotals.exposure),
      channelRows,
      channelContributionRows,
      batchRows,
      contentItems,
      lineSeries: buildLineSeries(filteredPosts, state.granularity),
      exposureDonutRows: buildContributionRows(channelContributionRows, "exposure", currentTotals.exposure),
      interactionDonutRows: buildContributionRows(channelContributionRows, "interaction", currentTotals.interaction),
      batchExposureDonutRows: buildContributionRows(batchRows, "currentExposure", currentTotals.exposure),
      batchInteractionDonutRows: buildContributionRows(batchRows, "currentInteraction", currentTotals.interaction)
    };
  }

  function renderGoalWidget(derived){
    if (!dom.goalWidget) return;
    const target = Math.max(0, asNumber(source.monthlyGoal?.exposureTarget));
    const actual = Math.max(0, asNumber(derived.monthToDateExposure));
    const rawProgress = target > 0 ? (actual / target) : 0;
    const barProgress = Math.min(1, Math.max(0, rawProgress));
    const progressClass = rawProgress >= 1 ? "is-complete" : (rawProgress >= 0.7 ? "is-good" : "is-normal");
    dom.goalWidget.innerHTML = `
      <div class="goal-row">
        <div class="goal-title">月目标</div>
        <div class="goal-progress-wrap">
          <div class="goal-progress" aria-label="月目标进度条">
            <div class="goal-progress-bar ${progressClass}" style="width:${(barProgress * 100).toFixed(1)}%"></div>
          </div>
        </div>
        <div class="goal-summary">
          <strong>${formatCompact(actual)}</strong>
          <span>/ ${formatCompact(target)} · ${formatPct(rawProgress)}</span>
        </div>
        <div class="goal-edit">
          <span class="goal-edit-prefix">目标</span>
        <input class="goal-input" id="goal-input" type="text" inputmode="numeric" value="${escapeHtml(formatInteger(target))}" aria-label="编辑月目标曝光">
          <button class="goal-save" id="goal-save-btn" type="button">更新</button>
        </div>
      </div>
    `;
    const goalInput = dom.goalWidget.querySelector("#goal-input");
    const saveBtn = dom.goalWidget.querySelector("#goal-save-btn");
    if (saveBtn && goalInput) {
      saveBtn.addEventListener("click", () => applyGoalInput(goalInput.value));
      goalInput.addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyGoalInput(goalInput.value);
        }
      });
    }
  }

  function applyGoalInput(rawValue){
    const numeric = Math.max(0, Math.round(asNumber(String(rawValue).replace(/,/g, ""))));
    if (!source.monthlyGoal) source.monthlyGoal = {};
    source.monthlyGoal.exposureTarget = numeric;
    saveMonthlyGoalTarget(numeric);
    render();
  }

  function initMonthlyGoalTarget(){
    const stored = loadMonthlyGoalTarget();
    if (stored === null) return;
    if (!source.monthlyGoal) source.monthlyGoal = {};
    source.monthlyGoal.exposureTarget = stored;
  }

  function loadMonthlyGoalTarget(){
    try {
      const raw = localStorage.getItem(MONTHLY_GOAL_STORAGE_KEY);
      if (raw === null) return null;
      const numeric = Math.max(0, Math.round(asNumber(raw)));
      return Number.isFinite(numeric) ? numeric : null;
    } catch (error) {
      return null;
    }
  }

  function saveMonthlyGoalTarget(value){
    try {
      localStorage.setItem(MONTHLY_GOAL_STORAGE_KEY, String(Math.max(0, Math.round(asNumber(value)))));
    } catch (error) {
      // ignore storage errors
    }
  }

  function initTheme(){
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored && THEME_OPTIONS.some(option => option.key === stored)) state.theme = stored;
    } catch (error) {
      // ignore storage errors
    }
    applyTheme();
  }

  function applyTheme(){
    document.body.dataset.theme = state.theme;
  }

  function initReviewEndDate(){
    try {
      const stored = localStorage.getItem(REVIEW_END_STORAGE_KEY);
      if (stored && !Number.isNaN(parseDate(stored).getTime())) {
        state.reviewEndDate = stored;
        recomputeBaseWindows();
      }
    } catch (error) {
      // ignore storage errors
    }
  }

  function initReviewPeriod(){
    try {
      const stored = localStorage.getItem(REVIEW_PERIOD_STORAGE_KEY);
      const candidate = Number(stored);
      if (REVIEW_PERIOD_OPTIONS.some(option => option.days === candidate)) {
        state.reviewPeriodDays = candidate;
      }
    } catch (error) {
      // ignore storage errors
    }
  }

  function saveReviewEndDate(value){
    try {
      if (value) localStorage.setItem(REVIEW_END_STORAGE_KEY, value);
      else localStorage.removeItem(REVIEW_END_STORAGE_KEY);
    } catch (error) {
      // ignore storage errors
    }
  }

  function saveTheme(value){
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (error) {
      // ignore storage errors
    }
  }

  function saveReviewPeriod(days){
    try {
      localStorage.setItem(REVIEW_PERIOD_STORAGE_KEY, String(Math.max(1, Number(days || 7))));
    } catch (error) {
      // ignore storage errors
    }
  }

  function preprocessPosts(rawPosts){
    return rawPosts.map(post => {
      const snapshots = [...(post.snapshots || [])]
        .map(snapshot => ({
          ...snapshot,
          dateObj: parseDate(snapshot.capturedAt),
          interaction: metricInteraction(snapshot)
        }))
        .sort((a, b) => a.dateObj - b.dateObj);
      return {
        ...post,
        publishDateObj: parseDate(post.publishDate),
        snapshots,
        displayChannelName: canonicalChannelName(post.channelName || post.platform),
        normalizedTopic: normalizeDimension(post.contentTopic),
        normalizedFormat: normalizeContentFormat(post.contentFormat)
      };
    });
  }

  function renderViewState(){
    document.body.dataset.view = state.view;
    document.querySelectorAll("[data-view-panel]").forEach(panel => {
      panel.classList.toggle("is-active", panel.dataset.viewPanel === state.view);
    });
    if (dom.tabStrip) {
      dom.tabStrip.querySelectorAll(".tab-item").forEach(button => {
        button.classList.toggle("is-active", button.dataset.view === state.view);
      });
    }
  }

  function renderHero(){
    const generatedDate = toDateString(source.generatedAt) || asText(source.generatedAt) || formatDate(new Date());
    dom.heroMeta.innerHTML = [
      heroMetaCard("复盘周期", `${formatDate(reviewWindow.start)}~${formatDate(reviewWindow.end)}`),
      heroMetaCard("样本池", `${formatDate(poolWindow.start)}~${formatDate(poolWindow.end)} 发布`),
      heroMetaCard("数据时间", `${generatedDate} · ${dataSourceLabel}`)
    ].join("");
  }

  function renderControls(){
    renderTimeControl();
    renderSelectControl(dom.scopeSelect, CHANNEL_SCOPE_OPTIONS, state.scope, key => {
      state.scope = key;
      state.platform = "all";
      render();
    });
    const platformOptions = getPlatformOptions(poolPosts, state.scope);
    if (!platformOptions.find(option => option.key === state.platform)) {
      state.platform = "all";
    }
    renderSelectControl(dom.platformSelect, platformOptions, state.platform, key => {
      state.platform = key;
      render();
    });
    renderSegmented(dom.granularityToggle, GRANULARITY_OPTIONS, state.granularity, key => {
      state.granularity = key;
      render();
    });
    renderThemeToggle();
    if (dom.controlNote) dom.controlNote.textContent = "";
  }

  function renderTimeControl(){
    if (!dom.reviewEndInput) return;
    const sourceWindow = parseReviewWindow(source.reviewWeek.dateRange);
    const latestSnapshot = latestSnapshotDate(posts);
    const earliestSnapshot = earliestSnapshotDate(posts);
    dom.reviewEndInput.value = formatDate(reviewWindow.end);
    dom.reviewEndInput.min = earliestSnapshot ? formatDate(earliestSnapshot) : "";
    dom.reviewEndInput.max = latestSnapshot ? formatDate(latestSnapshot) : formatDate(sourceWindow.end);
    if (dom.reviewPeriodSelect) dom.reviewPeriodSelect.value = String(state.reviewPeriodDays);
  }

  function renderThemeToggle(){
    if (!dom.themeToggle) return;
    dom.themeToggle.innerHTML = THEME_OPTIONS.map(option => `
      <button class="theme-chip theme-${option.key} ${option.key === state.theme ? "is-active" : ""}" type="button" data-theme-key="${option.key}" aria-label="切换到${escapeHtml(option.label)}主题">
        <span class="theme-dot"></span>
        <span>${escapeHtml(option.label)}</span>
      </button>
    `).join("");
    dom.themeToggle.querySelectorAll(".theme-chip").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const theme = button.dataset.themeKey;
        if (!THEME_OPTIONS.some(option => option.key === theme)) return;
        state.theme = theme;
        applyTheme();
        saveTheme(theme);
        renderThemeToggle();
      });
    });
  }

  function renderMetrics(derived){
    const cards = [
      {
        label: "样本帖子数",
        value: String(derived.filteredPosts.length),
        delta: "固定口径",
        helper: "最近30天发布帖子",
        tooltip: `帖子口径：最近30天发布<br>当前筛选：${describeScope(state.scope, state.platform)}<br>项目挂靠：${sum(derived.filteredPosts, p => p.projectLinks || 0)}`
      },
      {
        label: "本周曝光",
        value: formatCompact(derived.currentTotals.exposure),
        delta: formatDeltaPercent(safeWoW(derived.currentTotals.exposure, derived.previousTotals.exposure)),
        helper: "当前自然周 vs 上一自然周",
        tooltip: `上周曝光：${formatCompact(derived.previousTotals.exposure)}<br>月目标完成：${formatPct(safeRate(derived.currentTotals.exposure, source.monthlyGoal.exposureTarget))}`
      },
      {
        label: "本周总互动",
        value: formatCompact(derived.currentTotals.interaction),
        delta: formatDeltaPercent(safeWoW(derived.currentTotals.interaction, derived.previousTotals.interaction)),
        helper: "总互动统一口径",
        tooltip: `上周总互动：${formatCompact(derived.previousTotals.interaction)}<br>口径：likes + comments + shares + saves`
      },
      {
        label: "本周互动率",
        value: formatPct(derived.currentRate),
        delta: formatPctDelta(derived.currentRate - derived.previousRate),
        helper: "跨渠道仅作复盘线索",
        tooltip: `上周互动率：${formatPct(derived.previousRate)}<br>仅用于复盘线索，不直接判定渠道优劣`
      },
      {
        label: "贴均贡献",
        value: formatCompact(safeRate(derived.currentTotals.exposure, derived.currentPostCount)),
        delta: formatDeltaPercent(
          safeWoW(
            safeRate(derived.currentTotals.exposure, derived.currentPostCount),
            safeRate(derived.previousTotals.exposure, derived.previousPostCount)
          )
        ),
        helper: "本周曝光 ÷ 本周帖子数",
        tooltip: `本周帖子数：${derived.currentPostCount}<br>上周帖子数：${derived.previousPostCount}<br>上周贴均贡献：${formatCompact(safeRate(derived.previousTotals.exposure, derived.previousPostCount))}`
      }
    ];
    dom.metricGrid.innerHTML = cards.map(card => `
      <article class="metric-card" data-tooltip="${escapeHtml(card.tooltip)}">
        <div class="metric-label">${escapeHtml(card.label)}</div>
        <div class="metric-value">${escapeHtml(card.value)}</div>
        <div class="metric-sub">
          <div class="metric-sub-row"><span>环比</span><strong class="${classForDeltaText(card.delta)}">${escapeHtml(card.delta)}</strong></div>
          <div class="metric-sub-row"><span>说明</span><strong class="delta-flat">${escapeHtml(card.helper)}</strong></div>
        </div>
      </article>
    `).join("");
  }

  function renderInsights(derived){
    const top = [...derived.channelContributionRows].sort((a, b) => b.exposure - a.exposure)[0];
    const gap1 = selectLargestGap(derived.channelContributionRows, derived.batchRows);
    const gap2 = selectLargestGap(derived.channelContributionRows, derived.batchRows);
    const cards = [
      {
        tag: "主要来源",
        title: `本周曝光主要来自 ${wrapEntity(top?.label || "暂无数据")}`,
        body: `${top?.label || "暂无数据"} 曝光贡献率 ${formatPct(top?.exposureShare || 0)}，高于平均水平。`
      },
      {
        tag: "效率异常",
        title: `${wrapEntity(gap1.name)} 贡献差最大`,
        body: `${gap1.name} 曝光贡献率 ${formatPct(gap1.exposureShare)}，互动贡献率 ${formatPct(gap1.interactionShare)}，贡献差 ${formatPctDelta(gap1.interactionShare - gap1.exposureShare)}。`
      },
      {
        tag: "事实观察",
        title: `${wrapEntity(gap2.name)} 互动效率低于平均`,
        body: `${gap2.name} 曝光贡献率高于互动贡献率，互动效率低于平均水平。`
      }
    ];
    dom.insightGrid.innerHTML = cards.map(card => `
      <article class="insight-card">
        <span class="insight-tag">${escapeHtml(card.tag)}</span>
        <div class="insight-title">${card.title}</div>
        <div class="insight-body">${card.body}</div>
      </article>
    `).join("");
  }

  function renderLifecycle(derived){
    const granularityLabel = state.granularity === "week" ? "周" : "天";
    dom.lifecycleStack.innerHTML = `<div class="lifecycle-chart-grid">
      <section class="lifecycle-chart-panel lifecycle-trend-panel">
        <div class="sub-card-head">
          <div>
            <h3>曝光走势</h3>
            <span class="sub-card-note">折线粒度：${granularityLabel}（实线本周，虚线上周）</span>
          </div>
        </div>
        ${buildLineChartSvg({
          title: `曝光趋势（${granularityLabel}粒度）`,
          labels: derived.lineSeries.exposure.labels,
          primary: derived.lineSeries.exposure.current,
          secondary: derived.lineSeries.exposure.previous,
          currentPosts: derived.lineSeries.exposure.currentPosts,
          previousPosts: derived.lineSeries.exposure.previousPosts,
          primaryLabel: "本周曝光",
          secondaryLabel: "上周曝光",
          formatter: formatCompact
        })}
      </section>
      <section class="lifecycle-chart-panel lifecycle-contribution-panel">
        <div class="sub-card-head">
          <div>
            <h3>批次贡献</h3>
            <span class="sub-card-note">曝光贡献率与互动贡献率并列对比</span>
          </div>
        </div>
        ${buildBatchContributionChartSvg(derived.batchRows)}
      </section>
    </div>`;
  }

  function renderLifecycleTable(derived){
    const headers = ["批次","发布时间范围","曝光","曝光贡献率","总互动","互动贡献率","互动率","贡献差","诊断标签"];
    const rows = derived.batchRows.map(row => `<tr>
      <td>${escapeHtml(row.label)}</td>
      <td>${escapeHtml(row.dateRangeLabel)}<br><span class="chart-note">${escapeHtml(row.rangeLabel)}</span></td>
      <td>${formatCompact(row.currentExposure)}</td>
      <td>${formatPct(row.currentExposureShare)}</td>
      <td>${formatCompact(row.currentInteraction)}</td>
      <td>${formatPct(row.currentInteractionShare)}</td>
      <td>${formatPct(row.currentInteractionRate)}</td>
      <td class="${classForContributionGap(row.contributionGap)}">${formatPctDelta(row.contributionGap)}</td>
      <td>${renderBatchEfficiencyTag(row.contributionGap)}</td>
    </tr>`).join("");
    dom.lifecycleTable.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;
  }

  function renderLifecycleKpis(derived){
    if (!dom.lifecycleKpis) return;
    const topExposureBatch = [...derived.batchRows].sort((a, b) => b.currentExposure - a.currentExposure)[0];
    const topRateBatch = [...derived.batchRows].sort((a, b) => b.currentInteractionRate - a.currentInteractionRate)[0];
    const riskCount = derived.batchRows.filter(row => row.contributionGap < 0).length;
    renderKpiStrip(dom.lifecycleKpis, [
      {
        label: "复盘帖子数",
        value: String(derived.currentPostCount),
        note: `当前范围：${describeScope(state.scope, state.platform)}`
      },
      {
        label: "最高曝光批次",
        value: topExposureBatch ? topExposureBatch.label : "暂无",
        note: topExposureBatch ? `${formatCompact(topExposureBatch.currentExposure)} · 贡献率 ${formatPct(topExposureBatch.currentExposureShare)}` : "暂无数据"
      },
      {
        label: "最高互动率批次",
        value: topRateBatch ? topRateBatch.label : "暂无",
        note: topRateBatch ? `${formatPct(topRateBatch.currentInteractionRate)} · 总互动 ${formatCompact(topRateBatch.currentInteraction)}` : "暂无数据"
      },
      {
        label: "待复盘批次",
        value: `${riskCount}`,
        note: "贡献差 < 0 的批次数量"
      }
    ]);
  }

  function renderChannelMatrix(derived){
    const rows = derived.channelRows.filter(row => row.exposure > 0 || row.interaction > 0);
    if (!rows.length) { dom.channelMatrix.innerHTML = ""; return; }
    const xValues = rows.map(row => row.exposureShare).sort((a, b) => a - b);
    const yValues = rows.map(row => row.rate).sort((a, b) => a - b);
    const xCuts = levelCuts(xValues);
    const yCuts = levelCuts(yValues);
    const exposureLevels = ["低","中","高"];
    const interactionLevels = ["高","中","低"];
    const buckets = new Map();
    interactionLevels.forEach(yLevel => exposureLevels.forEach(xLevel => buckets.set(`${yLevel}-${xLevel}`, [])));
    rows.forEach(row => {
      const xLevel = levelOf(row.exposureShare, xCuts);
      const yLevel = levelOf(row.rate, yCuts);
      const key = `${yLevel}-${xLevel}`;
      if (buckets.has(key)) buckets.get(key).push({ ...row, xLevel, yLevel });
    });
    const boardCells = interactionLevels.map(yLevel => exposureLevels.map(xLevel => {
      const key = `${yLevel}-${xLevel}`;
      const list = (buckets.get(key) || []).sort((a, b) => b.interaction - a.interaction);
      const meta = matrixCellMeta(xLevel, yLevel);
      const content = list.length
        ? `${list.map((item, index) => `<li class="matrix-item" data-tooltip="${escapeHtml(`${item.label}<br>曝光贡献率 ${formatPct(item.exposureShare)}（${item.xLevel}）<br>互动率 ${formatPct(item.rate)}（${item.yLevel}）<br>本周曝光 ${formatCompact(item.exposure)}<br>本周互动 ${formatCompact(item.interaction)}`)}">
            <span class="matrix-item-rank">${index + 1}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <span class="matrix-item-metric"><em>互动率</em><b>${formatPct(item.rate)}</b></span>
            <span class="matrix-item-metric"><em>曝光贡献</em><b>${formatPct(item.exposureShare)}</b></span>
            <span class="matrix-item-metric"><em>互动贡献</em><b>${formatPct(item.interactionShare)}</b></span>
          </li>`).join("")}`
        : `<li class="matrix-empty">暂无渠道</li>`;
      return `<article class="matrix-cell matrix-tone-${meta.tone}">
        <div class="matrix-cell-top">
          <div class="matrix-cell-title">${meta.title}</div>
          <span class="matrix-count">${list.length}</span>
        </div>
        <ul class="matrix-list">${content}</ul>
      </article>`;
    }).join("")).join("");
    dom.channelMatrix.innerHTML = `<div class="matrix-wrap">
      <div class="matrix-head">
        <div>
          <div class="matrix-title">渠道分布</div>
          <div class="matrix-axis-hint">横轴看曝光贡献率，纵轴看互动率。右上是高贡献高效率，右下是高贡献低效率。</div>
        </div>
        <div class="matrix-legend">
          <span class="matrix-legend-chip tone-strong">优先放大</span>
          <span class="matrix-legend-chip tone-watch">重点观察</span>
          <span class="matrix-legend-chip tone-light">轻量维护</span>
        </div>
      </div>
      <div class="matrix-grid-shell">
        <div class="matrix-corner">
          <span>互动率</span>
          <span>曝光贡献</span>
        </div>
        <div class="matrix-axis-x">
          <span>低曝光贡献</span>
          <span>中曝光贡献</span>
          <span>高曝光贡献</span>
        </div>
        <div class="matrix-axis-y">
          <span>高互动率</span>
          <span>中互动率</span>
          <span>低互动率</span>
        </div>
        <div class="matrix-main">
          <div class="matrix-board">${boardCells}</div>
        </div>
      </div>
      <div class="matrix-note">备注：曝光贡献率(%) = (渠道本周曝光 ÷ 全渠道本周曝光) × 100%；互动率(%) = (渠道本周总互动 ÷ 渠道本周曝光) × 100%。其中“本周总互动”= 点赞 + 评论 + 分享 + 收藏（当前口径）；低/中/高分级按当前筛选结果的三分位阈值划分。</div>
    </div>`;
  }

  function levelCuts(values){
    if (!values.length) return { low: 0, mid: 0 };
    const lowIdx = Math.max(0, Math.floor(values.length / 3) - 1);
    const midIdx = Math.max(0, Math.floor((values.length * 2) / 3) - 1);
    return { low: values[lowIdx], mid: values[midIdx] };
  }

  function levelOf(value, cuts){
    if (value <= cuts.low) return "低";
    if (value <= cuts.mid) return "中";
    return "高";
  }

  function matrixCellMeta(xLevel, yLevel){
    const key = `${yLevel}-${xLevel}`;
    const map = {
      "高-高": { tone: "strong", title: "高曝光贡献 / 高互动率" },
      "高-中": { tone: "watch", title: "中曝光贡献 / 高互动率" },
      "高-低": { tone: "light", title: "低曝光贡献 / 高互动率" },
      "中-高": { tone: "watch", title: "高曝光贡献 / 中互动率" },
      "中-中": { tone: "neutral", title: "中曝光贡献 / 中互动率" },
      "中-低": { tone: "light", title: "低曝光贡献 / 中互动率" },
      "低-高": { tone: "risk", title: "高曝光贡献 / 低互动率" },
      "低-中": { tone: "watch", title: "中曝光贡献 / 低互动率" },
      "低-低": { tone: "muted", title: "低曝光贡献 / 低互动率" }
    };
    return map[key] || { tone: "neutral", title: `${xLevel}曝光贡献 / ${yLevel}互动率` };
  }

  function renderChannelTable(derived){
    const rows = [...derived.channelRows].sort((a, b) => b.exposure - a.exposure);
    dom.channelTable.innerHTML = renderSimpleTable(
      ["渠道类型","平台","帖子数","贴均贡献","本周曝光","本周总互动","互动率","曝光贡献率","互动贡献率","贡献差","诊断标签"],
      rows.map(row => [
        row.type,
        row.platform,
        String(row.postCount),
        formatCompact(row.perPostContribution),
        formatCompact(row.exposure),
        formatCompact(row.interaction),
        formatPct(row.rate),
        formatPct(row.exposureShare),
        formatPct(row.interactionShare),
        `<span class="${classForDeltaValue(row.interactionShare - row.exposureShare)}">${formatPctDelta(row.interactionShare - row.exposureShare)}</span>`,
        renderDiagnosisTag(row, derived.channelRows)
      ])
    );
  }

  function renderChannelKpis(derived){
    if (!dom.channelKpis) return;
    const rows = derived.channelRows;
    const avgShare = average(rows, row => row.exposureShare);
    const avgRate = average(rows, row => row.rate);
    const topExposure = [...rows].sort((a, b) => b.exposure - a.exposure)[0];
    const watchCount = rows.filter(row => row.exposureShare >= avgShare && row.rate < avgRate).length;
    renderKpiStrip(dom.channelKpis, [
      {
        label: "渠道数",
        value: String(rows.length),
        note: "按渠道类型 + 平台去重"
      },
      {
        label: "高贡献渠道",
        value: String(rows.filter(row => row.exposureShare >= avgShare).length),
        note: `阈值：曝光贡献率 >= ${formatPct(avgShare)}`
      },
      {
        label: "高效率渠道",
        value: String(rows.filter(row => row.rate >= avgRate).length),
        note: `阈值：互动率 >= ${formatPct(avgRate)}`
      },
      {
        label: "重点观察渠道",
        value: String(watchCount),
        note: topExposure ? `当前最大曝光：${topExposure.label}` : "暂无数据"
      }
    ]);
  }

  function renderContentPanels(derived){
    const medianExposure = median(derived.contentItems.map(item => item.exposure));
    const avgExposureShare = average(derived.contentItems, item => item.exposureShare);
    const sections = [
      {
        title: "高曝光内容",
        rows: [...derived.contentItems].sort((a, b) => b.exposure - a.exposure).slice(0, 5),
        formatter: row => `${row.type} / ${row.platform} · 曝光 ${formatCompact(row.exposure)} / 总互动 ${formatCompact(row.interaction)} / 互动率 ${formatPct(row.rate)}`
      },
      {
        title: "高互动内容",
        rows: [...derived.contentItems].sort((a, b) => b.interaction - a.interaction).slice(0, 5),
        formatter: row => `${row.type} / ${row.platform} · 曝光 ${formatCompact(row.exposure)} / 总互动 ${formatCompact(row.interaction)} / 互动率 ${formatPct(row.rate)}`
      },
      {
        title: "高互动率内容",
        note: `仅统计曝光 >= 内容曝光中位数（${formatCompact(medianExposure)}）`,
        rows: [...derived.contentItems].filter(item => item.exposure >= medianExposure).sort((a, b) => b.rate - a.rate).slice(0, 5),
        formatter: row => `${row.type} / ${row.platform} · 曝光 ${formatCompact(row.exposure)} / 总互动 ${formatCompact(row.interaction)} / 互动率 ${formatPct(row.rate)}`
      },
      {
        title: "高曝光低互动内容",
        rows: [...derived.contentItems]
          .filter(item => item.exposureShare > avgExposureShare && item.interactionShare < item.exposureShare)
          .sort((a, b) => (b.exposureShare - b.interactionShare) - (a.exposureShare - a.interactionShare))
          .slice(0, 5),
        formatter: row => `${row.type} / ${row.platform} · 曝光贡献率 ${formatPct(row.exposureShare)} / 互动贡献率 ${formatPct(row.interactionShare)} / 贡献差 ${formatPctDelta(row.interactionShare - row.exposureShare)}`
      }
    ];
    dom.contentPanels.innerHTML = sections.map(section => `<div class="sub-card">
      <div class="sub-card-head"><h3>${escapeHtml(section.title)}</h3>${section.note ? `<span class="sub-card-note">${escapeHtml(section.note)}</span>` : ""}</div>
      <div class="mini-list">${(section.rows.length ? section.rows : [{ label: "暂无符合条件的数据", tooltip: "当前筛选范围没有满足条件的内容项。" }]).map(row => `
        <div class="mini-item" data-tooltip="${escapeHtml(row.tooltip || `${row.label}<br>${section.formatter(row)}`)}">
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(section.formatter ? section.formatter(row) : "暂无说明")}</span>
        </div>`).join("")}
      </div></div>`).join("");
  }

  function renderContentKpis(derived){
    if (!dom.contentKpis) return;
    const items = derived.contentItems;
    const medianExposure = median(items.map(item => item.exposure));
    const medianRate = median(items.map(item => item.rate));
    const lowEffCount = items.filter(item => item.exposureShare > average(items, x => x.exposureShare) && item.interactionShare < item.exposureShare).length;
    const topPlatform = Object.values(groupBy(items, item => item.channel))
      .map(group => ({ label: group[0].channel, exposure: sum(group, item => item.exposure) }))
      .sort((a, b) => b.exposure - a.exposure)[0];
    renderKpiStrip(dom.contentKpis, [
      {
        label: "内容条目数",
        value: String(items.length),
        note: "当前筛选下有曝光或互动的帖子"
      },
      {
        label: "曝光中位数",
        value: formatCompact(medianExposure),
        note: "用于高互动率榜单过滤"
      },
      {
        label: "互动率中位数",
        value: formatPct(medianRate),
        note: `高曝光低互动内容：${lowEffCount} 条`
      },
      {
        label: "主导渠道",
        value: topPlatform ? topPlatform.label : "暂无",
        note: topPlatform ? `曝光 ${formatCompact(topPlatform.exposure)}` : "暂无数据"
      }
    ]);
  }

  function renderContentTable(derived){
    if (!dom.contentTable) return;
    const rows = [...derived.contentItems]
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 80);
    dom.contentTable.innerHTML = renderSimpleTable(
      ["内容","渠道类型","平台","发布时间","曝光","总互动","互动率","曝光贡献率","互动贡献率","贡献差"],
      rows.map(item => [
        escapeHtml(item.label),
        escapeHtml(item.type),
        escapeHtml(item.platform),
        escapeHtml(item.publishDate),
        formatCompact(item.exposure),
        formatCompact(item.interaction),
        formatPct(item.rate),
        formatPct(item.exposureShare),
        formatPct(item.interactionShare),
        `<span class="${classForDeltaValue(item.interactionShare - item.exposureShare)}">${formatPctDelta(item.interactionShare - item.exposureShare)}</span>`
      ])
    );
  }

  function renderOffsiteKpis(){
    if (!dom.offsiteKpis) return;
    const dtc = source.dtcSection || { totalCurrent: 0, totalPrevious: 0, totalLastYear: 0, rows: [] };
    const current = Number(dtc.totalCurrent || 0);
    const previous = Number(dtc.totalPrevious || 0);
    const topSource = [...(dtc.rows || [])].sort((a, b) => Number(b.current || 0) - Number(a.current || 0))[0];
    renderKpiStrip(dom.offsiteKpis, [
      {
        label: "站外来源数",
        value: String((dtc.rows || []).length),
        note: "当前导入中含站外来源条目"
      },
      {
        label: "本周站外总量",
        value: formatCompact(current),
        note: `较上周 ${formatDeltaPercent(safeWoW(current, previous))}`
      },
      {
        label: "主要来源",
        value: topSource ? topSource.label : "暂无",
        note: topSource ? `本周 ${formatCompact(topSource.current)}` : "暂无数据"
      },
      {
        label: "同比参考",
        value: formatDeltaPercent(safeWoW(current, Number(dtc.totalLastYear || 0))),
        note: "当前周 vs 去年同期"
      }
    ]);
  }

  function renderDtcSection(){
    const dtc = source.dtcSection || { totalCurrent: 0, totalPrevious: 0, totalLastYear: 0, rows: [] };
    const current = Number(dtc.totalCurrent || 0), previous = Number(dtc.totalPrevious || 0), lastYear = Number(dtc.totalLastYear || 0);
    dom.dtcSummary.innerHTML = [
      summaryCard("本周站外曝光", formatCompact(current), `较上周 ${formatDeltaPercent(safeWoW(current, previous))}`),
      summaryCard("上周站外曝光", formatCompact(previous), `去年同期 ${formatCompact(lastYear)}`),
      summaryCard("同比参考", formatDeltaPercent(safeWoW(current, lastYear)), "口径为当前周 vs 去年同期")
    ].join("");
    dom.dtcTable.innerHTML = `<thead><tr><th>来源</th><th>类型</th><th>渠道</th><th>站点</th><th>本周曝光</th><th>上周曝光</th><th>去年同期</th></tr></thead><tbody>
      ${dtc.rows.map(row => `<tr data-tooltip="${escapeHtml(`${row.label}<br>本周：${formatCompact(row.current)}<br>上周：${formatCompact(row.previous)}<br>去年同期：${formatCompact(row.lastYear)}`)}">
        <td>${escapeHtml(row.label)}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.channel)}</td><td>${escapeHtml(row.site)}</td>
        <td>${formatCompact(row.current)}</td><td>${formatCompact(row.previous)}</td><td>${formatCompact(row.lastYear)}</td>
      </tr>`).join("")}
    </tbody>`;
  }

  function renderBrandVoice(){
    const module = (source.manualModules && source.manualModules[0]) || { remark: "导入数据未包含声量模块，沿用默认空数据。", metrics: [] };
    if (!module.metrics.length) {
      dom.brandVoice.innerHTML = `<article class="brand-card"><h3>声量表现</h3><p>${escapeHtml(module.remark)}</p></article>`;
      return;
    }
    dom.brandVoice.innerHTML = module.metrics.map(metric => `<article class="brand-card" data-tooltip="${escapeHtml(`${metric.label}<br>本周：${formatMetric(metric.current, metric.unit)}<br>上周：${formatMetric(metric.previous, metric.unit)}`)}">
      <h3>${escapeHtml(metric.label)}</h3>
      <div class="summary-value">${escapeHtml(formatMetric(metric.current, metric.unit))}</div>
      <p>上周 ${escapeHtml(formatMetric(metric.previous, metric.unit))}，${escapeHtml(module.remark)}</p>
    </article>`).join("");
  }

  function renderVoiceKpis(){
    if (!dom.voiceKpis) return;
    const module = (source.manualModules && source.manualModules[0]) || { metrics: [] };
    const metrics = module.metrics || [];
    const upCount = metrics.filter(metric => asNumber(metric.current) > asNumber(metric.previous)).length;
    const topMetric = [...metrics].sort((a, b) => asNumber(b.current) - asNumber(a.current))[0];
    renderKpiStrip(dom.voiceKpis, [
      {
        label: "指标数",
        value: String(metrics.length),
        note: "来自声量模块指标口径"
      },
      {
        label: "上升指标",
        value: String(upCount),
        note: "本周高于上周"
      },
      {
        label: "最高指标",
        value: topMetric ? topMetric.label : "暂无",
        note: topMetric ? `本周 ${formatMetric(topMetric.current, topMetric.unit)}` : "暂无数据"
      },
      {
        label: "筛选范围",
        value: describeScope(state.scope, state.platform),
        note: "用于联动主看板筛选"
      }
    ]);
  }

  function buildBatchRows(filteredPosts, currentTotals, previousTotals){
    const ranges = [
      { label: "第1周", rangeLabel: "近1-7天发布", min: 0, max: 6 },
      { label: "第2周", rangeLabel: "近8-14天发布", min: 7, max: 13 },
      { label: "第3周", rangeLabel: "近15-21天发布", min: 14, max: 20 },
      { label: "第4周", rangeLabel: "近22-30天发布", min: 21, max: 29 }
    ];
    return ranges.map((range, index) => {
      const grouped = filteredPosts.filter(post => {
        const age = diffDays(post.publishDateObj, reviewWindow.end);
        return age >= range.min && age <= range.max;
      });
      const current = sumPostsForRange(grouped, reviewWindow.start, reviewWindow.end);
      const previous = sumPostsForRange(grouped, previousWindow.start, previousWindow.end);
      const currentExposureShare = safeRate(current.exposure, currentTotals.exposure);
      const currentInteractionShare = safeRate(current.interaction, currentTotals.interaction);
      return {
        key: `batch-${index + 1}`,
        label: range.label,
        rangeLabel: range.rangeLabel,
        dateRangeLabel: formatDateRange(addDays(reviewWindow.end, -range.max), addDays(reviewWindow.end, -range.min)),
        currentExposure: current.exposure,
        previousExposure: previous.exposure,
        currentInteraction: current.interaction,
        previousInteraction: previous.interaction,
        currentExposureShare,
        previousExposureShare: safeRate(previous.exposure, previousTotals.exposure),
        currentInteractionShare,
        previousInteractionShare: safeRate(previous.interaction, previousTotals.interaction),
        currentInteractionRate: safeRate(current.interaction, current.exposure),
        contributionGap: currentInteractionShare - currentExposureShare,
        exposureWoW: safeWoW(current.exposure, previous.exposure),
        interactionWoW: safeWoW(current.interaction, previous.interaction)
      };
    });
  }

  function buildChannelRows(filteredPosts, currentTotals){
    const grouped = new Map();
    filteredPosts.forEach(post => {
      const key = `${post.channelType}__${post.displayChannelName}`;
      if (!grouped.has(key)) grouped.set(key, {
        key,
        type: post.channelType,
        platform: post.displayChannelName,
        label: `${post.channelType} / ${post.displayChannelName}`,
        posts: []
      });
      grouped.get(key).posts.push(post);
    });
    return [...grouped.values()].map(group => {
      const totals = sumPostsForRange(group.posts, reviewWindow.start, reviewWindow.end);
      const postCount = countPostsForRange(group.posts, reviewWindow.start, reviewWindow.end);
      return {
        ...group,
        postCount,
        perPostContribution: safeRate(totals.exposure, postCount),
        exposure: totals.exposure,
        interaction: totals.interaction,
        rate: safeRate(totals.interaction, totals.exposure),
        exposureShare: safeRate(totals.exposure, currentTotals.exposure),
        interactionShare: safeRate(totals.interaction, currentTotals.interaction)
      };
    });
  }

  function buildChannelContributionRows(filteredPosts, currentTotals){
    const grouped = new Map();
    filteredPosts.forEach(post => {
      const key = `${post.channelType}__${post.displayChannelName}`;
      if (!grouped.has(key)) grouped.set(key, {
        key,
        type: post.channelType,
        platform: post.displayChannelName,
        label: `${post.channelType} / ${post.displayChannelName}`,
        posts: []
      });
      grouped.get(key).posts.push(post);
    });
    return [...grouped.values()].map(group => {
      const totals = sumPostsForRange(group.posts, reviewWindow.start, reviewWindow.end);
      return {
        ...group,
        exposure: totals.exposure,
        interaction: totals.interaction,
        exposureShare: safeRate(totals.exposure, currentTotals.exposure),
        interactionShare: safeRate(totals.interaction, currentTotals.interaction)
      };
    });
  }

  function buildContentItems(filteredPosts, currentTotals){
    return filteredPosts.map(post => {
      const metrics = diffMetrics(post, reviewWindow.start, reviewWindow.end);
      const age = diffDays(post.publishDateObj, reviewWindow.end);
      const label = post.title && !post.title.startsWith("未知") ? post.title : contentLabel(post);
      return {
        id: post.id,
        label,
        type: post.channelType,
        platform: post.displayChannelName,
        channel: `${post.channelType} / ${post.displayChannelName}`,
        batch: batchLabelByAge(age),
        publishDate: formatDate(post.publishDateObj),
        exposure: metrics.exposure,
        interaction: metrics.interaction,
        rate: safeRate(metrics.interaction, metrics.exposure),
        exposureShare: safeRate(metrics.exposure, currentTotals.exposure),
        interactionShare: safeRate(metrics.interaction, currentTotals.interaction),
        tooltip: `${post.channelType} / ${post.displayChannelName}<br>发布时间 ${formatDate(post.publishDateObj)}<br>曝光 ${formatCompact(metrics.exposure)}<br>总互动 ${formatCompact(metrics.interaction)}<br>互动率 ${formatPct(safeRate(metrics.interaction, metrics.exposure))}`
      };
    }).filter(item => item.exposure > 0 || item.interaction > 0);
  }

  function buildContributionRows(rows, metricKey, total){
    return rows.map((row, index) => ({
      label: row.label,
      value: Number(row[metricKey] || 0),
      share: safeRate(Number(row[metricKey] || 0), total),
      color: DONUT_COLORS[index % DONUT_COLORS.length],
      tooltip: `${row.label}<br>数值 ${formatCompact(Number(row[metricKey] || 0))}<br>占比 ${formatPct(safeRate(Number(row[metricKey] || 0), total))}`
    })).filter(row => row.value > 0);
  }

  function buildLineSeries(filteredPosts, granularity){
    if (granularity === "week") {
      return { exposure: buildWeeklyLineMetric(filteredPosts, "exposure"), interaction: buildWeeklyLineMetric(filteredPosts, "interaction") };
    }
    return { exposure: buildDailyLineMetric(filteredPosts, "exposure"), interaction: buildDailyLineMetric(filteredPosts, "interaction") };
  }

  function buildDailyLineMetric(filteredPosts, metric){
    const dates = eachDate(poolWindow.start, poolWindow.end);
    const labels = dates.map((day, index) => (index % 4 === 0 || index === dates.length - 1 ? formatMonthDay(day) : ""));
    const current = dates.map(day => sumPostsForRange(filteredPosts, day, day)[metric]);
    const previous = eachDate(previousPoolWindow.start, previousPoolWindow.end).map(day => sumPostsForRange(filteredPosts, day, day)[metric]);
    const currentPosts = dates.map(day => countPostsForRange(filteredPosts, day, day));
    const previousPosts = eachDate(previousPoolWindow.start, previousPoolWindow.end).map(day => countPostsForRange(filteredPosts, day, day));
    return { labels, current, previous, currentPosts, previousPosts };
  }

  function buildWeeklyLineMetric(filteredPosts, metric){
    const labels = [];
    const current = [];
    const previous = [];
    const currentPosts = [];
    const previousPosts = [];
    for (let step = 3; step >= 0; step -= 1) {
      const start = addDays(reviewWindow.start, -step * 7);
      const end = addDays(start, 6);
      labels.push(`${formatMonthDay(start)}\n${formatMonthDay(end)}`);
      current.push(sumPostsForRange(filteredPosts, start, end)[metric]);
      previous.push(sumPostsForRange(filteredPosts, addDays(start, -28), addDays(end, -28))[metric]);
      currentPosts.push(countPostsForRange(filteredPosts, start, end));
      previousPosts.push(countPostsForRange(filteredPosts, addDays(start, -28), addDays(end, -28)));
    }
    return { labels, current, previous, currentPosts, previousPosts };
  }

  function sumPostsForRange(postsInRange, start, end){
    return postsInRange.reduce((acc, post) => {
      const diff = diffMetrics(post, start, end);
      acc.exposure += diff.exposure;
      acc.interaction += diff.interaction;
      return acc;
    }, { exposure: 0, interaction: 0 });
  }

  function countPostsForRange(postsInRange, start, end){
    let count = 0;
    postsInRange.forEach(post => {
      const diff = diffMetrics(post, start, end);
      if (diff.exposure > 0 || diff.interaction > 0) count += 1;
    });
    return count;
  }

  function diffMetrics(post, start, end){
    const endCum = cumulativeAt(post, end);
    const beforeCum = cumulativeAt(post, addDays(start, -1));
    return {
      exposure: Math.max(0, endCum.exposure - beforeCum.exposure),
      interaction: Math.max(0, endCum.interaction - beforeCum.interaction)
    };
  }

  function cumulativeAt(post, date){
    for (let index = post.snapshots.length - 1; index >= 0; index -= 1) {
      const snapshot = post.snapshots[index];
      if (snapshot.dateObj <= date) return { exposure: Number(snapshot.exposure || 0), interaction: Number(snapshot.interaction || 0) };
    }
    return { exposure: 0, interaction: 0 };
  }

  function buildLineChartSvg(config){
    const width = 780, height = 320, padding = { top: 24, right: 18, bottom: 48, left: 48 };
    const plotWidth = width - padding.left - padding.right, plotHeight = height - padding.top - padding.bottom;
    const maxValue = Math.max(1, ...config.primary, ...config.secondary);
    const x = idx => padding.left + (plotWidth * idx / Math.max(1, config.labels.length - 1));
    const y = value => padding.top + plotHeight - (plotHeight * value / maxValue);
    const path = values => values.map((value, idx) => `${idx === 0 ? "M" : "L"} ${x(idx)} ${y(value)}`).join(" ");
    const grid = Array.from({ length: 5 }, (_, i) => {
      const value = maxValue * i / 4;
      const yy = y(value);
      return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="#e4edf6" stroke-dasharray="4 6"/><text x="${padding.left - 10}" y="${yy + 4}" text-anchor="end" fill="#7a8ea7" font-size="11">${escapeHtml(config.formatter(value))}</text>`;
    }).join("");
    const labels = config.labels.map((label, idx) => `<text x="${x(idx)}" y="${height - 18}" text-anchor="middle" fill="#6a7d95" font-size="11">${escapeHtml(label)}</text>`).join("");
    const pPts = config.primary.map((value, idx) => svgCirclePoint({ cx: x(idx), cy: y(value), color: "#2f607c", tooltip: `${config.primaryLabel}<br>${config.labels[idx] || idx + 1}：${config.formatter(value)}` })).join("");
    const sPts = config.secondary.map((value, idx) => svgCirclePoint({ cx: x(idx), cy: y(value), color: "#9ab0bf", tooltip: `${config.secondaryLabel}<br>${config.labels[idx] || idx + 1}：${config.formatter(value)}` })).join("");
    const hoverBandWidth = plotWidth / Math.max(1, config.labels.length);
    const hoverGuides = config.labels.map((label, idx) => {
      const centerX = x(idx);
      const bandX = Math.max(padding.left, centerX - hoverBandWidth / 2);
      const postsInfo = (config.currentPosts && config.previousPosts)
        ? `<br>本周帖子数：${config.currentPosts[idx] || 0}<br>上周帖子数：${config.previousPosts[idx] || 0}`
        : "";
      const tooltip = `${label}<br>${config.primaryLabel}：${config.formatter(config.primary[idx] || 0)}<br>${config.secondaryLabel}：${config.formatter(config.secondary[idx] || 0)}${postsInfo}`;
      return `<g class="line-hover-guide" data-tooltip="${escapeHtml(tooltip)}">
        <rect x="${bandX}" y="${padding.top}" width="${hoverBandWidth}" height="${plotHeight}" fill="transparent"></rect>
        <line class="line-hover-guide-line" x1="${centerX}" y1="${padding.top}" x2="${centerX}" y2="${padding.top + plotHeight}"></line>
      </g>`;
    }).join("");
    return `<svg class="svg-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(config.title)}">
      ${grid}
      <path d="${path(config.secondary)}" fill="none" stroke="#9ab0bf" stroke-width="3" stroke-dasharray="8 8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${path(config.primary)}" fill="none" stroke="#2f607c" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      ${hoverGuides}
      ${pPts}${sPts}${labels}
    </svg>
    <div class="chart-legend"><div class="chart-legend-item"><span class="chart-legend-line"></span>${escapeHtml(config.primaryLabel)}</div><div class="chart-legend-item"><span class="chart-legend-line alt"></span>${escapeHtml(config.secondaryLabel)}</div></div>`;
  }

  function buildBatchComboChartSvg(rows){
    const width = 760, height = 360, padding = { top: 24, right: 68, bottom: 58, left: 72 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxExposure = Math.max(1, ...rows.map(row => row.currentExposure)) * 1.16;
    const maxRate = Math.max(0.01, ...rows.map(row => row.currentInteractionRate)) * 1.2;
    const xCenter = index => padding.left + plotWidth * (index + 0.5) / rows.length;
    const yExposure = value => padding.top + plotHeight - plotHeight * value / maxExposure;
    const yRate = value => padding.top + plotHeight - plotHeight * value / maxRate;
    const barWidth = Math.min(64, plotWidth / (rows.length * 2.4));
    const grid = Array.from({ length: 5 }, (_, index) => {
      const exposureValue = maxExposure * index / 4;
      const rateValue = maxRate * index / 4;
      const yy = yExposure(exposureValue);
      return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="#e4edf6" stroke-dasharray="4 6"/>
        <text x="${padding.left - 10}" y="${yy + 4}" text-anchor="end" fill="#6f8299" font-size="11">${escapeHtml(formatCompact(exposureValue))}</text>
        <text x="${width - padding.right + 10}" y="${yy + 4}" text-anchor="start" fill="#a06616" font-size="11">${escapeHtml(formatPct(rateValue))}</text>`;
    }).join("");
    const bars = rows.map((row, index) => {
      const x = xCenter(index) - barWidth / 2;
      const y = yExposure(row.currentExposure);
      const h = padding.top + plotHeight - y;
      return `<rect class="batch-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(1, h)}" rx="8" fill="#2f607c" data-tooltip="${escapeHtml(batchTooltip(row))}"/>`;
    }).join("");
    const linePath = rows.map((row, index) => `${index === 0 ? "M" : "L"} ${xCenter(index)} ${yRate(row.currentInteractionRate)}`).join(" ");
    const points = rows.map((row, index) => svgCirclePoint({
      cx: xCenter(index),
      cy: yRate(row.currentInteractionRate),
      color: "#b98231",
      tooltip: batchTooltip(row)
    })).join("");
    const labels = rows.map((row, index) => `<text x="${xCenter(index)}" y="${height - 24}" text-anchor="middle" fill="#50677f" font-size="12" font-weight="700">${escapeHtml(row.label)}</text>
      <text x="${xCenter(index)}" y="${height - 8}" text-anchor="middle" fill="#7a8ea7" font-size="10">${escapeHtml(row.rangeLabel)}</text>`).join("");
    return `<div class="batch-chart-wrap">
      <svg class="svg-chart batch-combo-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="批次表现趋势柱线组合图">
        <text x="${padding.left}" y="14" fill="#6f8299" font-size="11">曝光</text>
        <text x="${width - padding.right}" y="14" text-anchor="end" fill="#a06616" font-size="11">互动率</text>
        ${grid}
        <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#cfddeb"/>
        ${bars}
        <path d="${linePath}" fill="none" stroke="#b98231" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${points}
        ${labels}
      </svg>
      <div class="chart-legend">
        <div class="chart-legend-item"><span class="chart-legend-block exposure"></span>曝光</div>
        <div class="chart-legend-item"><span class="chart-legend-line rate"></span>互动率</div>
      </div>
    </div>`;
  }

  function buildBatchContributionChartSvg(rows){
    const width = 520, height = 360, padding = { top: 24, right: 22, bottom: 58, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const maxShare = Math.max(0.01, ...rows.map(row => row.currentExposureShare), ...rows.map(row => row.currentInteractionShare)) * 1.18;
    const xCenter = index => padding.left + plotWidth * (index + 0.5) / rows.length;
    const y = value => padding.top + plotHeight - plotHeight * value / maxShare;
    const barWidth = Math.min(28, plotWidth / (rows.length * 4.2));
    const grid = Array.from({ length: 5 }, (_, index) => {
      const value = maxShare * index / 4;
      const yy = y(value);
      return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="#e4edf6" stroke-dasharray="4 6"/>
        <text x="${padding.left - 8}" y="${yy + 4}" text-anchor="end" fill="#6f8299" font-size="11">${escapeHtml(formatPct(value))}</text>`;
    }).join("");
    const bars = rows.map((row, index) => {
      const center = xCenter(index);
      const exposureX = center - barWidth - 3;
      const interactionX = center + 3;
      const exposureY = y(row.currentExposureShare);
      const interactionY = y(row.currentInteractionShare);
      const base = padding.top + plotHeight;
      const tooltip = escapeHtml(`${row.label}<br>${row.dateRangeLabel}<br>曝光贡献率 ${formatPct(row.currentExposureShare)}<br>互动贡献率 ${formatPct(row.currentInteractionShare)}<br>贡献差 ${formatPctDelta(row.contributionGap)}`);
      return `<g data-tooltip="${tooltip}">
        <rect class="batch-bar" x="${exposureX}" y="${exposureY}" width="${barWidth}" height="${Math.max(1, base - exposureY)}" rx="6" fill="#2f607c"/>
        <rect class="batch-bar" x="${interactionX}" y="${interactionY}" width="${barWidth}" height="${Math.max(1, base - interactionY)}" rx="6" fill="#238672"/>
        <rect x="${center - barWidth * 1.45}" y="${padding.top}" width="${barWidth * 2.9}" height="${plotHeight}" fill="transparent"/>
      </g>`;
    }).join("");
    const labels = rows.map((row, index) => `<text x="${xCenter(index)}" y="${height - 24}" text-anchor="middle" fill="#50677f" font-size="12" font-weight="700">${escapeHtml(row.label)}</text>
      <text x="${xCenter(index)}" y="${height - 8}" text-anchor="middle" fill="${row.contributionGap >= 0 ? "#17815a" : "#bd5b16"}" font-size="10">${escapeHtml(formatPctDelta(row.contributionGap))}</text>`).join("");
    return `<div class="batch-chart-wrap">
      <svg class="svg-chart batch-contribution-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="批次贡献对比并列柱状图">
        ${grid}
        <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#cfddeb"/>
        ${bars}
        ${labels}
      </svg>
      <div class="chart-legend">
        <div class="chart-legend-item"><span class="chart-legend-block exposure"></span>曝光贡献率</div>
        <div class="chart-legend-item"><span class="chart-legend-block interaction"></span>互动贡献率</div>
      </div>
    </div>`;
  }

  function batchTooltip(row){
    return `${row.label}<br>发布时间范围 ${row.dateRangeLabel}<br>曝光 ${formatCompact(row.currentExposure)}<br>总互动 ${formatCompact(row.currentInteraction)}<br>互动率 ${formatPct(row.currentInteractionRate)}`;
  }

  function renderDonutCard(title, rows, total, unitLabel){
    return `<article class="donut-card">
      <div class="donut-visual">${buildDonutSvg(rows, total, title)}</div>
      <div>
        <div class="sub-card-head"><h3>${escapeHtml(title)}</h3><span class="sub-card-note">全部小项均保留，不合并为“其他”</span></div>
        <div class="legend-list">${rows.map(row => `<div class="legend-row" data-tooltip="${escapeHtml(`${row.label}<br>${unitLabel} ${formatCompact(row.value)}<br>占比 ${formatPct(row.share)}`)}">
          <span class="legend-swatch" style="background:${row.color}"></span>
          <div class="legend-main"><strong>${escapeHtml(row.label)}</strong><span>${unitLabel} ${formatCompact(row.value)} · 占比 ${formatPct(row.share)}</span></div>
          <div class="legend-value">${formatPct(row.share)}</div></div>`).join("")}
        </div>
      </div>
    </article>`;
  }

  function buildDonutSvg(rows, total, title){
    const size = 240, stroke = 26, radius = (size - stroke) / 2, center = size / 2, circumference = 2 * Math.PI * radius;
    let offset = 0;
    const arcs = rows.map(row => {
      const dash = circumference * row.share;
      const out = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${row.color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${dash} ${Math.max(0, circumference - dash)}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${center} ${center})" data-tooltip="${escapeHtml(row.tooltip)}"/>`;
      offset += dash;
      return out;
    }).join("");
    return `<svg class="svg-chart" viewBox="0 0 ${size} ${size}" role="img" aria-label="${escapeHtml(title)}">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="#edf3f8" stroke-width="${stroke}"></circle>
      ${arcs}
      <text x="${center}" y="${center - 6}" text-anchor="middle" fill="#142c3f" font-size="15" font-weight="700">本周总量</text>
      <text x="${center}" y="${center + 22}" text-anchor="middle" fill="#142c3f" font-size="26" font-weight="800">${escapeHtml(formatCompact(total))}</text>
    </svg>`;
  }

  function renderSegmented(container, options, activeKey, onChange){
    container.innerHTML = options.map(option => `<button class="segment ${option.key === activeKey ? "is-active" : ""}" type="button" data-key="${option.key}">${escapeHtml(option.label)}</button>`).join("");
    container.querySelectorAll(".segment").forEach(button => {
      button.addEventListener("click", event => {
        event.preventDefault();
        const key = button.dataset.key;
        if (key !== activeKey) onChange(key);
      });
    });
  }

  function renderSelectControl(selectEl, options, activeKey, onChange){
    if (!selectEl) return;
    selectEl.innerHTML = options.map(option => `<option value="${escapeHtml(option.key)}"${option.key === activeKey ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
    selectEl.onchange = () => {
      const key = selectEl.value;
      if (key !== activeKey) onChange(key);
    };
  }

  function bindTabs(){
    if (!dom.tabStrip) return;
    dom.tabStrip.addEventListener("click", event => {
      const button = event.target.closest(".tab-item");
      if (!button) return;
      event.preventDefault();
      const nextView = button.dataset.view;
      if (!VIEW_OPTIONS.some(option => option.key === nextView)) return;
      state.view = nextView;
      renderViewState();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function bindTimeControls(){
    if (dom.reviewEndInput) {
      dom.reviewEndInput.addEventListener("change", () => {
        const nextDate = toDateString(dom.reviewEndInput.value);
        if (!nextDate) return;
        state.reviewEndDate = nextDate;
        saveReviewEndDate(nextDate);
        recomputeBaseWindows();
        render();
      });
    }
    if (dom.reviewPeriodSelect) {
      dom.reviewPeriodSelect.addEventListener("change", () => {
        const nextDays = Math.max(1, Number(dom.reviewPeriodSelect.value || 7));
        if (!REVIEW_PERIOD_OPTIONS.some(option => option.days === nextDays)) return;
        state.reviewPeriodDays = nextDays;
        saveReviewPeriod(nextDays);
        recomputeBaseWindows();
        render();
      });
    }
  }

  function bindDataImport(){
    if (!dom.importBtn || !dom.importInput) return;
    dom.importBtn.addEventListener("click", () => dom.importInput.click());
    dom.importInput.addEventListener("change", async () => {
      const file = dom.importInput.files && dom.importInput.files[0];
      if (!file) return;
      setImportStatus(`正在导入：${file.name}`);
      try {
        const imported = await buildSourceFromFile(file);
        const importAudit = imported.importAudit || null;
        source = {
          ...cloneData(initialSource),
          ...imported,
          monthlyGoal: cloneData(initialSource.monthlyGoal || imported.monthlyGoal || { month: "", exposureTarget: 0 }),
          manualModules: cloneData(initialSource.manualModules || imported.manualModules || []),
          dtcSection: cloneData(initialSource.dtcSection || imported.dtcSection || { totalCurrent: 0, totalPrevious: 0, totalLastYear: 0, rows: [] })
        };
        initMonthlyGoalTarget();
        state.scope = "all";
        state.platform = "all";
        state.reviewEndDate = "";
        state.view = "overview";
        saveReviewEndDate("");
        dataSourceLabel = "文件数据";
        recomputeBaseWindows();
        render();
        const skippedNotes = [];
        if (importAudit && importAudit.missingPublishDate > 0) skippedNotes.push(`缺发布时间 ${importAudit.missingPublishDate} 行`);
        if (importAudit && importAudit.missingStatDate > 0) skippedNotes.push(`缺统计日期 ${importAudit.missingStatDate} 行`);
        const skippedSuffix = skippedNotes.length ? `（${skippedNotes.join("，")}）` : "";
        setImportStatus(`已导入 · ${source.posts.length}帖${skippedSuffix}`);
      } catch (error) {
        console.error(error);
        setImportStatus(`导入失败：${error && error.message ? error.message : "格式不匹配"}`);
      } finally {
        dom.importInput.value = "";
      }
    });
    if (dom.resetBtn) {
      dom.resetBtn.addEventListener("click", () => {
        source = cloneData(initialSource);
        initMonthlyGoalTarget();
        state.scope = "all";
        state.platform = "all";
        state.granularity = "day";
        state.reviewEndDate = "";
        state.view = "overview";
        saveReviewEndDate("");
        dataSourceLabel = "内置数据";
        recomputeBaseWindows();
        render();
        setImportStatus("内置数据");
      });
    }
  }

  function setImportStatus(text){
    if (dom.importStatus) dom.importStatus.textContent = text;
  }

  async function buildSourceFromFile(file){
    const rows = await readRowsFromFile(file);
    const importResult = buildPostsFromImportedRows(rows);
    const postsFromRows = importResult.posts;
    if (!postsFromRows.length) throw new Error("没有识别到有效帖子数据，请检查发布时间和统计日期");
    const latestStatDate = postsFromRows.reduce((maxDate, post) => {
      const last = post.snapshots[post.snapshots.length - 1];
      if (!last) return maxDate;
      const currentDate = parseDate(last.capturedAt);
      return currentDate > maxDate ? currentDate : maxDate;
    }, parseDate(postsFromRows[0].snapshots[postsFromRows[0].snapshots.length - 1].capturedAt));
    const weekStart = addDays(latestStatDate, -6);
    const sampleTag = `${latestStatDate.getFullYear()}-W${weekOfYear(latestStatDate)}`;
    return {
      generatedAt: formatDate(new Date()),
      currentSample: sampleTag,
      reviewWeek: {
        weekIndex: weekOfYear(latestStatDate),
        dateRange: `${formatDate(weekStart)} ~ ${formatDate(latestStatDate)}`,
        publishWindow: `${formatDate(addDays(latestStatDate, -29))} ~ ${formatDate(latestStatDate)} 发布帖子`
      },
      posts: postsFromRows,
      importAudit: importResult.audit
    };
  }

  async function readRowsFromFile(file){
    const ext = file.name.split(".").pop().toLowerCase();
    if (window.XLSX) return readRowsWithXlsx(file);
    if (ext === "csv") return readRowsFromCsvText(await file.text());
    throw new Error("Excel 解析库加载失败，请联网后刷新页面重试");
  }

  async function readRowsWithXlsx(file){
    const buffer = await file.arrayBuffer();
    const workbook = window.XLSX.read(buffer, { type: "array", cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    const worksheet = workbook.Sheets[firstSheetName];
    return window.XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });
  }

  function readRowsFromCsvText(text){
    const lines = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
    if (!lines.length) return [];
    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map(line => {
      const cells = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => { row[header] = cells[index] ?? null; });
      return row;
    });
  }

  function parseCsvLine(line){
    const out = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === "\"") {
        if (inQuotes && line[i + 1] === "\"") {
          current += "\"";
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        out.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current);
    return out;
  }

  function buildPostsFromImportedRows(rows){
    const audit = {
      totalRows: rows.length,
      acceptedRows: 0,
      missingPublishDate: 0,
      missingStatDate: 0
    };
    const groups = new Map();
    rows.forEach((row, rowIndex) => {
      const normalized = normalizeImportedRow(row, rowIndex, audit);
      if (!normalized) return;
      audit.acceptedRows += 1;
      if (!groups.has(normalized.postKey)) {
        groups.set(normalized.postKey, {
          id: `imp-${hashText(normalized.postKey)}`,
          title: normalized.title,
          platform: normalized.platform,
          channelType: normalized.channelType,
          channelName: normalized.channelName,
          owner: normalized.owner,
          contentFormat: normalized.contentFormat,
          contentTopic: normalized.contentTopic,
          featuredQuality: normalized.featuredQuality,
          publishDate: normalized.publishDate,
          projectKeys: new Set(),
          snapshotsByDate: new Map()
        });
      }
      const group = groups.get(normalized.postKey);
      if (normalized.projectKey) group.projectKeys.add(normalized.projectKey);
      const existing = group.snapshotsByDate.get(normalized.statDate);
      if (!existing) {
        group.snapshotsByDate.set(normalized.statDate, {
          capturedAt: normalized.statDate,
          exposure: normalized.exposure,
          likes: normalized.likes,
          comments: normalized.comments,
          shares: normalized.shares,
          saves: normalized.saves
        });
      } else {
        // 导出明细可能因挂靠项目重复同一帖子，按单日最大值去重，避免重复累加。
        existing.exposure = Math.max(existing.exposure, normalized.exposure);
        existing.likes = Math.max(existing.likes, normalized.likes);
        existing.comments = Math.max(existing.comments, normalized.comments);
        existing.shares = Math.max(existing.shares, normalized.shares);
        existing.saves = Math.max(existing.saves, normalized.saves);
      }
    });
    const posts = Array.from(groups.values()).map(group => {
      const snapshots = Array.from(group.snapshotsByDate.values())
        .sort((a, b) => parseDate(a.capturedAt) - parseDate(b.capturedAt))
        .map((snapshot, index) => ({ ...snapshot, weekIndex: index + 1 }));
      return {
        id: group.id,
        title: group.title,
        platform: group.platform,
        channelType: group.channelType,
        channelName: group.channelName,
        owner: group.owner,
        contentFormat: group.contentFormat,
        contentTopic: group.contentTopic,
        featuredQuality: group.featuredQuality,
        publishDate: group.publishDate,
        projectLinks: Math.max(1, group.projectKeys.size || 1),
        snapshots
      };
    }).filter(post => post.snapshots.length > 0);
    return { posts, audit };
  }

  function normalizeImportedRow(row, rowIndex, audit){
    const statDate = toDateString(getImportedValue(row, ["统计日期"]));
    const publishDate = toDateString(getImportedValue(row, ["发布时间"]));
    const link = asText(getImportedValue(row, ["帖子链接", "链接"]));
    if (!statDate) {
      if (audit) audit.missingStatDate += 1;
      return null;
    }
    if (!publishDate) {
      if (audit) audit.missingPublishDate += 1;
      return null;
    }
    const channelName = asText(getImportedValue(row, ["渠道名称", "渠道"])) || "未知渠道";
    const channelType = asText(getImportedValue(row, ["渠道类型"])) || "社媒";
    const project = asText(getImportedValue(row, ["项目"]));
    const topic = asText(getImportedValue(row, ["内容主题"]));
    const format = normalizeContentFormat(getImportedValue(row, ["内容形式"]));
    const msku = asText(getImportedValue(row, ["MSKU", "SKU"]));
    const title = [project, topic].filter(text => text && text !== "未知").join(" · ") || (topic || project || `${channelName} 内容`);
    const likes = asNumber(getImportedValue(row, ["点赞数"]));
    const comments = asNumber(getImportedValue(row, ["评论数"]));
    const shares = asNumber(getImportedValue(row, ["转发数", "分享数"]));
    const saves = asNumber(getImportedValue(row, ["收藏数"]));
    const interaction = asNumber(getImportedValue(row, ["互动量"]));
    const postKey = link || `${channelType}__${channelName}__${publishDate}__${title}__${rowIndex}`;
    const interactionByFields = likes + comments + shares + saves;
    return {
      postKey,
      title,
      platform: channelName,
      channelType,
      channelName,
      owner: asText(getImportedValue(row, ["负责人"])) || "未知",
      contentFormat: format,
      contentTopic: topic || "未知",
      featuredQuality: asText(getImportedValue(row, ["是否为优质内容"])) || "未知",
      publishDate,
      statDate,
      projectKey: [project, msku].filter(Boolean).join("::"),
      exposure: asNumber(getImportedValue(row, ["曝光量", "曝光"])),
      likes,
      comments,
      shares,
      saves,
      interaction: Math.max(interaction, interactionByFields)
    };
  }

  function getImportedValue(row, aliases){
    const keyMap = getNormalizedHeaderMap(row);
    for (const alias of aliases) {
      const key = keyMap.get(normalizeHeader(alias));
      if (key) return row[key];
    }
    return null;
  }

  function getNormalizedHeaderMap(row){
    if (row.__normalizedHeaderMap) return row.__normalizedHeaderMap;
    const map = new Map();
    Object.keys(row).forEach(key => map.set(normalizeHeader(key), key));
    row.__normalizedHeaderMap = map;
    return map;
  }

  function normalizeHeader(text){
    return String(text || "").replace(/\s+/g, "").toLowerCase();
  }

  function renderSimpleTable(headers, rows){
    return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  function renderKpiStrip(container, cards){
    container.innerHTML = cards.map(card => `<article class="module-kpi-card">
      <div class="module-kpi-label">${escapeHtml(card.label)}</div>
      <div class="module-kpi-value">${escapeHtml(String(card.value ?? "--"))}</div>
      <div class="module-kpi-note">${escapeHtml(card.note || "")}</div>
    </article>`).join("");
  }
  function heroMetaCard(title, value){ return `<div class="hero-meta-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(value)}</span></div>`; }
  function summaryCard(label, value, foot){ return `<div class="summary-card" data-tooltip="${escapeHtml(`${label}<br>${value}<br>${foot}`)}"><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value">${escapeHtml(value)}</div><div class="summary-foot">${escapeHtml(foot)}</div></div>`; }
  function svgCirclePoint(config){ return `<circle cx="${config.cx}" cy="${config.cy}" r="5" fill="${config.color}" stroke="#ffffff" stroke-width="2" data-tooltip="${escapeHtml(config.tooltip)}"/>`; }

  function renderBatchEfficiencyTag(gap){
    if (gap >= 0.02) return '<span class="tag-badge tag-eff-high">效率偏高</span>';
    if (gap <= -0.02) return '<span class="tag-badge tag-eff-low">效率偏低</span>';
    return '<span class="tag-badge tag-eff-flat">效率平衡</span>';
  }

  function renderDiagnosisTag(row, allRows){
    const avgExposure = average(allRows, item => item.exposureShare);
    const avgRate = average(allRows, item => item.rate);
    const highExposure = row.exposureShare >= avgExposure;
    const highRate = row.rate >= avgRate;
    if (highExposure && highRate) return '<span class="tag-badge tag-core">核心渠道</span>';
    if (highExposure && !highRate) return '<span class="tag-badge tag-review">待复盘渠道</span>';
    if (!highExposure && highRate) return '<span class="tag-badge tag-potential">潜力渠道</span>';
    return '<span class="tag-badge tag-watch">观察渠道</span>';
  }

  function selectLargestGap(channelRows, batchRows){
    const candidates = [
      ...channelRows.map(row => ({ name: row.label, exposureShare: row.exposureShare, interactionShare: row.interactionShare })),
      ...batchRows.map(row => ({ name: row.label, exposureShare: row.currentExposureShare, interactionShare: row.currentInteractionShare }))
    ];
    return candidates.sort((a, b) => Math.abs(b.interactionShare - b.exposureShare) - Math.abs(a.interactionShare - a.exposureShare))[0] || { name: "暂无数据", exposureShare: 0, interactionShare: 0 };
  }

  function getPlatformOptions(items, scope){
    const base = scope === "all" ? items : items.filter(post => post.channelType === scope);
    const platforms = [...new Set(base.map(post => canonicalChannelName(post.channelName || post.platform)).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "zh-CN"));
    return [PLATFORM_ALL_OPTION, ...platforms.map(name => ({ key: name, label: name }))];
  }
  function filterPostsByScope(items, scope, platform){
    return items.filter(post => {
      const passScope = scope === "all" || post.channelType === scope;
      const passPlatform = platform === "all" || post.displayChannelName === platform;
      return passScope && passPlatform;
    });
  }
  function describeScope(scope, platform){
    const scopeLabel = scope === "all" ? "全部类型" : scope;
    const platformLabel = platform === "all" ? "全部平台" : platform;
    return `${scopeLabel} / ${platformLabel}`;
  }
  function metricInteraction(snapshot){ return Number(snapshot.likes || 0) + Number(snapshot.comments || 0) + Number(snapshot.shares || 0) + Number(snapshot.saves || 0); }
  function contentLabel(post){
    const parts = [];
    if (post.normalizedTopic) parts.push(post.normalizedTopic);
    if (post.normalizedFormat && !parts.includes(post.normalizedFormat)) parts.push(post.normalizedFormat);
    if (!parts.length) parts.push(post.displayChannelName);
    return parts.join(" · ") || post.platform || "未命名内容";
  }
  function normalizeDimension(value){
    if (!value) return "";
    const text = String(value).trim();
    if (!text || text === "未知" || text.toLowerCase() === "unknown") return "";
    return text;
  }
  function normalizeContentFormat(value){
    const raw = asText(value);
    if (!raw) return "";
    const text = raw.toLowerCase().replace(/\s+/g, "");
    if (text.includes("视频") || text.includes("video") || text.includes("reel") || text.includes("shorts") || text.includes("shortvideo")) return "视频";
    if (text.includes("图文") || text.includes("image") || text.includes("photo") || text.includes("picture") || text.includes("graphic") || text.includes("carousel")) return "图文";
    return "";
  }
  function parseReviewWindow(text){ const [start, end] = String(text).split("~").map(part => parseDate(part.trim())); return { start, end }; }
  function parseDate(text){ return new Date(`${text}T00:00:00`); }
  function toDateString(value){
    if (value instanceof Date && !Number.isNaN(value.getTime())) return formatDate(value);
    if (typeof value === "number") {
      const date = excelSerialToDate(value);
      if (date) return formatDate(date);
    }
    const text = asText(value);
    if (!text) return null;
    const normalized = text.replace(/[./]/g, "-").replace("T", " ").trim();
    const datePart = normalized.split(" ")[0];
    const candidate = new Date(datePart);
    if (!Number.isNaN(candidate.getTime())) return formatDate(candidate);
    const fallback = new Date(normalized);
    if (!Number.isNaN(fallback.getTime())) return formatDate(fallback);
    return null;
  }
  function excelSerialToDate(serial){
    if (!Number.isFinite(serial)) return null;
    const utcValue = Date.UTC(1899, 11, 30) + Math.round(serial * DAY_MS);
    const date = new Date(utcValue);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function asText(value){
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }
  function asNumber(value){
    if (value === null || value === undefined || value === "") return 0;
    const num = Number(String(value).replace(/,/g, "").replace(/%/g, ""));
    return Number.isFinite(num) ? num : 0;
  }
  function weekOfYear(date){
    const current = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    current.setUTCDate(current.getUTCDate() + 4 - (current.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(current.getUTCFullYear(), 0, 1));
    return Math.ceil((((current - yearStart) / DAY_MS) + 1) / 7);
  }
  function hashText(text){
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
  function cloneData(value){
    return JSON.parse(JSON.stringify(value));
  }
  function addDays(date, days){ return new Date(date.getTime() + days * DAY_MS); }
  function diffDays(start, end){ return Math.round((end.getTime() - start.getTime()) / DAY_MS); }
  function eachDate(start, end){
    const out = [];
    for (let day = new Date(start); day <= end; day = addDays(day, 1)) out.push(new Date(day));
    return out;
  }
  function inDateRange(date, start, end){ return date >= start && date <= end; }
  function safeRate(numerator, denominator){ return denominator ? numerator / denominator : 0; }
  function safeWoW(current, previous){ return previous ? (current / previous - 1) : 0; }
  function average(items, getter){ return items.length ? items.reduce((sumValue, item) => sumValue + getter(item), 0) / items.length : 0; }
  function sum(items, getter){ return items.reduce((sumValue, item) => sumValue + getter(item), 0); }
  function groupBy(items, keyGetter){
    return items.reduce((bucket, item) => {
      const key = keyGetter(item);
      if (!bucket[key]) bucket[key] = [];
      bucket[key].push(item);
      return bucket;
    }, {});
  }
  function latestSnapshotDate(items){
    let latest = null;
    (items || []).forEach(post => (post.snapshots || []).forEach(snapshot => {
      if (!latest || snapshot.dateObj > latest) latest = snapshot.dateObj;
    }));
    return latest;
  }
  function earliestSnapshotDate(items){
    let earliest = null;
    (items || []).forEach(post => (post.snapshots || []).forEach(snapshot => {
      if (!earliest || snapshot.dateObj < earliest) earliest = snapshot.dateObj;
    }));
    return earliest;
  }
  function median(values){
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }
  function batchLabelByAge(age){
    if (age <= 6) return "第1周";
    if (age <= 13) return "第2周";
    if (age <= 20) return "第3周";
    return "第4周";
  }
  function formatCompact(value){
    const n = Number(value || 0);
    if (Math.abs(n) >= 100000000) return `${(n / 100000000).toFixed(1)}亿`;
    if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(1)}万`;
    return `${Math.round(n)}`;
  }
  function formatInteger(value){
    const n = Math.max(0, Math.round(Number(value || 0)));
    return n.toLocaleString("zh-CN");
  }
  function formatPct(value){ return `${(Number(value || 0) * 100).toFixed(1)}%`; }
  function formatPctDelta(value){ const n = Number(value || 0) * 100; return `${n > 0 ? "+" : ""}${n.toFixed(1)} pct`; }
  function formatDeltaPercent(value){ const n = Number(value || 0) * 100; return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`; }
  function formatMetric(value, unit){ return unit === "%" ? `${Number(value || 0).toFixed(1)}%` : formatCompact(value); }
  function formatDate(date){ const y = date.getFullYear(); const m = `${date.getMonth() + 1}`.padStart(2, "0"); const d = `${date.getDate()}`.padStart(2, "0"); return `${y}-${m}-${d}`; }
  function formatMonthDay(date){ return formatDate(date).slice(5); }
  function formatDateRange(start, end){ return `${formatDate(start)} ~ ${formatDate(end)}`; }
  function classForDeltaValue(value){ if (value > 0.000001) return "delta-up"; if (value < -0.000001) return "delta-down"; return "delta-flat"; }
  function classForContributionGap(value){ if (value > 0.000001) return "delta-up"; if (value < -0.000001) return "delta-down"; return "delta-flat"; }
  function classForDeltaText(text){ if (String(text).startsWith("+")) return "delta-up"; if (String(text).startsWith("-")) return "delta-down"; return "delta-flat"; }
  function wrapEntity(text){ return `<span class="entity-pill">${escapeHtml(text)}</span>`; }
  function canonicalChannelName(value){
    const text = String(value || "").trim().toLowerCase();
    const map = { tk: "TikTok", tiktok: "TikTok", fb: "Facebook", facebook: "Facebook", ins: "Instagram", instagram: "Instagram", ig: "Instagram", yt: "YouTube", youtube: "YouTube" };
    return map[text] || String(value || "未知渠道");
  }

  function bindTooltip(){
    document.addEventListener("pointermove", event => {
      const target = event.target.closest("[data-tooltip]");
      if (!target) { dom.tooltip.hidden = true; return; }
      dom.tooltip.innerHTML = target.getAttribute("data-tooltip");
      dom.tooltip.hidden = false;
      dom.tooltip.style.left = `${event.clientX + 14}px`;
      dom.tooltip.style.top = `${event.clientY + 14}px`;
    });
    document.addEventListener("pointerleave", event => { if (!event.relatedTarget) dom.tooltip.hidden = true; });
  }

  function escapeHtml(value){
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
})();
