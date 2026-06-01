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
  const ANALYSIS_VIEWS = [
    { key: "overview", label: "总览", scope: "all", sections: ["overview", "insights"], firstSection: "section-overview" },
    { key: "community", label: "社群", scope: "社群", sections: ["overview", "insights", "lifecycle", "channel"], firstSection: "section-overview" },
    { key: "social", label: "社媒", scope: "社媒", sections: ["overview", "insights", "lifecycle", "channel"], firstSection: "section-overview" },
    { key: "kol", label: "KOL", scope: "KOL", sections: ["overview", "insights", "lifecycle", "channel"], firstSection: "section-overview" },
    { key: "offsite", label: "站外数据", scope: "all", sections: ["offsite", "quantity"], firstSection: "section-offsite" }
  ];
  const DONUT_COLORS = ["#2f607c", "#6f93aa", "#238672", "#9ab0bf", "#b98231", "#c65e54"];
  const MONTHLY_GOAL_STORAGE_KEY = "weekly-review-dashboard.monthly-goal-exposure-target";
  const MONTHLY_GOAL_SCOPE_STORAGE_PREFIX = "weekly-review-dashboard.monthly-goal-exposure-target.scope.v2.";
  const TOP_REVIEW_SUMMARY_STORAGE_PREFIX = "weekly-review-dashboard.top-review-summary";
  const OVERVIEW_PLAYBOOK_STORAGE_PREFIX = "weekly-review-dashboard.overview-playbook.longterm.v2";
  const OVERVIEW_PLAYBOOK_LEGACY_STORAGE_PREFIX = "weekly-review-dashboard.overview-playbook";
  const IMPORT_DB_NAME = "weekly-review-dashboard";
  const IMPORT_DB_VERSION = 1;
  const IMPORT_STORE_NAME = "imports";
  const BUILTIN_DATASET_TOKEN = `${initialSource.currentSample || "sample"}-${(initialSource.posts || []).length}`;
  const IMPORT_CACHE_KEY = `latest-import.${BUILTIN_DATASET_TOKEN}`;
  const IMPORT_FALLBACK_META_KEY = `weekly-review-dashboard.import-cache.${BUILTIN_DATASET_TOKEN}.meta`;
  const IMPORT_FALLBACK_CHUNK_PREFIX = `weekly-review-dashboard.import-cache.${BUILTIN_DATASET_TOKEN}.chunk.`;
  const IMPORT_FALLBACK_CHUNK_SIZE = 500000;

  const state = { view: "overview", scope: "all", platform: "all", granularity: "day", batchStartDate: "", batchEndDate: "", lifecycleMetric: "exposure" };
  let dataSourceLabel = "内置数据";
  let batchRangePickerAnchor = "";

  const dom = {
    tabStrip: document.getElementById("tab-strip"),
    heroMeta: document.getElementById("hero-meta"),
    scopeSelect: document.getElementById("scope-select"),
    platformSelect: document.getElementById("platform-select"),
    granularityToggle: document.getElementById("granularity-toggle"),
    controlNote: document.getElementById("control-note"),
    importBtn: document.getElementById("import-data-btn"),
    resetBtn: document.getElementById("reset-data-btn"),
    importInput: document.getElementById("import-file-input"),
    importStatus: document.getElementById("import-status"),
    goalWidget: document.getElementById("goal-widget"),
    metricGrid: document.getElementById("metric-grid"),
    insightGrid: document.getElementById("insight-grid"),
    overviewChannelPlaybook: document.getElementById("overview-channel-playbook"),
    lifecycleStack: document.getElementById("lifecycle-stack"),
    lifecycleTable: document.getElementById("lifecycle-table"),
    channelMatrix: document.getElementById("channel-matrix"),
    channelTable: document.getElementById("channel-table"),
    contentPanels: document.getElementById("content-panels"),
    lifecycleFormulaNote: document.querySelector(".lifecycle-formula-note"),
    contentPanelNote: document.querySelector("#section-content .sub-card-note"),
    businessReviewPanels: document.getElementById("business-review-panels"),
    dtcSummary: document.getElementById("dtc-summary"),
    dtcTable: document.getElementById("dtc-table"),
    brandVoice: document.getElementById("brand-voice"),
    tooltip: document.getElementById("tooltip")
  };

  let reviewWindow;
  let previousWindow;
  let poolWindow;
  let previousPoolWindow;
  let posts;
  let poolPosts;
  let previousPoolPosts;
  initDashboard();

  async function initDashboard(){
    const restoredImport = await loadPersistedImport();
    if (restoredImport && restoredImport.source) {
      source = mergeImportedSource(restoredImport.source);
      dataSourceLabel = "文件数据";
    }
    recomputeBaseWindows();
    initMonthlyGoalTarget();

    bindTooltip();
    bindTabs();
    bindDataImport();
    setImportStatus(restoredImport && restoredImport.source ? `已恢复导入 · ${source.posts.length}帖` : "内置数据");
    render();
  }

  function render(){
    syncScopeWithActiveView();
    renderVisibleSections();
    syncActiveTab();
    const filteredPosts = filterPostsByScope(poolPosts, state.scope, state.platform);
    const derived = buildDerived(filteredPosts);
    renderHero();
    renderControls();
    renderGoalWidget(derived);
    renderMetrics(derived);
    renderInsights(derived);
    renderOverviewChannelPlaybook();
    renderLifecycle(derived);
    renderLifecycleTable(derived);
    renderContextualNotes();
    renderChannelMatrix(derived);
    renderChannelTable(derived);
    renderContentPanels(derived);
    renderBusinessReview(derived);
    renderDtcSection();
    renderBrandVoice();
  }

  function renderPreservingScroll(){
    const scrollLeft = window.scrollX;
    const scrollTop = window.scrollY;
    render();
    requestAnimationFrame(() => {
      window.scrollTo({ left: scrollLeft, top: scrollTop, behavior: "auto" });
    });
  }

  function getActiveView(){
    return ANALYSIS_VIEWS.find(view => view.key === state.view) || ANALYSIS_VIEWS[0];
  }

  function isCommunityView(){
    return state.scope === "社群" || state.view === "community";
  }

  function syncScopeWithActiveView(){
    const view = getActiveView();
    state.scope = view.scope;
    if (view.key === "overview" || view.key === "offsite") {
      state.platform = "all";
    }
  }

  function renderVisibleSections(){
    const view = getActiveView();
    const visibleSections = new Set(view.sections);
    document.querySelectorAll("[data-analysis-section]").forEach(section => {
      section.hidden = !visibleSections.has(section.dataset.analysisSection);
    });
  }

  function renderContextualNotes(){
    if (dom.lifecycleFormulaNote) {
      dom.lifecycleFormulaNote.textContent = isCommunityView()
        ? "备注：互动贡献率 = 批次本周总互动 ÷ 全部批次本周总互动。社群只按本周互动记录复盘。"
        : "备注：曝光贡献率 = 批次本周曝光 ÷ 全部批次本周曝光；互动贡献率 = 批次本周总互动 ÷ 全部批次本周总互动。";
    }
    if (dom.contentPanelNote) {
      dom.contentPanelNote.textContent = isCommunityView()
        ? "互动 Top / 主题参考 / 待复盘内容"
        : "曝光 Top / 互动 Top / 互动率 Top / 高曝光低互动";
    }
  }

  function recomputeBaseWindows(){
    reviewWindow = parseReviewWindow(source.reviewWeek.dateRange);
    previousWindow = { start: addDays(reviewWindow.start, -7), end: addDays(reviewWindow.end, -7) };
    const monthStart = new Date(reviewWindow.end.getFullYear(), reviewWindow.end.getMonth(), 1);
    poolWindow = { start: monthStart, end: reviewWindow.end };
    previousPoolWindow = { start: addMonths(poolWindow.start, -1), end: addMonths(poolWindow.end, -1) };
    posts = preprocessPosts(source.posts || []);
    poolPosts = posts.filter(post => inDateRange(post.publishDateObj, poolWindow.start, poolWindow.end));
    previousPoolPosts = posts.filter(post => inDateRange(post.publishDateObj, previousPoolWindow.start, previousPoolWindow.end));
    if (!state.batchStartDate) state.batchStartDate = formatDate(poolWindow.start);
    if (!state.batchEndDate) state.batchEndDate = formatDate(poolWindow.end);
  }

  function buildDerived(filteredPosts){
    const scopedAllPosts = filterPostsByScope(posts || [], state.scope, state.platform);
    const previousFilteredPosts = filterPostsByScope(previousPoolPosts || [], state.scope, state.platform);
    const currentTotals = sumPostsForRange(filteredPosts, reviewWindow.start, reviewWindow.end);
    const previousTotals = sumPostsForRange(filteredPosts, previousWindow.start, previousWindow.end);
    const currentPostCount = countPostsForRange(filteredPosts, reviewWindow.start, reviewWindow.end);
    const previousPostCount = countPostsForRange(filteredPosts, previousWindow.start, previousWindow.end);
    const monthStart = new Date(reviewWindow.end.getFullYear(), reviewWindow.end.getMonth(), 1);
    const monthToDateTotals = sumPostsForRange(filteredPosts, monthStart, reviewWindow.end);
    const channelRows = buildChannelRows(filteredPosts, currentTotals);
    const channelContributionRows = buildChannelContributionRows(filteredPosts, currentTotals);
    const { start: batchStart, end: batchEnd } = resolveBatchDateRange(state.batchStartDate, state.batchEndDate);
    state.batchStartDate = formatDate(batchStart);
    state.batchEndDate = formatDate(batchEnd);
    const batchFilteredPosts = filterPostsByPublishDateRange(scopedAllPosts, batchStart, batchEnd);
    const batchRows = buildBatchRows(batchFilteredPosts);
    const batchPublishSummary = buildBatchPublishSummary(batchFilteredPosts, batchStart, batchEnd);
    const contentItems = buildContentItems(filteredPosts, currentTotals);
    const previousContentItems = buildContentItems(filteredPosts, previousTotals, previousWindow.start, previousWindow.end);
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
      batchPublishSummary,
      contentItems,
      previousContentItems,
      lineSeries: buildLineSeries(filteredPosts, previousFilteredPosts, state.granularity),
      exposureDonutRows: buildContributionRows(channelContributionRows, "exposure", currentTotals.exposure),
      interactionDonutRows: buildContributionRows(channelContributionRows, "interaction", currentTotals.interaction),
      batchExposureDonutRows: buildContributionRows(batchRows, "currentExposure", currentTotals.exposure),
      batchInteractionDonutRows: buildContributionRows(batchRows, "currentInteraction", currentTotals.interaction)
    };
  }

  function renderGoalWidget(derived){
    if (!dom.goalWidget) return;
    if (isCommunityView()) {
      dom.goalWidget.hidden = true;
      dom.goalWidget.innerHTML = "";
      return;
    }
    dom.goalWidget.hidden = false;
    const goalContext = resolveMonthlyGoalTarget(derived);
    const target = goalContext.target;
    const hasTarget = goalContext.target !== null;
    const actual = Math.max(0, asNumber(derived.currentTotals.exposure));
    const rawProgress = hasTarget && target > 0 ? (actual / target) : 0;
    const barProgress = Math.min(1, Math.max(0, rawProgress));
    const progressClass = rawProgress >= 1 ? "is-complete" : (rawProgress >= 0.7 ? "is-good" : "is-normal");
    const targetText = hasTarget ? formatCompact(target) : "未设置";
    const progressText = hasTarget ? formatPct(rawProgress) : "待补充";
    dom.goalWidget.innerHTML = `
      <div class="goal-row">
        <div class="goal-title">${escapeHtml(goalContext.label)}</div>
        <div class="goal-progress-wrap">
          <div class="goal-progress" aria-label="${escapeHtml(goalContext.label)}进度条">
            <div class="goal-progress-bar ${progressClass}" style="width:${(barProgress * 100).toFixed(1)}%"></div>
          </div>
        </div>
        <div class="goal-summary">
          <span class="goal-summary-label">曝光实际值</span>
          <strong class="goal-summary-value">${formatCompact(actual)}</strong>
          <span class="goal-summary-target">/ 目标 ${targetText} · ${progressText}</span>
        </div>
        <div class="goal-edit">
          <span class="goal-edit-prefix">目标</span>
        <input class="goal-input" id="goal-input" type="text" inputmode="numeric" value="${hasTarget ? escapeHtml(formatInteger(target)) : ""}" placeholder="未设置" aria-label="编辑${escapeHtml(goalContext.label)}曝光">
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
    const goalKey = getMonthlyGoalKey(state.scope, state.platform);
    if (goalKey === "all__all") {
      source.monthlyGoal.exposureTarget = numeric;
    } else {
      if (!source.monthlyGoal.channelTargets || typeof source.monthlyGoal.channelTargets !== "object") {
        source.monthlyGoal.channelTargets = {};
      }
      source.monthlyGoal.channelTargets[goalKey] = numeric;
    }
    saveMonthlyGoalTarget(goalKey, numeric);
    render();
  }

  function initMonthlyGoalTarget(){
    const stored = loadMonthlyGoalTarget("all__all");
    if (stored === null) return;
    if (!source.monthlyGoal) source.monthlyGoal = {};
    source.monthlyGoal.exposureTarget = stored;
  }

  function loadMonthlyGoalTarget(goalKey){
    try {
      const storageKey = goalKey === "all__all" ? MONTHLY_GOAL_STORAGE_KEY : `${MONTHLY_GOAL_SCOPE_STORAGE_PREFIX}${goalKey}`;
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return null;
      const numeric = Math.max(0, Math.round(asNumber(raw)));
      return Number.isFinite(numeric) ? numeric : null;
    } catch (error) {
      return null;
    }
  }

  function saveMonthlyGoalTarget(goalKey, value){
    try {
      const storageKey = goalKey === "all__all" ? MONTHLY_GOAL_STORAGE_KEY : `${MONTHLY_GOAL_SCOPE_STORAGE_PREFIX}${goalKey}`;
      localStorage.setItem(storageKey, String(Math.max(0, Math.round(asNumber(value)))));
    } catch (error) {
      // ignore storage errors
    }
  }

  function resolveMonthlyGoalTarget(derived){
    const goalKey = getMonthlyGoalKey(state.scope, state.platform);
    const label = getMonthlyGoalLabel(state.scope, state.platform);
    const stored = loadMonthlyGoalTarget(goalKey);
    if (stored !== null) return { key: goalKey, label, target: stored, source: "stored" };
    const configured = getConfiguredMonthlyGoalTarget(goalKey, state.scope, state.platform);
    if (configured !== null) return { key: goalKey, label, target: configured, source: "configured" };
    return { key: goalKey, label, target: null, source: "unset" };
  }

  function getMonthlyGoalKey(scope, platform){
    const safeScope = scope || "all";
    const safePlatform = platform || "all";
    return `${safeScope}__${safePlatform}`;
  }

  function getMonthlyGoalLabel(scope, platform){
    if (scope === "all" && platform === "all") return "总月目标";
    if (platform && platform !== "all") return `${platform}月目标`;
    return `${scope}月目标`;
  }

  function getConfiguredMonthlyGoalTarget(goalKey, scope, platform){
    const monthlyGoal = source.monthlyGoal || {};
    if (goalKey === "all__all") {
      const totalTarget = Math.max(0, asNumber(monthlyGoal.exposureTarget));
      return Number.isFinite(totalTarget) ? totalTarget : null;
    }
    const targetMaps = [
      monthlyGoal.channelTargets,
      monthlyGoal.targetsByScope,
      monthlyGoal.targetsByChannel
    ].filter(map => map && typeof map === "object");
    for (const targetMap of targetMaps) {
      const direct = readGoalTargetValue(targetMap[goalKey]);
      if (direct !== null) return direct;
      if (platform && platform !== "all") {
        const platformDirect = readGoalTargetValue(targetMap[platform]);
        if (platformDirect !== null) return platformDirect;
        const nestedScope = targetMap[scope];
        const nestedPlatform = nestedScope && typeof nestedScope === "object" ? readGoalTargetValue(nestedScope[platform]) : null;
        if (nestedPlatform !== null) return nestedPlatform;
        const nestedPlatforms = nestedScope && typeof nestedScope === "object" && nestedScope.platforms ? readGoalTargetValue(nestedScope.platforms[platform]) : null;
        if (nestedPlatforms !== null) return nestedPlatforms;
      }
      const scopeDirect = readGoalTargetValue(targetMap[scope]);
      if (scopeDirect !== null) return scopeDirect;
    }
    return null;
  }

  function readGoalTargetValue(value){
    if (value == null) return null;
    if (typeof value === "object") {
      return readGoalTargetValue(value.exposureTarget ?? value.target ?? value.value);
    }
    const numeric = Math.max(0, Math.round(asNumber(value)));
    return Number.isFinite(numeric) ? numeric : null;
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
        displayChannelName: displayChannelNameForPost(post),
        normalizedTopic: normalizeDimension(post.contentTopic),
        normalizedFormat: normalizeContentFormat(post.contentFormat)
      };
    });
  }

  function renderHero(){
    const generatedDate = toDateString(source.generatedAt) || asText(source.generatedAt) || formatDate(new Date());
    dom.heroMeta.innerHTML = [
      heroMetaCard("复盘周期", String(source.reviewWeek.dateRange || "").replace(/\s+/g, "")),
      heroMetaCard("样本池", `${formatDate(poolWindow.start)}~${formatDate(poolWindow.end)} 发布`),
      heroMetaCard("数据时间", `${generatedDate} · ${dataSourceLabel}`)
    ].join("");
  }

  function renderControls(){
    const activeView = getActiveView();
    renderSelect(dom.scopeSelect, CHANNEL_SCOPE_OPTIONS, state.scope, key => {
      const nextView = ANALYSIS_VIEWS.find(view => view.scope === key && view.key !== "offsite") || ANALYSIS_VIEWS[0];
      state.view = nextView.key;
      state.platform = "all";
      renderPreservingScroll();
    });
    const platformOptions = getPlatformOptions(poolPosts, state.scope);
    if (!platformOptions.find(option => option.key === state.platform)) {
      state.platform = "all";
    }
    renderSelect(dom.platformSelect, platformOptions, state.platform, key => {
      state.platform = key;
      renderPreservingScroll();
    });
    renderSegmented(dom.granularityToggle, GRANULARITY_OPTIONS, state.granularity, key => {
      state.granularity = key;
      renderPreservingScroll();
    });
    setControlGroupVisibility(".control-group-scope", false);
    setControlGroupVisibility(".control-group-platform", activeView.key === "community" || activeView.key === "social" || activeView.key === "kol");
    setControlGroupVisibility(".control-group-granularity", activeView.key === "community" || activeView.key === "social" || activeView.key === "kol");
    if (dom.controlNote) dom.controlNote.textContent = "";
  }

  function renderMetrics(derived){
    const goalContext = resolveMonthlyGoalTarget(derived);
    const goalProgressText = goalContext.target !== null
      ? formatPct(safeRate(derived.currentTotals.exposure, goalContext.target))
      : "待补充";
    const cards = isCommunityView() ? buildCommunityMetricCards(derived) : [
      {
        label: "样本帖子数",
        value: String(derived.filteredPosts.length),
        delta: "固定口径",
        helper: "自然月发布帖子",
        tooltip: `帖子口径：自然月（当月1日~复盘结束日）发布<br>当前筛选：${describeScope(state.scope, state.platform)}<br>项目挂靠：${sum(derived.filteredPosts, p => p.projectLinks || 0)}`
      },
      {
        label: "本周曝光",
        value: formatCompact(derived.currentTotals.exposure),
        delta: formatDeltaPercent(safeWoW(derived.currentTotals.exposure, derived.previousTotals.exposure)),
        helper: "当前自然周 vs 上一自然周",
        tooltip: `上周曝光：${formatCompact(derived.previousTotals.exposure)}<br>${escapeHtml(goalContext.label)}对比：${goalProgressText}`
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

  function buildCommunityMetricCards(derived){
    const currentPerPost = safeRate(derived.currentTotals.interaction, derived.currentPostCount);
    const previousPerPost = safeRate(derived.previousTotals.interaction, derived.previousPostCount);
    const topItems = [...derived.contentItems].sort((a, b) => b.interaction - a.interaction).slice(0, 5);
    const topInteraction = sum(topItems, item => item.interaction);
    const activeChannels = derived.channelRows.filter(row => row.interaction > 0).length;
    return [
      {
        label: "样本帖子数",
        value: String(derived.filteredPosts.length),
        delta: "固定口径",
        helper: "自然月发布帖子",
        tooltip: `帖子口径：自然月（当月1日~复盘结束日）发布<br>当前筛选：${describeScope(state.scope, state.platform)}<br>项目挂靠：${sum(derived.filteredPosts, p => p.projectLinks || 0)}`
      },
      {
        label: "本周总互动",
        value: formatCompact(derived.currentTotals.interaction),
        delta: formatDeltaPercent(safeWoW(derived.currentTotals.interaction, derived.previousTotals.interaction)),
        helper: "社群按互动口径复盘",
        tooltip: `上周总互动：${formatCompact(derived.previousTotals.interaction)}<br>口径：likes + comments + shares + saves`
      },
      {
        label: "贴均互动",
        value: formatCompact(currentPerPost),
        delta: formatDeltaPercent(safeWoW(currentPerPost, previousPerPost)),
        helper: "本周总互动 ÷ 本周帖子数",
        tooltip: `本周帖子数：${derived.currentPostCount}<br>上周帖子数：${derived.previousPostCount}<br>上周贴均互动：${formatCompact(previousPerPost)}`
      },
      {
        label: "活跃社群数",
        value: String(activeChannels),
        delta: "互动>0",
        helper: "本周有互动记录的社群",
        tooltip: `社群维度：${activeChannels} 个<br>用于判断互动是否集中在少数社群`
      },
      {
        label: "Top5互动占比",
        value: formatPct(safeRate(topInteraction, derived.currentTotals.interaction)),
        delta: "集中度",
        helper: "Top内容互动 ÷ 本周总互动",
        tooltip: `Top5互动：${formatCompact(topInteraction)}<br>本周总互动：${formatCompact(derived.currentTotals.interaction)}`
      }
    ];
  }

  function renderInsights(derived){
    if (isCommunityView()) {
      const topChannel = [...derived.channelRows].sort((a, b) => b.interaction - a.interaction)[0];
      const topItems = [...derived.contentItems].sort((a, b) => b.interaction - a.interaction).slice(0, 5);
      const topShare = safeRate(sum(topItems, item => item.interaction), derived.currentTotals.interaction);
      const currentPerPost = safeRate(derived.currentTotals.interaction, derived.currentPostCount);
      const previousPerPost = safeRate(derived.previousTotals.interaction, derived.previousPostCount);
      const cards = [
        {
          tag: "主要来源",
          title: `本周互动主要来自 ${wrapEntity(topChannel?.label || "暂无数据")}`,
          body: `${topChannel?.label || "暂无数据"} 互动占比 ${formatPct(topChannel?.interactionShare || 0)}，可优先让负责人补充内容复盘。`
        },
        {
          tag: "内容集中度",
          title: `Top 5 内容贡献 ${formatPct(topShare)} 互动`,
          body: topShare >= 0.65 ? "互动集中在少数内容，建议重点看标题、话题、发布时间和负责人总结。" : "互动分布相对分散，可按主题和负责人维度继续归因。"
        },
        {
          tag: "效率观察",
          title: `贴均互动 ${formatCompact(currentPerPost)}`,
          body: `较上周 ${formatDeltaPercent(safeWoW(currentPerPost, previousPerPost))}；用于判断变化来自内容数量，还是单帖互动质量。`
        }
      ];
      dom.insightGrid.innerHTML = cards.map(card => `
        <article class="insight-card">
          <span class="insight-tag">${escapeHtml(card.tag)}</span>
          <div class="insight-title">${card.title}</div>
          <div class="insight-body">${card.body}</div>
        </article>
      `).join("");
      return;
    }
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

  function renderOverviewChannelPlaybook(){
    if (!dom.overviewChannelPlaybook) return;
    if (state.view !== "overview") {
      dom.overviewChannelPlaybook.hidden = true;
      dom.overviewChannelPlaybook.innerHTML = "";
      return;
    }
    dom.overviewChannelPlaybook.hidden = false;
    const rows = buildOverviewPlaybookRows();
    dom.overviewChannelPlaybook.innerHTML = `<div class="playbook-head">
      <div>
        <h3>长期复盘沉淀</h3>
        <span>按渠道长期保存可复用经验、避雷点和下周验证动作；切换周期或重新导入数据不会覆盖。</span>
      </div>
      <span class="playbook-persistence-badge">本机长期保存</span>
    </div>
    <div class="playbook-grid">
      ${rows.map(row => overviewPlaybookCard(row)).join("")}
    </div>`;
    bindOverviewPlaybookInputs();
  }

  function buildOverviewPlaybookRows(){
    const channelConfigs = [
      { key: "community", label: "社群", scope: "社群", metric: "interaction" },
      { key: "social", label: "社媒", scope: "社媒", metric: "exposure" },
      { key: "kol", label: "KOL", scope: "KOL", metric: "exposure" }
    ];
    const channelRows = channelConfigs.map(config => {
      const channelPosts = filterPostsByScope(poolPosts || [], config.scope, "all");
      const totals = sumPostsForRange(channelPosts, reviewWindow.start, reviewWindow.end);
      const postCount = countPostsForRange(channelPosts, reviewWindow.start, reviewWindow.end);
      const channelDerived = {
        currentTotals: totals,
        channelRows: buildChannelRows(channelPosts, totals),
        contentItems: buildContentItems(channelPosts, totals)
      };
      const topUnit = [...channelDerived.channelRows]
        .sort((a, b) => (config.metric === "interaction" ? b.interaction - a.interaction : b.exposure - a.exposure))[0];
      const topContent = [...channelDerived.contentItems]
        .sort((a, b) => (config.metric === "interaction" ? b.interaction - a.interaction : b.exposure - a.exposure))[0];
      const signal = config.metric === "interaction"
        ? `本周总互动 ${formatCompact(totals.interaction)}，帖子 ${postCount} 条${topUnit ? `，主要来自 ${topUnit.platform}` : ""}`
        : `本周曝光 ${formatCompact(totals.exposure)}，帖子 ${postCount} 条${topUnit ? `，主要来自 ${topUnit.platform}` : ""}`;
      const topContentLine = topContent ? `Top内容：${topContent.label}` : "Top内容：暂无足够数据";
      return { ...config, signal, topContentLine };
    });
    const dtc = source.dtcSection || { totalCurrent: 0, rows: [] };
    const topOffsite = [...(dtc.rows || [])].sort((a, b) => Number(b.current || 0) - Number(a.current || 0))[0];
    return [
      ...channelRows,
      {
        key: "offsite",
        label: "站外数据",
        signal: `本周站外曝光 ${formatCompact(Number(dtc.totalCurrent || 0))}${topOffsite ? `，主要来源 ${topOffsite.label}` : ""}`,
        topContentLine: topOffsite ? `Top来源：${topOffsite.site || topOffsite.channel || topOffsite.label}` : "Top来源：暂无足够数据"
      }
    ];
  }

  function overviewPlaybookCard(row){
    const reuseKey = overviewPlaybookStorageKey(row.key, "reuse");
    const riskKey = overviewPlaybookStorageKey(row.key, "risk");
    const nextKey = overviewPlaybookStorageKey(row.key, "next");
    const reuseLegacyKey = overviewPlaybookLegacyStorageKey(row.key, "reuse");
    const riskLegacyKey = overviewPlaybookLegacyStorageKey(row.key, "risk");
    const nextLegacyKey = overviewPlaybookLegacyStorageKey(row.key, "next");
    const savedCount = [reuseKey, riskKey, nextKey]
      .map((key, index) => loadOverviewPlaybookNote(key, [reuseLegacyKey, riskLegacyKey, nextLegacyKey][index]))
      .filter(Boolean).length;
    return `<article class="playbook-card">
      <div class="playbook-card-head">
        <div>
          <strong>${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(row.signal)}</span>
        </div>
        <em class="playbook-save-state" data-playbook-status="${escapeHtml(row.key)}">${savedCount ? `已沉淀 ${savedCount} 项` : "待沉淀"}</em>
      </div>
      <div class="playbook-signal">${escapeHtml(row.topContentLine)}</div>
      <label class="playbook-field">
        <span>可复用经验</span>
        <textarea data-playbook-key="${escapeHtml(reuseKey)}" data-playbook-channel="${escapeHtml(row.key)}" rows="3" placeholder="长期保留：可持续复用的内容形式、话题、发布时间、渠道打法或协作方式。">${escapeHtml(loadOverviewPlaybookNote(reuseKey, reuseLegacyKey))}</textarea>
      </label>
      <label class="playbook-field">
        <span>避雷区</span>
        <textarea data-playbook-key="${escapeHtml(riskKey)}" data-playbook-channel="${escapeHtml(row.key)}" rows="3" placeholder="长期保留：不建议继续复制的问题、低效动作、口径风险或执行注意事项。">${escapeHtml(loadOverviewPlaybookNote(riskKey, riskLegacyKey))}</textarea>
      </label>
      <label class="playbook-field">
        <span>下周验证</span>
        <textarea data-playbook-key="${escapeHtml(nextKey)}" data-playbook-channel="${escapeHtml(row.key)}" rows="3" placeholder="写成可验证动作：下周要继续验证什么、看哪个指标、由谁跟进。">${escapeHtml(loadOverviewPlaybookNote(nextKey, nextLegacyKey))}</textarea>
      </label>
    </article>`;
  }

  function bindOverviewPlaybookInputs(){
    if (!dom.overviewChannelPlaybook) return;
    dom.overviewChannelPlaybook.querySelectorAll("[data-playbook-key]").forEach(textarea => {
      textarea.addEventListener("input", () => {
        saveOverviewPlaybookNote(textarea.dataset.playbookKey, textarea.value);
        updateOverviewPlaybookStatus(textarea.dataset.playbookChannel);
      });
    });
  }

  function renderLifecycle(derived){
    const granularityLabel = state.granularity === "week" ? "周" : "天";
    const batchRowsView = withBatchFilterState(derived.batchRows);
    const community = isCommunityView();
    const lifecycleMetricOptions = community ? [
      { key: "postCount", label: "帖子发布数", formatter: formatInteger, primaryLabel: "当前累计发帖数", secondaryLabel: "上月累计发帖数", showPostCounter: false },
      { key: "interaction", label: "互动量", formatter: formatCompact, primaryLabel: "当前累计互动", secondaryLabel: "上月累计互动", showPostCounter: true }
    ] : [
      { key: "postCount", label: "帖子发布数", formatter: formatInteger, primaryLabel: "当前累计发帖数", secondaryLabel: "上月累计发帖数", showPostCounter: false },
      { key: "interaction", label: "互动量", formatter: formatCompact, primaryLabel: "当前累计互动", secondaryLabel: "上月累计互动", showPostCounter: true },
      { key: "perPostExposure", label: "贴均曝光", formatter: formatCompact, primaryLabel: "当前贴均曝光", secondaryLabel: "上月贴均曝光", showPostCounter: false },
      { key: "exposure", label: "曝光", formatter: formatCompact, primaryLabel: "当前累计曝光", secondaryLabel: "上月累计曝光", showPostCounter: true }
    ];
    const activeLifecycleMetric = lifecycleMetricOptions.find(option => option.key === state.lifecycleMetric) || (community ? lifecycleMetricOptions[1] : lifecycleMetricOptions[lifecycleMetricOptions.length - 1]);
    const activeLineSeries = derived.lineSeries[activeLifecycleMetric.key] || derived.lineSeries.interaction || derived.lineSeries.exposure;
    dom.lifecycleStack.innerHTML = `<div class="lifecycle-chart-grid">
      <section class="lifecycle-chart-panel lifecycle-trend-panel">
        <div class="sub-card-head">
          <div>
            <h3>${community ? "互动走势" : "曝光走势"}</h3>
            <span class="sub-card-note">折线粒度：${granularityLabel}（实线当前累计，虚线上月累计）</span>
          </div>
          <div class="lifecycle-metric-filters" id="lifecycle-metric-filters">
            ${lifecycleMetricOptions.map(option => `<button class="lifecycle-metric-btn ${option.key === activeLifecycleMetric.key ? "is-active" : ""}" type="button" data-key="${option.key}">${escapeHtml(option.label)}</button>`).join("")}
          </div>
        </div>
        <div class="lifecycle-trend-body">
        ${buildLineChartSvg({
          title: `${activeLifecycleMetric.label}走势（${granularityLabel}粒度）`,
          labels: activeLineSeries.labels,
          tooltipLabels: activeLineSeries.tooltipLabels,
          primary: activeLineSeries.current,
          secondary: activeLineSeries.previous,
          currentPosts: activeLineSeries.currentPosts,
          previousPosts: activeLineSeries.previousPosts,
          showPostsInfo: activeLifecycleMetric.showPostCounter,
          primaryLabel: activeLifecycleMetric.primaryLabel,
          secondaryLabel: activeLifecycleMetric.secondaryLabel,
          formatter: activeLifecycleMetric.formatter
        })}
        </div>
      </section>
      <section class="lifecycle-chart-panel lifecycle-contribution-panel">
        <div class="sub-card-head">
          <div>
            <h3>批次贡献</h3>
            <span class="sub-card-note">样本：${escapeHtml(derived.batchPublishSummary)}；展示该样本发布后第1-4周流程（无数据灰显）</span>
          </div>
          <div class="batch-range-picker" id="batch-range-picker">
          <label class="batch-week-filter" for="batch-range-trigger">
            <button id="batch-range-trigger" class="batch-range-input" type="button">${escapeHtml(`${state.batchStartDate} — ${state.batchEndDate}`)}</button>
          </label>
          <div id="batch-range-panel" class="batch-range-panel" hidden></div>
          </div>
        </div>
        ${buildBatchContributionChartSvg(batchRowsView, community)}
      </section>
    </div>`;
    const lifecycleMetricFilters = dom.lifecycleStack.querySelector("#lifecycle-metric-filters");
    if (lifecycleMetricFilters) {
      lifecycleMetricFilters.querySelectorAll(".lifecycle-metric-btn").forEach(button => {
        button.addEventListener("click", event => {
          event.preventDefault();
          const key = button.dataset.key;
          if (!key || key === state.lifecycleMetric) return;
          state.lifecycleMetric = key;
          render();
        });
      });
    }
    setupBatchRangePicker();
  }

  function setupBatchRangePicker(){
    const picker = dom.lifecycleStack.querySelector("#batch-range-picker");
    const trigger = dom.lifecycleStack.querySelector("#batch-range-trigger");
    const panel = dom.lifecycleStack.querySelector("#batch-range-panel");
    if (!picker || !trigger || !panel) return;
    if (!batchRangePickerAnchor) batchRangePickerAnchor = `${state.batchStartDate.slice(0, 7)}-01`;
    let draftStart = state.batchStartDate;
    let draftEnd = state.batchEndDate;
    let outsidePointerHandler = null;
    let escapeKeyHandler = null;
    const openPanel = () => {
      panel.hidden = false;
      renderBatchRangePanel(panel, draftStart, draftEnd, batchRangePickerAnchor);
      outsidePointerHandler = event => {
        if (!picker.contains(event.target)) closePanel();
      };
      escapeKeyHandler = event => {
        if (event.key === "Escape") closePanel();
      };
      window.setTimeout(() => {
        document.addEventListener("pointerdown", outsidePointerHandler);
        document.addEventListener("keydown", escapeKeyHandler);
      }, 0);
    };
    const closePanel = () => {
      panel.hidden = true;
      if (outsidePointerHandler) {
        document.removeEventListener("pointerdown", outsidePointerHandler);
        outsidePointerHandler = null;
      }
      if (escapeKeyHandler) {
        document.removeEventListener("keydown", escapeKeyHandler);
        escapeKeyHandler = null;
      }
    };
    trigger.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (panel.hidden) openPanel();
      else closePanel();
    });
    panel.addEventListener("click", event => {
      const target = event.target.closest("[data-action]");
      if (!target) return;
      const action = target.dataset.action;
      if (action === "prev-month") {
        batchRangePickerAnchor = formatDate(new Date(addMonths(parseDate(batchRangePickerAnchor), -1))).slice(0, 7) + "-01";
        renderBatchRangePanel(panel, draftStart, draftEnd, batchRangePickerAnchor);
        return;
      }
      if (action === "next-month") {
        batchRangePickerAnchor = formatDate(new Date(addMonths(parseDate(batchRangePickerAnchor), 1))).slice(0, 7) + "-01";
        renderBatchRangePanel(panel, draftStart, draftEnd, batchRangePickerAnchor);
        return;
      }
      if (action === "pick-day") {
        const day = target.dataset.day;
        if (!day) return;
        if (!draftStart || draftEnd) {
          draftStart = day;
          draftEnd = "";
          renderBatchRangePanel(panel, draftStart, draftEnd, batchRangePickerAnchor);
          return;
        }
        const { start, end } = resolveBatchDateRange(draftStart, day);
        state.batchStartDate = formatDate(start);
        state.batchEndDate = formatDate(end);
        batchRangePickerAnchor = `${state.batchStartDate.slice(0, 7)}-01`;
        closePanel();
        render();
        return;
      }
      if (action === "shortcut") {
        const key = target.dataset.key;
        const shortcut = resolveBatchShortcutRange(key);
        state.batchStartDate = formatDate(shortcut.start);
        state.batchEndDate = formatDate(shortcut.end);
        batchRangePickerAnchor = `${state.batchStartDate.slice(0, 7)}-01`;
        closePanel();
        render();
      }
    });
  }

  function renderBatchRangePanel(panel, startText, endText, anchorText){
    const anchor = parseDate(anchorText);
    const right = addMonths(anchor, 1);
    const startDate = startText ? parseDate(startText) : null;
    const endDate = endText ? parseDate(endText) : null;
    panel.innerHTML = `
      <div class="range-panel-header">
        <button type="button" class="range-nav-btn" data-action="prev-month">‹</button>
        <span>${escapeHtml(formatYearMonth(anchor))}</span>
        <span>${escapeHtml(formatYearMonth(right))}</span>
        <button type="button" class="range-nav-btn" data-action="next-month">›</button>
      </div>
      <div class="range-cal-wrap">
        ${renderRangeMonth(anchor, startDate, endDate)}
        ${renderRangeMonth(right, startDate, endDate)}
      </div>
      <div class="range-shortcuts">
        <button type="button" data-action="shortcut" data-key="week">本周</button>
        <button type="button" data-action="shortcut" data-key="month">本月</button>
        <button type="button" data-action="shortcut" data-key="quarter">本季度</button>
        <button type="button" data-action="shortcut" data-key="year">今年</button>
      </div>
      <div class="range-tip">先点开始日期，再点结束日期</div>
    `;
  }

  function renderRangeMonth(monthStart, startDate, endDate){
    const firstWeekday = (monthStart.getDay() + 6) % 7;
    const monthDays = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const prevMonthDays = new Date(monthStart.getFullYear(), monthStart.getMonth(), 0).getDate();
    const weekHeader = ["一","二","三","四","五","六","日"].map(d => `<span>${d}</span>`).join("");
    const cells = [];
    for (let i = 0; i < 42; i += 1) {
      let dayNum;
      let dateObj;
      let outMonth = false;
      if (i < firstWeekday) {
        dayNum = prevMonthDays - firstWeekday + i + 1;
        dateObj = new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, dayNum);
        outMonth = true;
      } else if (i < firstWeekday + monthDays) {
        dayNum = i - firstWeekday + 1;
        dateObj = new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNum);
      } else {
        dayNum = i - firstWeekday - monthDays + 1;
        dateObj = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, dayNum);
        outMonth = true;
      }
      const dayText = formatDate(dateObj);
      const inRange = startDate && endDate && dateObj >= startDate && dateObj <= endDate;
      const isStart = startDate && dayText === formatDate(startDate);
      const isEnd = endDate && dayText === formatDate(endDate);
      const classes = [
        "range-day",
        outMonth ? "is-out" : "",
        inRange ? "is-in-range" : "",
        (isStart || isEnd) ? "is-edge" : ""
      ].filter(Boolean).join(" ");
      cells.push(`<button type="button" class="${classes}" data-action="pick-day" data-day="${dayText}">${dayNum}</button>`);
    }
    return `<div class="range-month">
      <div class="range-week-head">${weekHeader}</div>
      <div class="range-days-grid">${cells.join("")}</div>
    </div>`;
  }

  function resolveBatchShortcutRange(key){
    const now = reviewWindow.end;
    if (key === "week") {
      const day = (now.getDay() + 6) % 7;
      const start = addDays(now, -day);
      const end = addDays(start, 6);
      return { start, end };
    }
    if (key === "month") {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
    }
    if (key === "quarter") {
      const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
      return { start: new Date(now.getFullYear(), quarterMonth, 1), end: new Date(now.getFullYear(), quarterMonth + 3, 0) };
    }
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
  }

  function renderLifecycleTable(derived){
    if (isCommunityView()) {
      const headers = ["批次","发布时间范围","总互动","互动贡献率","贴均互动","诊断标签"];
      const rows = withBatchFilterState(derived.batchRows).map(row => `<tr class="${row.isMuted ? "batch-row-muted" : ""}">
        <td>${escapeHtml(row.label)}</td>
        <td>${escapeHtml(row.dateRangeLabel)}<br><span class="chart-note">${escapeHtml(row.rangeLabel)}</span></td>
        <td>${formatCompact(row.currentInteraction)}</td>
        <td>${formatPct(row.currentInteractionShare)}</td>
        <td>${formatCompact(row.currentPerPostInteraction || 0)}</td>
        <td>${renderCommunityBatchTag(row.currentInteractionShare)}</td>
      </tr>`).join("");
      dom.lifecycleTable.innerHTML = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows}</tbody>`;
      return;
    }
    const headers = ["批次","发布时间范围","曝光","曝光贡献率","总互动","互动贡献率","互动率","贡献差","诊断标签"];
    const rows = withBatchFilterState(derived.batchRows).map(row => `<tr class="${row.isMuted ? "batch-row-muted" : ""}">
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

  function withBatchFilterState(rows){
    return rows.map(row => {
      const hasData = row.currentExposure > 0 || row.currentInteraction > 0;
      const isMuted = !hasData;
      return { ...row, hasData, isMuted };
    });
  }

  function renderChannelMatrix(derived){
    if (isCommunityView()) {
      renderCommunityChannelDistribution(derived);
      return;
    }
    const rows = derived.channelRows.filter(row => row.exposure > 0 || row.interaction > 0);
    if (!rows.length) { dom.channelMatrix.innerHTML = ""; return; }
    const rankedRows = [...rows].sort((a, b) => b.exposureShare - a.exposureShare);
    const totalExposure = rows.reduce((sum, row) => sum + row.exposure, 0);
    const totalInteraction = rows.reduce((sum, row) => sum + row.interaction, 0);
    const averageRate = totalExposure > 0 ? totalInteraction / totalExposure : 0;
    const core = rankedRows[0];
    const lowEfficiency = [...rows]
      .filter(row => row.exposureShare >= 0.05 && row.contributionGap < 0)
      .sort((a, b) => a.contributionGap - b.contributionGap)[0] || [...rows].sort((a, b) => a.rate - b.rate)[0];
    const potential = [...rows]
      .filter(row => row.exposureShare < 0.2 && row.rate > averageRate)
      .sort((a, b) => b.rate - a.rate)[0] || [...rows].sort((a, b) => b.rate - a.rate)[0];
    const insightCards = [
      { label: "核心贡献", row: core, metric: `曝光占比 ${formatPct(core.exposureShare)}` },
      { label: "低效复盘", row: lowEfficiency, metric: `贡献差 ${formatPctDelta(lowEfficiency.contributionGap)}` },
      { label: "潜力放大", row: potential, metric: `互动率 ${formatPct(potential.rate)}` }
    ].map(item => `<article class="channel-insight-card">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(item.row.label)}</strong>
      <em>${escapeHtml(item.metric)}</em>
    </article>`).join("");
    const rowsHtml = rankedRows.map((row, index) => {
      const diagnosis = channelDiagnosis(row, averageRate);
      const shareWidth = `${Math.min(100, Math.max(2, row.exposureShare * 100)).toFixed(1)}%`;
      return `<article class="channel-diagnosis-row tone-${escapeHtml(diagnosis.tone)}" data-tooltip="${escapeHtml(`${row.label}<br>本周曝光 ${formatCompact(row.exposure)}<br>曝光贡献率 ${formatPct(row.exposureShare)}<br>互动贡献率 ${formatPct(row.interactionShare)}<br>互动率 ${formatPct(row.rate)}<br>贡献差 ${formatPctDelta(row.contributionGap)}`)}">
        <div class="channel-rank">${index + 1}</div>
        <div class="channel-main">
          <div class="channel-line-head">
            <strong>${escapeHtml(row.label)}</strong>
            <span>${escapeHtml(diagnosis.label)}</span>
          </div>
          <div class="channel-share-bar"><i style="width:${shareWidth}"></i></div>
          <div class="channel-line-note">${escapeHtml(diagnosis.note)}</div>
          <div class="channel-inline-metrics">
            <b><em>曝光</em>${formatCompact(row.exposure)}</b>
            <b><em>曝光占比</em>${formatPct(row.exposureShare)}</b>
            <b><em>互动率</em>${formatPct(row.rate)}</b>
            <b class="${classForContributionGap(row.contributionGap)}"><em>贡献差</em>${formatPctDelta(row.contributionGap)}</b>
          </div>
        </div>
      </article>`;
    }).join("");
    dom.channelMatrix.innerHTML = `<div class="matrix-wrap">
      <div class="matrix-head">
        <div>
          <div class="matrix-title">渠道诊断榜</div>
          <div class="matrix-axis-hint">按曝光贡献排序，结合互动率和贡献差判断放大、复盘或观察。</div>
        </div>
      </div>
      <div class="channel-diagnosis-board">
        <div class="channel-insight-grid">${insightCards}</div>
        <div class="channel-diagnosis-list">${rowsHtml}</div>
      </div>
      <div class="matrix-note">备注：曝光贡献率 = 渠道本周曝光 ÷ 全渠道本周曝光；贡献差 = 互动贡献率 - 曝光贡献率。负值越大，越需要复盘内容承接和互动效率。</div>
    </div>`;
  }

  function channelDiagnosis(row, averageRate){
    if (row.exposureShare >= 0.35 && row.rate >= averageRate) {
      return { tone: "strong", label: "核心放大", note: "贡献高且互动效率不低，适合沉淀可复用打法。" };
    }
    if (row.contributionGap <= -0.02) {
      return { tone: "risk", label: "曝光高互动低", note: "先复盘选题钩子、评论引导和达人内容匹配度。" };
    }
    if (row.rate > averageRate && row.exposureShare < 0.2) {
      return { tone: "potential", label: "小体量高效率", note: "互动效率好但规模偏小，可挑选样本做小幅放量。" };
    }
    if (row.exposureShare <= 0.05) {
      return { tone: "muted", label: "低贡献观察", note: "当前贡献有限，保留监控即可。" };
    }
    return { tone: "stable", label: "稳定贡献", note: "作为稳定来源跟踪，重点看下周是否延续。" };
  }

  function renderCommunityChannelDistribution(derived){
    const rows = [...derived.channelRows]
      .filter(row => row.interaction > 0 || row.postCount > 0)
      .sort((a, b) => b.interaction - a.interaction)
      .slice(0, 10);
    if (!rows.length) { dom.channelMatrix.innerHTML = ""; return; }
    dom.channelMatrix.innerHTML = `<div class="matrix-wrap">
      <div class="matrix-head">
        <div>
          <div class="matrix-title">社群互动分布</div>
          <div class="matrix-axis-hint">按总互动排序，结合帖子数和贴均互动判断是否值得负责人复盘。</div>
        </div>
        <div class="matrix-legend">
          <span class="matrix-legend-chip tone-strong">核心社群</span>
          <span class="matrix-legend-chip tone-watch">重点复盘</span>
          <span class="matrix-legend-chip tone-light">持续观察</span>
        </div>
      </div>
      <div class="mini-list">
        ${rows.map((row, index) => `<div class="mini-item" data-tooltip="${escapeHtml(`${row.label}<br>总互动 ${formatCompact(row.interaction)}<br>互动占比 ${formatPct(row.interactionShare)}<br>帖子数 ${row.postCount}<br>贴均互动 ${formatCompact(row.perPostInteraction)}`)}">
          <strong>${index + 1}. ${escapeHtml(row.label)}</strong>
          <span>${escapeHtml(`总互动 ${formatCompact(row.interaction)} / 互动占比 ${formatPct(row.interactionShare)} / 帖子 ${row.postCount} 条 / 贴均互动 ${formatCompact(row.perPostInteraction)}`)}</span>
        </div>`).join("")}
      </div>
      <div class="matrix-note">备注：社群当前只看本周有记录内容产生的互动贡献。</div>
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
    if (isCommunityView()) {
      const rows = [...derived.channelRows].sort((a, b) => b.interaction - a.interaction);
      dom.channelTable.innerHTML = renderSimpleTable(
        ["渠道类型","社群","帖子数","总互动","贴均互动","互动贡献率","诊断标签"],
        rows.map(row => [
          row.type,
          row.platform,
          String(row.postCount),
          formatCompact(row.interaction),
          formatCompact(row.perPostInteraction),
          formatPct(row.interactionShare),
          renderCommunityDiagnosisTag(row, derived.channelRows)
        ])
      );
      return;
    }
    const rows = [...derived.channelRows].sort((a, b) => b.exposure - a.exposure);
    dom.channelTable.innerHTML = renderSimpleTable(
      ["渠道类型","平台/社群","帖子数","贴均贡献","本周曝光","本周总互动","互动率","曝光贡献率","互动贡献率","贡献差","诊断标签"],
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

  function renderContentPanels(derived){
    if (isCommunityView()) {
      const topicRows = aggregateDimensionRows(derived.contentItems, "topic")
        .map(row => ({ ...row, share: safeRate(row.interaction, derived.currentTotals.interaction) }))
        .sort((a, b) => b.interaction - a.interaction)
        .slice(0, 5);
      const sections = [
        {
          title: "高互动内容",
          rows: [...derived.contentItems].sort((a, b) => b.interaction - a.interaction).slice(0, 5),
          formatter: row => `${row.type} / ${row.platform} · 总互动 ${formatCompact(row.interaction)} / 互动占比 ${formatPct(row.interactionShare)}`
        },
        {
          title: "主题互动参考",
          rows: topicRows,
          formatter: row => `总互动 ${formatCompact(row.interaction)} / 占比 ${formatPct(row.share)} / 内容 ${row.count} 条`
        },
        {
          title: "待复盘内容",
          rows: [...derived.contentItems].sort((a, b) => b.interactionShare - a.interactionShare).slice(0, 5),
          formatter: row => `${row.type} / ${row.platform} · 占比 ${formatPct(row.interactionShare)} / 负责人 ${row.owner}`
        }
      ];
      renderContentSectionCards(sections);
      return;
    }
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
    renderContentSectionCards(sections);
  }

  function renderContentSectionCards(sections){
    dom.contentPanels.innerHTML = sections.map(section => `<div class="sub-card">
      <div class="sub-card-head"><h3>${escapeHtml(section.title)}</h3>${section.note ? `<span class="sub-card-note">${escapeHtml(section.note)}</span>` : ""}</div>
      <div class="mini-list">${(section.rows.length ? section.rows : [{ label: "暂无符合条件的数据", tooltip: "当前筛选范围没有满足条件的内容项。" }]).map(row => `
        <div class="mini-item" data-tooltip="${escapeHtml(row.tooltip || `${row.label}<br>${section.formatter(row)}`)}">
          <strong>${escapeHtml(row.label)}</strong>
          ${postLinkHtml(row, "mini-item-link")}
          <span>${escapeHtml(section.formatter ? section.formatter(row) : "暂无说明")}</span>
        </div>`).join("")}
      </div></div>`).join("");
  }

  function renderBusinessReview(derived){
    if (!dom.businessReviewPanels) return;
    const changeReasons = buildChangeReasonItems(derived);
    if (isCommunityView()) {
      dom.businessReviewPanels.classList.add("is-community-simple");
      const topReviewPosts = buildTopReviewPosts(derived);
      dom.businessReviewPanels.innerHTML = `<div class="business-review-main">
        ${businessPanel("本周判断", "先看互动变化、单帖效率和集中度", changeReasons.map(item => businessEvidenceItem(item.title, item.body, item.tone)), "business-panel-analysis")}
      </div>
      <div class="business-review-topline">
        ${businessPanel("Top 5 行动复盘", "只补可复用点和下周验证动作", topReviewPosts.map((item, index) => topReviewPostItem(item, index)), "business-panel-top")}
      </div>`;
      bindTopReviewSummaries();
      return;
    }
    dom.businessReviewPanels.classList.remove("is-community-simple");
    const structureRows = buildContentStructureRows(derived);
    const topReviewPosts = buildTopReviewPosts(derived);
    dom.businessReviewPanels.innerHTML = `<div class="business-review-main">
      ${businessPanel("变化原因", "拆成产出、效率、集中度，先判断问题来自哪里", changeReasons.map(item => businessEvidenceItem(item.title, item.body, item.tone)), "business-panel-analysis")}
      ${businessPanel("贡献结构", "按主题、形式、负责人看贡献来源", structureRows.map(item => structureItem(item)), "business-panel-structure")}
    </div>
    <div class="business-review-topline">
      ${businessPanel("Top 5 行动复盘", "每条内容只沉淀可复用点和下周验证动作", topReviewPosts.map((item, index) => topReviewPostItem(item, index)), "business-panel-top")}
    </div>`;
    bindTopReviewSummaries();
  }

  function businessPanel(title, note, items, className = ""){
    const fallback = '<div class="business-empty">暂无足够数据支撑判断</div>';
    return `<section class="business-panel ${escapeHtml(className)}">
      <div class="business-panel-head">
        <h4>${escapeHtml(title)}</h4>
        <span>${escapeHtml(note)}</span>
      </div>
      <div class="business-list">${items.length ? items.join("") : fallback}</div>
    </section>`;
  }

  function businessEvidenceItem(title, body, tone){
    return `<article class="business-item tone-${escapeHtml(tone || "neutral")}">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(body)}</span>
    </article>`;
  }

  function structureItem(item){
    const metricLabel = item.metric === "interaction" ? "互动" : "曝光";
    return `<article class="business-item">
      <div class="business-item-row">
        <strong>${escapeHtml(item.label)}</strong>
        <em>${escapeHtml(item.kind)}</em>
      </div>
      <div class="business-meter" aria-label="${escapeHtml(item.label)}贡献占比">
        <span style="width:${Math.min(100, Math.max(0, item.share * 100)).toFixed(1)}%"></span>
      </div>
      <span>${escapeHtml(`${metricLabel} ${formatCompact(item.value)} · 占比 ${formatPct(item.share)} · 帖子 ${item.count} 条`)}</span>
    </article>`;
  }

  function topReviewPostItem(item, index){
    const summaryKey = topReviewSummaryKey(item);
    const savedSummary = loadTopReviewSummary(summaryKey);
    const postLink = postLinkHtml(item, "top-review-link");
    const metricBadges = [
      `<b>${escapeHtml(item.primaryLabel)} ${escapeHtml(formatCompact(item.primaryValue))}</b>`,
      item.primaryKey === "exposure" ? `<b>总互动 ${escapeHtml(formatCompact(item.interaction))}</b>` : "",
      item.primaryKey === "exposure" && item.exposure > 0 ? `<b>互动率 ${escapeHtml(formatPct(item.rate))}</b>` : "",
      `<b>项目挂靠 ${escapeHtml(String(item.projectLinks || 0))}</b>`
    ].filter(Boolean).join("");
    return `<article class="top-review-post">
      <div class="top-review-rank">Top ${index + 1}</div>
      <div class="top-review-body">
        <strong>${escapeHtml(item.label)}</strong>
        ${postLink}
        <div class="top-review-meta">
          <span>负责人：${escapeHtml(item.owner)}</span>
          <span>主题：${escapeHtml(item.topic)}</span>
          <span>形式：${escapeHtml(item.format)}</span>
          <span>发布时间：${escapeHtml(item.publishDate)}</span>
        </div>
        <div class="top-review-metrics">
          ${metricBadges}
        </div>
        <label class="owner-summary">
          <span>负责人总结</span>
          <textarea data-summary-key="${escapeHtml(summaryKey)}" rows="3" placeholder="请负责人补充：这条内容好在哪里、可复用点是什么、下周要验证什么。">${escapeHtml(savedSummary)}</textarea>
        </label>
      </div>
    </article>`;
  }

  function bindTopReviewSummaries(){
    if (!dom.businessReviewPanels) return;
    dom.businessReviewPanels.querySelectorAll("[data-summary-key]").forEach(textarea => {
      textarea.addEventListener("input", () => saveTopReviewSummary(textarea.dataset.summaryKey, textarea.value));
    });
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
      dom.brandVoice.innerHTML = `<article class="brand-card"><h3>数量表现</h3><p>${escapeHtml(module.remark)}</p></article>`;
      return;
    }
    dom.brandVoice.innerHTML = module.metrics.map(metric => `<article class="brand-card" data-tooltip="${escapeHtml(`${metric.label}<br>本周：${formatMetric(metric.current, metric.unit)}<br>上周：${formatMetric(metric.previous, metric.unit)}`)}">
      <h3>${escapeHtml(metric.label)}</h3>
      <div class="summary-value">${escapeHtml(formatMetric(metric.current, metric.unit))}</div>
      <p>上周 ${escapeHtml(formatMetric(metric.previous, metric.unit))}，${escapeHtml(module.remark)}</p>
    </article>`).join("");
  }

  function buildBatchRows(filteredPosts){
    const ranges = [
      { label: "第1周", key: "batch-1", dayStart: 1, dayEnd: 7 },
      { label: "第2周", key: "batch-2", dayStart: 8, dayEnd: 14 },
      { label: "第3周", key: "batch-3", dayStart: 15, dayEnd: 21 },
      { label: "第4周", key: "batch-4", dayStart: 22, dayEnd: 28 }
    ];
    const totalsByWeek = ranges.map(range => filteredPosts.reduce((acc, post) => {
      const start = addDays(post.publishDateObj, range.dayStart - 1);
      const end = addDays(post.publishDateObj, range.dayEnd - 1);
      const diff = diffMetrics(post, start, end);
      acc.exposure += diff.exposure;
      acc.interaction += diff.interaction;
      if (diff.exposure > 0 || diff.interaction > 0) acc.postCount += 1;
      return acc;
    }, { exposure: 0, interaction: 0, postCount: 0 }));
    const totalExposure = totalsByWeek.reduce((sum, item) => sum + item.exposure, 0);
    const totalInteraction = totalsByWeek.reduce((sum, item) => sum + item.interaction, 0);
    return ranges.map((range, index) => {
      const current = totalsByWeek[index];
      const currentExposureShare = safeRate(current.exposure, totalExposure);
      const currentInteractionShare = safeRate(current.interaction, totalInteraction);
      return {
        key: range.key,
        label: range.label,
        rangeLabel: `发布后${range.dayStart}-${range.dayEnd}天`,
        dateRangeLabel: `样本帖发布后 ${range.dayStart}-${range.dayEnd} 天`,
        currentExposure: current.exposure,
        previousExposure: 0,
        currentInteraction: current.interaction,
        previousInteraction: 0,
        currentExposureShare,
        previousExposureShare: 0,
        currentInteractionShare,
        previousInteractionShare: 0,
        currentInteractionRate: safeRate(current.interaction, current.exposure),
        currentPerPostInteraction: safeRate(current.interaction, current.postCount),
        contributionGap: currentInteractionShare - currentExposureShare,
        exposureWoW: 0,
        interactionWoW: 0
      };
    });
  }

  function resolveBatchDateRange(startText, endText){
    const defaultStart = poolWindow.start;
    const defaultEnd = poolWindow.end;
    let start = startText ? parseDate(startText) : defaultStart;
    let end = endText ? parseDate(endText) : defaultEnd;
    if (!(start instanceof Date) || Number.isNaN(start.getTime())) start = defaultStart;
    if (!(end instanceof Date) || Number.isNaN(end.getTime())) end = defaultEnd;
    if (start > end) [start, end] = [end, start];
    return { start, end };
  }

  function filterPostsByPublishDateRange(scopedPosts, start, end){
    return scopedPosts.filter(post => inDateRange(post.publishDateObj, start, end));
  }

  function buildBatchPublishSummary(filteredPosts, start, end){
    return `${formatDate(start)} ~ ${formatDate(end)} 发布，样本帖 ${filteredPosts.length} 条`;
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
        perPostInteraction: safeRate(totals.interaction, postCount),
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

  function buildContentItems(filteredPosts, currentTotals, start = reviewWindow.start, end = reviewWindow.end){
    return filteredPosts.map(post => {
      const metrics = diffMetrics(post, start, end);
      const age = diffDays(post.publishDateObj, end);
      const label = post.title && !post.title.startsWith("未知") ? post.title : contentLabel(post);
      const postUrl = normalizePostUrl(post.link || post.url || post.postUrl || post.postLink);
      const tooltip = isCommunityView()
        ? `${post.channelType} / ${post.displayChannelName}<br>发布时间 ${formatDate(post.publishDateObj)}<br>负责人 ${normalizeDimension(post.owner) || "未知负责人"}<br>主题 ${post.normalizedTopic || "未知主题"}<br>形式 ${post.normalizedFormat || "未知形式"}<br>总互动 ${formatCompact(metrics.interaction)}`
        : `${post.channelType} / ${post.displayChannelName}<br>发布时间 ${formatDate(post.publishDateObj)}<br>负责人 ${normalizeDimension(post.owner) || "未知负责人"}<br>主题 ${post.normalizedTopic || "未知主题"}<br>形式 ${post.normalizedFormat || "未知形式"}<br>曝光 ${formatCompact(metrics.exposure)}<br>总互动 ${formatCompact(metrics.interaction)}<br>互动率 ${formatPct(safeRate(metrics.interaction, metrics.exposure))}`;
      return {
        id: post.id,
        url: postUrl,
        label,
        type: post.channelType,
        platform: post.displayChannelName,
        channel: `${post.channelType} / ${post.displayChannelName}`,
        owner: normalizeDimension(post.owner) || "未知负责人",
        topic: post.normalizedTopic || "未知主题",
        format: post.normalizedFormat || "未知形式",
        featuredQuality: normalizeDimension(post.featuredQuality) || "未知",
        projectLinks: Number(post.projectLinks || 0),
        batch: batchLabelByAge(age),
        publishDate: formatDate(post.publishDateObj),
        exposure: metrics.exposure,
        interaction: metrics.interaction,
        rate: safeRate(metrics.interaction, metrics.exposure),
        exposureShare: safeRate(metrics.exposure, currentTotals.exposure),
        interactionShare: safeRate(metrics.interaction, currentTotals.interaction),
        tooltip
      };
    }).filter(item => item.exposure > 0 || item.interaction > 0);
  }

  function buildChangeReasonItems(derived){
    if (isCommunityView()) {
      const currentPerPost = safeRate(derived.currentTotals.interaction, derived.currentPostCount);
      const previousPerPost = safeRate(derived.previousTotals.interaction, derived.previousPostCount);
      const topItems = [...derived.contentItems].sort((a, b) => b.interaction - a.interaction).slice(0, 5);
      const topShare = safeRate(sum(topItems, item => item.interaction), derived.currentTotals.interaction);
      const topPlatform = topDimensionRow(aggregateDimensionRows(derived.contentItems, "platform"), derived.currentTotals.interaction, "interaction");
      return [
        {
          title: "整体变化",
          body: `本周总互动 ${formatCompact(derived.currentTotals.interaction)}，较上周 ${formatDeltaPercent(safeWoW(derived.currentTotals.interaction, derived.previousTotals.interaction))}；本周帖子 ${derived.currentPostCount} 条，较上周 ${formatDeltaPercent(safeWoW(derived.currentPostCount, derived.previousPostCount))}。`,
          tone: derived.currentTotals.interaction >= derived.previousTotals.interaction ? "positive" : "risk"
        },
        {
          title: "单帖效率",
          body: `贴均互动 ${formatCompact(currentPerPost)}，较上周 ${formatDeltaPercent(safeWoW(currentPerPost, previousPerPost))}。用于判断互动变化来自发帖数量还是单帖质量。`,
          tone: currentPerPost >= previousPerPost ? "positive" : "watch"
        },
        {
          title: "集中度",
          body: `Top 5 内容贡献 ${formatPct(topShare)} 互动${topPlatform ? `，主要社群为 ${topPlatform.label}` : ""}。占比过高时需要判断是否依赖少数内容。`,
          tone: topShare >= 0.65 ? "watch" : "neutral"
        }
      ];
    }
    const currentPerPost = safeRate(derived.currentTotals.exposure, derived.currentPostCount);
    const previousPerPost = safeRate(derived.previousTotals.exposure, derived.previousPostCount);
    const topItems = [...derived.contentItems].sort((a, b) => b.exposure - a.exposure).slice(0, 5);
    const topShare = safeRate(sum(topItems, item => item.exposure), derived.currentTotals.exposure);
    const topPlatform = topDimensionRow(aggregateDimensionRows(derived.contentItems, "platform"), derived.currentTotals.exposure);
    const items = [
      {
        title: "整体变化",
        body: `本周曝光 ${formatCompact(derived.currentTotals.exposure)}，较上周 ${formatDeltaPercent(safeWoW(derived.currentTotals.exposure, derived.previousTotals.exposure))}；本周帖子 ${derived.currentPostCount} 条，较上周 ${formatDeltaPercent(safeWoW(derived.currentPostCount, derived.previousPostCount))}。`,
        tone: derived.currentTotals.exposure >= derived.previousTotals.exposure ? "positive" : "risk"
      },
      {
        title: "单帖效率",
        body: `贴均曝光 ${formatCompact(currentPerPost)}，较上周 ${formatDeltaPercent(safeWoW(currentPerPost, previousPerPost))}。用于判断增长来自发帖数量还是单帖质量。`,
        tone: currentPerPost >= previousPerPost ? "positive" : "watch"
      },
      {
        title: "集中度",
        body: `Top 5 内容贡献 ${formatPct(topShare)} 曝光${topPlatform ? `，主要平台为 ${topPlatform.label}` : ""}。占比过高时需要判断是否依赖少数爆款。`,
        tone: topShare >= 0.65 ? "watch" : "neutral"
      }
    ];
    return items;
  }

  function buildContentStructureRows(derived){
    const metric = isCommunityView() ? "interaction" : (derived.currentTotals.exposure > 0 ? "exposure" : "interaction");
    const total = metric === "exposure" ? derived.currentTotals.exposure : derived.currentTotals.interaction;
    const topicRows = aggregateDimensionRows(derived.contentItems, "topic").slice(0, 3).map(row => ({ ...row, kind: "主题" }));
    const formatRows = aggregateDimensionRows(derived.contentItems, "format").slice(0, 2).map(row => ({ ...row, kind: "形式" }));
    const ownerRows = aggregateDimensionRows(derived.contentItems, "owner").slice(0, 2).map(row => ({ ...row, kind: "负责人" }));
    return [...topicRows, ...formatRows, ...ownerRows]
      .map(row => ({ ...row, metric, value: row[metric], share: safeRate(row[metric], total) }))
      .sort((a, b) => b.value - a.value)
      .filter(row => row.value > 0);
  }

  function buildTopReviewPosts(derived){
    const useExposure = !isCommunityView() && derived.currentTotals.exposure > 0;
    const primaryKey = useExposure ? "exposure" : "interaction";
    const primaryLabel = useExposure ? "曝光" : "互动";
    return [...derived.contentItems]
      .sort((a, b) => b[primaryKey] - a[primaryKey])
      .slice(0, 5)
      .map(item => ({
        ...item,
        primaryKey,
        primaryLabel,
        primaryValue: item[primaryKey]
      }));
  }

  function aggregateDimensionRows(items, key){
    const grouped = new Map();
    items.forEach(item => {
      const label = item[key] || "未知";
      if (!grouped.has(label)) grouped.set(label, { label, exposure: 0, interaction: 0, count: 0 });
      const row = grouped.get(label);
      row.exposure += item.exposure;
      row.interaction += item.interaction;
      row.count += 1;
    });
    return [...grouped.values()]
      .map(row => ({ ...row, rate: safeRate(row.interaction, row.exposure) }))
      .sort((a, b) => b.exposure - a.exposure);
  }

  function topDimensionRow(rows, total, metric = "exposure"){
    const row = [...rows].sort((a, b) => (b[metric] || 0) - (a[metric] || 0))[0];
    if (!row) return null;
    return { ...row, share: safeRate(row[metric] || 0, total) };
  }

  function topReviewSummaryKey(item){
    return `${TOP_REVIEW_SUMMARY_STORAGE_PREFIX}.${state.view}.${state.scope}.${state.platform}.${item.id}`;
  }

  function overviewPlaybookStorageKey(channelKey, field){
    return `${OVERVIEW_PLAYBOOK_STORAGE_PREFIX}.${channelKey}.${field}`;
  }

  function overviewPlaybookLegacyStorageKey(channelKey, field){
    const sample = source.currentSample || "default";
    return `${OVERVIEW_PLAYBOOK_LEGACY_STORAGE_PREFIX}.${sample}.${channelKey}.${field}`;
  }

  function postLinkHtml(item, className){
    if (!item || !item.url) return "";
    return `<a class="${escapeHtml(className)}" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.url)}" aria-label="打开帖子链接：${escapeHtml(item.label || "帖子")}">${escapeHtml(shortDisplayUrl(item.url))}</a>`;
  }

  function loadTopReviewSummary(key){
    try {
      return localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function saveTopReviewSummary(key, value){
    try {
      localStorage.setItem(key, value || "");
    } catch (error) {
      // ignore storage errors
    }
  }

  function loadOverviewPlaybookNote(key, legacyKey = ""){
    try {
      const current = localStorage.getItem(key);
      if (current !== null) return current;
      if (!legacyKey) return "";
      const legacy = localStorage.getItem(legacyKey);
      if (legacy !== null) {
        localStorage.setItem(key, legacy);
        return legacy;
      }
      return "";
    } catch (error) {
      return "";
    }
  }

  function saveOverviewPlaybookNote(key, value){
    try {
      localStorage.setItem(key, value || "");
    } catch (error) {
      // ignore storage errors
    }
  }

  function updateOverviewPlaybookStatus(channelKey){
    if (!channelKey || !dom.overviewChannelPlaybook) return;
    const status = [...dom.overviewChannelPlaybook.querySelectorAll("[data-playbook-status]")]
      .find(item => item.dataset.playbookStatus === channelKey);
    if (!status) return;
    const fields = ["reuse", "risk", "next"];
    const savedCount = fields
      .map(field => loadOverviewPlaybookNote(overviewPlaybookStorageKey(channelKey, field)).trim())
      .filter(Boolean).length;
    const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    status.textContent = savedCount ? `已自动保存 ${time} · ${savedCount} 项` : "待沉淀";
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

  function buildLineSeries(filteredPosts, previousFilteredPosts, granularity){
    const lineMetricBuilder = granularity === "week"
      ? buildWeeklyLineMetric
      : buildDailyLineMetric;
    return {
      exposure: lineMetricBuilder(filteredPosts, previousFilteredPosts, "exposure"),
      interaction: lineMetricBuilder(filteredPosts, previousFilteredPosts, "interaction"),
      postCount: lineMetricBuilder(filteredPosts, previousFilteredPosts, "postCount"),
      perPostExposure: lineMetricBuilder(filteredPosts, previousFilteredPosts, "perPostExposure")
    };
  }

  function buildDailyLineMetric(filteredPosts, previousFilteredPosts, metric){
    const dates = eachDate(poolWindow.start, poolWindow.end);
    const labels = dates.map((day, index) => (index % 4 === 0 || index === dates.length - 1 ? formatMonthDay(day) : ""));
    const tooltipLabels = dates.map(day => formatDate(day));
    const previousDates = eachDate(previousPoolWindow.start, previousPoolWindow.end);
    const currentExposureDaily = dates.map(day => sumPostsForRange(filteredPosts, day, day).exposure);
    const previousExposureDaily = previousDates.map(day => sumPostsForRange(previousFilteredPosts, day, day).exposure);
    const currentInteractionDaily = dates.map(day => sumPostsForRange(filteredPosts, day, day).interaction);
    const previousInteractionDaily = previousDates.map(day => sumPostsForRange(previousFilteredPosts, day, day).interaction);
    const currentPublishedDaily = dates.map(day => countPostsPublishedForRange(filteredPosts, day, day));
    const previousPublishedDaily = previousDates.map(day => countPostsPublishedForRange(previousFilteredPosts, day, day));
    const currentExposureCum = cumulativeSeries(currentExposureDaily);
    const previousExposureCum = cumulativeSeries(previousExposureDaily);
    const currentInteractionCum = cumulativeSeries(currentInteractionDaily);
    const previousInteractionCum = cumulativeSeries(previousInteractionDaily);
    const currentPostCum = cumulativeSeries(currentPublishedDaily);
    const previousPostCum = cumulativeSeries(previousPublishedDaily);
    let current = currentExposureCum;
    let previous = previousExposureCum;
    if (metric === "interaction") {
      current = currentInteractionCum;
      previous = previousInteractionCum;
    } else if (metric === "postCount") {
      current = currentPostCum;
      previous = previousPostCum;
    } else if (metric === "perPostExposure") {
      current = currentExposureCum.map((value, index) => safeRate(value, currentPostCum[index]));
      previous = previousExposureCum.map((value, index) => safeRate(value, previousPostCum[index]));
    }
    const currentPosts = dates.map(day => countPostsForRange(filteredPosts, day, day));
    const previousPosts = previousDates.map(day => countPostsForRange(previousFilteredPosts, day, day));
    return { labels, tooltipLabels, current, previous, currentPosts, previousPosts };
  }

  function buildWeeklyLineMetric(filteredPosts, previousFilteredPosts, metric){
    const labels = [];
    const tooltipLabels = [];
    const current = [];
    const previous = [];
    const currentPosts = [];
    const previousPosts = [];
    for (let step = 3; step >= 0; step -= 1) {
      const start = addDays(reviewWindow.start, -step * 7);
      const end = addDays(start, 6);
      labels.push(`${formatMonthDay(start)}|${formatMonthDay(end)}`);
      tooltipLabels.push(formatDateRange(start, end));
      const currentRangeTotals = sumPostsForRange(filteredPosts, start, end);
      const currentRangePostCount = countPostsPublishedForRange(filteredPosts, start, end);
      const previousStart = addMonths(start, -1);
      const previousEnd = addMonths(end, -1);
      const previousRangeTotals = sumPostsForRange(previousFilteredPosts, previousStart, previousEnd);
      const previousRangePostCount = countPostsPublishedForRange(previousFilteredPosts, previousStart, previousEnd);
      const currentRangeValue = metric === "interaction"
        ? currentRangeTotals.interaction
        : (metric === "postCount"
          ? currentRangePostCount
          : currentRangeTotals.exposure);
      const previousRangeValue = metric === "interaction"
        ? previousRangeTotals.interaction
        : (metric === "postCount"
          ? previousRangePostCount
          : previousRangeTotals.exposure);
      current.push(currentRangeValue);
      previous.push(previousRangeValue);
      currentPosts.push(countPostsForRange(filteredPosts, start, end));
      previousPosts.push(countPostsForRange(previousFilteredPosts, previousStart, previousEnd));
    }
    const cumulativeCurrent = cumulativeSeries(current);
    const cumulativePrevious = cumulativeSeries(previous);
    const cumulativeCurrentPostCount = cumulativeSeries(rangesToPublishedCounts(filteredPosts));
    const cumulativePreviousPostCount = cumulativeSeries(rangesToPublishedCounts(previousFilteredPosts, true));
    const currentFinal = metric === "perPostExposure"
      ? cumulativeCurrent.map((value, index) => safeRate(value, cumulativeCurrentPostCount[index]))
      : cumulativeCurrent;
    const previousFinal = metric === "perPostExposure"
      ? cumulativePrevious.map((value, index) => safeRate(value, cumulativePreviousPostCount[index]))
      : cumulativePrevious;
    return {
      labels,
      tooltipLabels,
      current: currentFinal,
      previous: previousFinal,
      currentPosts,
      previousPosts
    };
  }

  function rangesToPublishedCounts(filteredPosts, isPreviousMonth = false){
    const out = [];
    for (let step = 3; step >= 0; step -= 1) {
      const start = addDays(reviewWindow.start, -step * 7);
      const end = addDays(start, 6);
      const rangeStart = isPreviousMonth ? addMonths(start, -1) : start;
      const rangeEnd = isPreviousMonth ? addMonths(end, -1) : end;
      out.push(countPostsPublishedForRange(filteredPosts, rangeStart, rangeEnd));
    }
    return out;
  }

  function countPostsPublishedForRange(postsInRange, start, end){
    return postsInRange.reduce((count, post) => count + (inDateRange(post.publishDateObj, start, end) ? 1 : 0), 0);
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
    const width = 780, height = 320, padding = { top: 24, right: 42, bottom: 52, left: 62 };
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
    const labels = config.labels.map((label, idx) => {
      const lines = String(label).split("|");
      if (lines.length > 1) {
        return `<text x="${x(idx)}" y="${height - 24}" text-anchor="middle" fill="#6a7d95" font-size="11">
          <tspan x="${x(idx)}" dy="0">${escapeHtml(lines[0])}</tspan>
          <tspan x="${x(idx)}" dy="12">${escapeHtml(lines[1])}</tspan>
        </text>`;
      }
      return `<text x="${x(idx)}" y="${height - 18}" text-anchor="middle" fill="#6a7d95" font-size="11">${escapeHtml(label)}</text>`;
    }).join("");
    const pPts = config.primary.map((value, idx) => svgCirclePoint({ cx: x(idx), cy: y(value), color: "#2f607c", tooltip: `${config.primaryLabel}<br>${config.labels[idx] || idx + 1}：${config.formatter(value)}` })).join("");
    const sPts = config.secondary.map((value, idx) => svgCirclePoint({ cx: x(idx), cy: y(value), color: "#9ab0bf", tooltip: `${config.secondaryLabel}<br>${config.labels[idx] || idx + 1}：${config.formatter(value)}` })).join("");
    const hoverBandWidth = plotWidth / Math.max(1, config.labels.length);
    const hoverGuides = config.labels.map((label, idx) => {
      const centerX = x(idx);
      const bandX = Math.max(padding.left, centerX - hoverBandWidth / 2);
      const postsInfo = (config.showPostsInfo !== false && config.currentPosts && config.previousPosts)
        ? `<br>当前帖子数：${config.currentPosts[idx] || 0}<br>上月帖子数：${config.previousPosts[idx] || 0}`
        : "";
      const tooltipLabel = (config.tooltipLabels && config.tooltipLabels[idx]) ? config.tooltipLabels[idx] : (label || `${idx + 1}`);
      const tooltip = `${tooltipLabel}<br>${config.primaryLabel}：${config.formatter(config.primary[idx] || 0)}<br>${config.secondaryLabel}：${config.formatter(config.secondary[idx] || 0)}${postsInfo}`;
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

  function buildBatchContributionChartSvg(rows, community = false){
    const width = 520, height = 360, padding = { top: 24, right: 22, bottom: 58, left: 54 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    if (community) {
      const maxShare = Math.max(0.01, ...rows.map(row => row.currentInteractionShare)) * 1.18;
      const xCenter = index => padding.left + plotWidth * (index + 0.5) / rows.length;
      const y = value => padding.top + plotHeight - plotHeight * value / maxShare;
      const barWidth = Math.min(44, plotWidth / (rows.length * 2.4));
      const grid = Array.from({ length: 5 }, (_, index) => {
        const value = maxShare * index / 4;
        const yy = y(value);
        return `<line x1="${padding.left}" y1="${yy}" x2="${width - padding.right}" y2="${yy}" stroke="#e4edf6" stroke-dasharray="4 6"/>
          <text x="${padding.left - 8}" y="${yy + 4}" text-anchor="end" fill="#6f8299" font-size="11">${escapeHtml(formatPct(value))}</text>`;
      }).join("");
      const bars = rows.map((row, index) => {
        const center = xCenter(index);
        const barY = y(row.currentInteractionShare);
        const base = padding.top + plotHeight;
        const tooltip = escapeHtml(`${row.label}<br>${row.dateRangeLabel}<br>互动贡献率 ${formatPct(row.currentInteractionShare)}<br>总互动 ${formatCompact(row.currentInteraction)}<br>贴均互动 ${formatCompact(row.currentPerPostInteraction || 0)}`);
        const color = row.isMuted ? "#d5dde7" : "#238672";
        return `<g class="${row.isMuted ? "batch-row is-muted" : "batch-row"}" data-tooltip="${tooltip}">
          <rect class="batch-bar" x="${center - barWidth / 2}" y="${barY}" width="${barWidth}" height="${Math.max(1, base - barY)}" rx="6" fill="${color}"/>
        </g>`;
      }).join("");
      const labels = rows.map((row, index) => `<text x="${xCenter(index)}" y="${height - 24}" text-anchor="middle" fill="${row.isMuted ? "#9aa8b8" : "#50677f"}" font-size="12" font-weight="700">${escapeHtml(row.label)}</text>
        <text x="${xCenter(index)}" y="${height - 8}" text-anchor="middle" fill="${row.isMuted ? "#9aa8b8" : "#17815a"}" font-size="10">${escapeHtml(row.hasData ? formatPct(row.currentInteractionShare) : "暂无数据")}</text>`).join("");
      return `<div class="batch-chart-wrap">
        <svg class="svg-chart batch-contribution-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="批次互动贡献柱状图">
          ${grid}
          <line x1="${padding.left}" y1="${padding.top + plotHeight}" x2="${width - padding.right}" y2="${padding.top + plotHeight}" stroke="#cfddeb"/>
          ${bars}
          ${labels}
        </svg>
        <div class="chart-legend">
          <div class="chart-legend-item"><span class="chart-legend-block interaction"></span>互动贡献率</div>
        </div>
      </div>`;
    }
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
      const exposureColor = row.isMuted ? "#c7d2df" : "#2f607c";
      const interactionColor = row.isMuted ? "#d5dde7" : "#238672";
      const rowClass = row.isMuted ? "batch-row is-muted" : "batch-row";
      return `<g class="${rowClass}" data-tooltip="${tooltip}">
        <rect class="batch-bar" x="${exposureX}" y="${exposureY}" width="${barWidth}" height="${Math.max(1, base - exposureY)}" rx="6" fill="${exposureColor}"/>
        <rect class="batch-bar" x="${interactionX}" y="${interactionY}" width="${barWidth}" height="${Math.max(1, base - interactionY)}" rx="6" fill="${interactionColor}"/>
        <rect x="${center - barWidth * 1.45}" y="${padding.top}" width="${barWidth * 2.9}" height="${plotHeight}" fill="transparent"/>
      </g>`;
    }).join("");
    const labels = rows.map((row, index) => `<text x="${xCenter(index)}" y="${height - 24}" text-anchor="middle" fill="${row.isMuted ? "#9aa8b8" : "#50677f"}" font-size="12" font-weight="700">${escapeHtml(row.label)}</text>
      <text x="${xCenter(index)}" y="${height - 8}" text-anchor="middle" fill="${row.isMuted ? "#9aa8b8" : (row.contributionGap >= 0 ? "#17815a" : "#bd5b16")}" font-size="10">${escapeHtml(row.hasData ? formatPctDelta(row.contributionGap) : "暂无数据")}</text>`).join("");
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

  function renderSelect(container, options, activeKey, onChange){
    if (!container) return;
    container.innerHTML = options
      .map(option => `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`)
      .join("");
    if (!options.find(option => option.key === activeKey)) {
      container.value = options[0] ? options[0].key : "";
    } else {
      container.value = activeKey;
    }
    container.onchange = () => {
      const key = container.value;
      if (key !== activeKey) onChange(key);
    };
  }

  function setControlGroupVisibility(selector, isVisible){
    document.querySelectorAll(selector).forEach(group => {
      group.hidden = !isVisible;
    });
  }

  function bindTabs(){
    if (!dom.tabStrip) return;
    dom.tabStrip.addEventListener("click", event => {
      const button = event.target.closest(".tab-item");
      if (!button) return;
      event.preventDefault();
      const nextView = button.dataset.view || "overview";
      if (nextView !== state.view) {
        state.view = nextView;
        state.platform = "all";
        renderPreservingScroll();
      }
      syncActiveTab();
    });
  }

  function syncActiveTab(){
    if (!dom.tabStrip) return;
    dom.tabStrip.querySelectorAll(".tab-item").forEach(item => {
      item.classList.toggle("is-active", item.dataset.view === state.view);
    });
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
        source = mergeImportedSource(imported);
        const persistStatus = await savePersistedImport(imported);
        initMonthlyGoalTarget();
        state.view = "overview";
        state.scope = "all";
        state.platform = "all";
        dataSourceLabel = "文件数据";
        recomputeBaseWindows();
        render();
        const skippedNotes = [];
        if (importAudit && importAudit.missingPublishDate > 0) skippedNotes.push(`缺发布时间 ${importAudit.missingPublishDate} 行`);
        if (importAudit && importAudit.missingStatDate > 0) skippedNotes.push(`缺统计日期 ${importAudit.missingStatDate} 行`);
        if (importAudit && importAudit.missingLink > 0) skippedNotes.push(`缺链接 ${importAudit.missingLink} 行`);
        const skippedSuffix = skippedNotes.length ? `（${skippedNotes.join("，")}）` : "";
        const persistSuffix = persistStatus ? ` · 已保存${persistStatus}` : " · 未保存缓存，刷新后需重新导入";
        setImportStatus(`已导入 · ${source.posts.length}帖${skippedSuffix}${persistSuffix}`);
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
        clearPersistedImport();
        initMonthlyGoalTarget();
        state.scope = "all";
        state.platform = "all";
        state.granularity = "day";
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

  function mergeImportedSource(imported){
    return {
      ...cloneData(initialSource),
      ...imported,
      monthlyGoal: cloneData(initialSource.monthlyGoal || imported.monthlyGoal || { month: "", exposureTarget: 0 }),
      manualModules: cloneData(initialSource.manualModules || imported.manualModules || []),
      dtcSection: cloneData(initialSource.dtcSection || imported.dtcSection || { totalCurrent: 0, totalPrevious: 0, totalLastYear: 0, rows: [] })
    };
  }

  async function loadPersistedImport(){
    try {
      const db = await openImportDb();
      const cached = await idbRequest(db.transaction(IMPORT_STORE_NAME, "readonly").objectStore(IMPORT_STORE_NAME).get(IMPORT_CACHE_KEY));
      if (cached && cached.source) return cached;
    } catch (error) {
      // fall back to localStorage below
    }
    return loadLocalStorageImport();
  }

  async function savePersistedImport(imported){
    let savedInIndexedDb = false;
    let savedInLocalStorage = false;
    try {
      const db = await openImportDb();
      const transaction = db.transaction(IMPORT_STORE_NAME, "readwrite");
      const request = transaction.objectStore(IMPORT_STORE_NAME).put({
        key: IMPORT_CACHE_KEY,
        source: imported,
        savedAt: formatDate(new Date())
      });
      await idbRequest(request);
      await idbTransactionDone(transaction);
      savedInIndexedDb = true;
    } catch (error) {
      savedInIndexedDb = false;
    }
    try {
      saveLocalStorageImport(imported);
      savedInLocalStorage = true;
    } catch (error) {
      savedInLocalStorage = false;
    }
    if (savedInIndexedDb && savedInLocalStorage) return "缓存";
    if (savedInIndexedDb) return "IndexedDB";
    if (savedInLocalStorage) return "本地缓存";
    return "";
  }

  async function clearPersistedImport(){
    try {
      const db = await openImportDb();
      const transaction = db.transaction(IMPORT_STORE_NAME, "readwrite");
      await idbRequest(transaction.objectStore(IMPORT_STORE_NAME).delete(IMPORT_CACHE_KEY));
      await idbTransactionDone(transaction);
    } catch (error) {
      // ignore storage errors
    }
    clearLocalStorageImport();
  }

  function openImportDb(){
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
      const request = indexedDB.open(IMPORT_DB_NAME, IMPORT_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(IMPORT_STORE_NAME)) db.createObjectStore(IMPORT_STORE_NAME, { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbRequest(request){
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function idbTransactionDone(transaction){
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }

  function loadLocalStorageImport(){
    try {
      const meta = JSON.parse(localStorage.getItem(IMPORT_FALLBACK_META_KEY) || "null");
      if (!meta || !Number.isFinite(meta.chunks) || meta.chunks <= 0) return null;
      let json = "";
      for (let index = 0; index < meta.chunks; index += 1) {
        const chunk = localStorage.getItem(`${IMPORT_FALLBACK_CHUNK_PREFIX}${index}`);
        if (chunk === null) return null;
        json += chunk;
      }
      const source = JSON.parse(json);
      return { key: IMPORT_CACHE_KEY, source, savedAt: meta.savedAt || "" };
    } catch (error) {
      return null;
    }
  }

  function saveLocalStorageImport(imported){
    const json = JSON.stringify(imported);
    const chunks = Math.ceil(json.length / IMPORT_FALLBACK_CHUNK_SIZE);
    clearLocalStorageImport();
    for (let index = 0; index < chunks; index += 1) {
      localStorage.setItem(`${IMPORT_FALLBACK_CHUNK_PREFIX}${index}`, json.slice(index * IMPORT_FALLBACK_CHUNK_SIZE, (index + 1) * IMPORT_FALLBACK_CHUNK_SIZE));
    }
    localStorage.setItem(IMPORT_FALLBACK_META_KEY, JSON.stringify({ chunks, savedAt: formatDate(new Date()) }));
  }

  function clearLocalStorageImport(){
    try {
      const meta = JSON.parse(localStorage.getItem(IMPORT_FALLBACK_META_KEY) || "null");
      const chunkCount = meta && Number.isFinite(meta.chunks) ? meta.chunks : 50;
      for (let index = 0; index < chunkCount; index += 1) localStorage.removeItem(`${IMPORT_FALLBACK_CHUNK_PREFIX}${index}`);
      localStorage.removeItem(IMPORT_FALLBACK_META_KEY);
    } catch (error) {
      localStorage.removeItem(IMPORT_FALLBACK_META_KEY);
    }
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
        publishWindow: `${formatDate(new Date(latestStatDate.getFullYear(), latestStatDate.getMonth(), 1))} ~ ${formatDate(latestStatDate)} 发布帖子`
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
    const rows = window.XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true });
    applyWorksheetHyperlinks(worksheet, rows);
    return rows;
  }

  function applyWorksheetHyperlinks(worksheet, rows){
    const ref = worksheet && worksheet["!ref"];
    if (!ref || !rows.length || !window.XLSX) return;
    const range = window.XLSX.utils.decode_range(ref);
    const headers = [];
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const headerCell = worksheet[window.XLSX.utils.encode_cell({ r: range.s.r, c: col })];
      headers[col] = asText(headerCell && headerCell.v);
    }
    rows.forEach((row, rowIndex) => {
      const sheetRow = range.s.r + 1 + rowIndex;
      headers.forEach((header, col) => {
        if (!header) return;
        const cell = worksheet[window.XLSX.utils.encode_cell({ r: sheetRow, c: col })];
        const hyperlink = extractCellHyperlink(cell);
        if (hyperlink) row[header] = hyperlink;
      });
    });
  }

  function extractCellHyperlink(cell){
    if (!cell) return "";
    const direct = cell.l && (cell.l.Target || cell.l.target);
    if (direct) return asText(direct);
    const formula = asText(cell.f);
    const match = formula.match(/^HYPERLINK\(\s*"([^"]+)"/i);
    return match ? match[1] : "";
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
      missingStatDate: 0,
      missingLink: 0
    };
    const groups = new Map();
    rows.forEach((row, rowIndex) => {
      const normalized = normalizeImportedRow(row, rowIndex, audit);
      if (!normalized) return;
      audit.acceptedRows += 1;
      if (!groups.has(normalized.postKey)) {
        groups.set(normalized.postKey, {
          id: `imp-${hashText(normalized.postKey)}`,
          link: normalized.link,
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
        link: group.link,
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
    const link = asText(getImportedValue(row, [
      "帖子链接", "帖子URL", "帖子url", "链接", "URL", "url",
      "链接地址", "内容链接", "原文链接", "视频链接", "视频URL",
      "作品链接", "作品URL", "素材链接", "笔记链接", "笔记URL",
      "Post URL", "PostURL", "Post Link", "post_url", "post link"
    ]));
    if (!statDate) {
      if (audit) audit.missingStatDate += 1;
      return null;
    }
    if (!publishDate) {
      if (audit) audit.missingPublishDate += 1;
      return null;
    }
    if (!link && audit) audit.missingLink += 1;
    const rawPlatform = asText(getImportedValue(row, ["平台", "平台名称", "渠道平台"])) || asText(getImportedValue(row, ["渠道名称", "渠道"])) || "未知渠道";
    const channelType = asText(getImportedValue(row, ["渠道类型"])) || "社媒";
    const communityName = asText(getImportedValue(row, ["社群名称", "群名称", "群组", "小组", "社群渠道", "渠道名称", "社群", "群", "渠道"]));
    const channelName = channelType === "社群" && isCommunityUnitName(communityName) ? communityName : rawPlatform;
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
      link,
      title,
      platform: rawPlatform,
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
  function heroMetaCard(title, value){ return `<div class="hero-meta-card"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(value)}</span></div>`; }
  function summaryCard(label, value, foot){ return `<div class="summary-card" data-tooltip="${escapeHtml(`${label}<br>${value}<br>${foot}`)}"><div class="summary-label">${escapeHtml(label)}</div><div class="summary-value">${escapeHtml(value)}</div><div class="summary-foot">${escapeHtml(foot)}</div></div>`; }
  function svgCirclePoint(config){ return `<circle cx="${config.cx}" cy="${config.cy}" r="5" fill="${config.color}" stroke="#ffffff" stroke-width="2" data-tooltip="${escapeHtml(config.tooltip)}"/>`; }

  function renderBatchEfficiencyTag(gap){
    if (gap >= 0.02) return '<span class="tag-badge tag-eff-high">效率偏高</span>';
    if (gap <= -0.02) return '<span class="tag-badge tag-eff-low">效率偏低</span>';
    return '<span class="tag-badge tag-eff-flat">效率平衡</span>';
  }

  function renderCommunityBatchTag(share){
    if (share >= 0.35) return '<span class="tag-badge tag-core">互动集中</span>';
    if (share >= 0.18) return '<span class="tag-badge tag-potential">贡献稳定</span>';
    if (share > 0) return '<span class="tag-badge tag-watch">轻量观察</span>';
    return '<span class="tag-badge tag-eff-flat">暂无互动</span>';
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

  function renderCommunityDiagnosisTag(row, allRows){
    const avgShare = average(allRows, item => item.interactionShare);
    const avgPerPost = average(allRows, item => item.perPostInteraction);
    const highShare = row.interactionShare >= avgShare;
    const highPerPost = row.perPostInteraction >= avgPerPost;
    if (highShare && highPerPost) return '<span class="tag-badge tag-core">核心社群</span>';
    if (highShare && !highPerPost) return '<span class="tag-badge tag-review">待复盘社群</span>';
    if (!highShare && highPerPost) return '<span class="tag-badge tag-potential">高效社群</span>';
    return '<span class="tag-badge tag-watch">观察社群</span>';
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
    const platforms = [...new Set(base.map(post => displayChannelNameForPost(post)).filter(Boolean))]
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
  function normalizePostUrl(value){
    const text = asText(value);
    if (!text) return "";
    const extracted = text.match(/https?:\/\/[^\s"'<>]+/i)?.[0] || text;
    const urlText = /^https?:\/\//i.test(extracted) ? extracted : `https://${extracted}`;
    try {
      const url = new URL(urlText);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (error) {
      return "";
    }
  }
  function shortDisplayUrl(value){
    try {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./i, "");
      const pathParts = url.pathname.split("/").filter(Boolean);
      const tail = pathParts[pathParts.length - 1] || "";
      if (!tail) return host;
      const compactTail = tail.length > 20 ? `${tail.slice(0, 20)}...` : tail;
      return `${host}/${compactTail}`;
    } catch (error) {
      const text = asText(value);
      return text.length > 32 ? `${text.slice(0, 29)}...` : text;
    }
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
  function addMonths(date, months){
    const d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  }
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
  function cumulativeSeries(values){
    let acc = 0;
    return values.map(value => {
      acc += Number(value || 0);
      return acc;
    });
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
  function formatYearMonth(date){ return `${date.getFullYear()}年${date.getMonth() + 1}月`; }
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
  function displayChannelNameForPost(post){
    if (post.channelType === "社群") {
      const communityName = normalizeDimension(post.channelName);
      if (isCommunityUnitName(communityName)) return communityName;
    }
    return canonicalChannelName(post.channelName || post.platform);
  }

  function isCommunityUnitName(value){
    const text = normalizeDimension(value);
    if (!text) return false;
    const platformNames = new Set(["facebook", "fb", "instagram", "ins", "ig", "tiktok", "tk", "youtube", "yt", "pinterest"]);
    return !platformNames.has(text.toLowerCase());
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
