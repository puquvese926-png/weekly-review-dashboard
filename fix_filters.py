import re

path = r"d:/projects/nail-attribution-console-demo/output/weekly-review-dashboard/3.0/app.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add filterCache to state declaration (after publishMode: false)
old_state = "    publishMode: false,\n    globalMetric: \"exposure\""
new_state = "    publishMode: false,\n    globalMetric: \"exposure\",\n    filterCache: null"
content = content.replace(old_state, new_state)

# 2. Replace filter-bar HTML section with button-based design
old_filter_bar = """      <div class="filter-bar">
        ${["channelType","channelName","productLine","project","topic","format"].map(key => {
          const vals = {channelType:channelTypes,channelName:channels,productLine:productLines,project:projects,topic:topics,format:formats}[key];
          const labels = {channelType:"渠道类型",channelName:"平台",productLine:"品线",project:"项目",topic:"主题",format:"形式"};
          const id = "dl-"+key+"-"+tableId;
          return `<input class="detail-filter" list="${id}" placeholder="${labels[key]}：全部" data-action="detail-filter" data-filter-key="${key}" data-filter-input style="min-width:100px;" autocomplete="off"><datalist id="${id}"><option value="">全部</option>${vals.map(v => `<option value="${escapeHtml(v)}">`).join("")}</datalist>`;
        }).join("")}
        <input class="detail-filter" type="text" data-filter="owner" placeholder="搜索负责人..." style="min-width:120px;">
      </div>"""

# Cache filter values at module level
cache_code = """
    state.filterCache = {
      channelType: channelTypes,
      channelName: channels,
      productLine: productLines,
      project: projects,
      topic: topics,
      format: formats
    };
"""

new_filter_bar = cache_code + """
      <div class="filter-bar" style="position:relative;">
        <div class="filter-dropdowns" style="display:flex;flex-wrap:wrap;gap:6px;">
          ${["channelType","channelName","productLine","project","topic","format"].map(key => {
            const keyLabels = {channelType:"渠道类型",channelName:"平台",productLine:"品线",project:"项目",topic:"主题",format:"形式"};
            const withSearch = ["productLine","project","topic"].includes(key);
            return `<div class="filter-dropdown" data-filter-dropdown="${key}">
              <button class="filter-dropdown-btn" type="button" data-action="toggle-filter-dropdown" data-filter-key="${key}">${keyLabels[key]} ▾</button>
              ${withSearch ? "" : ""}
            </div>`;
          }).join("")}
          <input class="detail-filter" type="text" data-filter="owner" placeholder="搜索负责人..." style="min-width:110px;height:34px;">
        </div>
        <div class="filter-tags" data-filter-tags style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;"></div>
        <div class="filter-popover-container" data-filter-popover style="display:none;position:absolute;top:100%;left:0;z-index:55;min-width:220px;max-height:320px;overflow-y:auto;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:0 12px 40px rgba(15,23,42,.12);padding:8px 0;margin-top:4px;"></div>
      </div>"""

content = content.replace(old_filter_bar, new_filter_bar)

# 3. Add openFilterPopover function and related logic after applyDetailFilters
popover_code = """
function openFilterPopover(key, btn){
  if (!state.filterCache) return;
  const store = state.filterCache[key] || [];
  const withSearch = ["productLine","project","topic"].includes(key);
  const container = btn.closest(".filter-bar")?.querySelector("[data-filter-popover]");
  if (!container) return;

  const currentVal = state._activeFilters ? (state._activeFilters[key] || "") : "";
  container.innerHTML = "";

  if (withSearch) {
    const searchInput = document.createElement("input");
    searchInput.className = "filter-popover-search";
    searchInput.placeholder = "搜索...";
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.toLowerCase();
      container.querySelectorAll(".filter-popover-item").forEach(item => {
        item.style.display = q ? (item.textContent.toLowerCase().includes(q) ? "" : "none") : "";
      });
    });
    container.appendChild(searchInput);
  }

  const allItem = document.createElement("div");
  allItem.className = "filter-popover-item" + (!currentVal ? " is-checked" : "");
  allItem.innerHTML = `<span class="check-icon"></span>全部`;
  allItem.addEventListener("click", () => {
    state._activeFilters = state._activeFilters || {};
    state._activeFilters[key] = "";
    updateFilterTags(btn.closest("[data-detail-table-id]"));
    applyDetailFilters(btn.closest("[data-detail-table-id]").dataset.detailTableId);
    container.style.display = "none";
  });
  container.appendChild(allItem);

  store.forEach(val => {
    const item = document.createElement("div");
    const isChecked = currentVal === val;
    item.className = "filter-popover-item" + (isChecked ? " is-checked" : "");
    item.innerHTML = `<span class="check-icon"></span>${escapeHtml(val)}`;
    item.addEventListener("click", () => {
      state._activeFilters = state._activeFilters || {};
      state._activeFilters[key] = isChecked ? "" : val;
      updateFilterTags(btn.closest("[data-detail-table-id]"));
      applyDetailFilters(btn.closest("[data-detail-table-id]").dataset.detailTableId);
      container.style.display = "none";
    });
    container.appendChild(item);
  });

  container.style.display = "block";
  container._currentKey = key;
  container._currentBtn = btn;
}

function updateFilterTags(tableEl){
  const tags = tableEl?.querySelector("[data-filter-tags]");
  if (!tags) return;
  const active = state._activeFilters || {};
  const entries = Object.entries(active).filter(([,v]) => v);
  if (!entries.length) { tags.innerHTML = ""; return; }
  tags.innerHTML = '<span style="font-size:11px;color:var(--muted);margin-right:4px;">已选:</span>' +
    entries.map(([k, v]) => `<span class="filter-tag" data-remove-filter="${k}">${escapeHtml(v)} <button type="button" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;">×</button></span>`).join("") +
    '<button class="filter-tag" type="button" data-clear-all-filters style="background:var(--surface-2);">清除全部</button>';
}

function closeFilterPopover(){
  const popover = document.querySelector("[data-filter-popover]");
  if (popover) { popover.style.display = "none"; popover._currentKey = null; }
}

window.addEventListener("click", e => {
  if (!e.target.closest("[data-action='toggle-filter-dropdown']") && !e.target.closest("[data-filter-popover]")) {
    closeFilterPopover();
  }
});
"""

# Insert after updateDetailTable function
old_update_end = "function exportDetailCsv(tableId){"
if old_update_end not in content:
    old_update_end = "function handleImportFile(){"
content = content.replace("function handleImportFile(){", popover_code + "\nfunction handleImportFile(){")

# 4. Update handleStageClick for filter popovers and tag removal
old_click_handler = "if (action === \"detail-filter\") {"
new_click_handler = """if (action === "toggle-filter-dropdown") {
      const key = event.target.dataset.filterKey;
      openFilterPopover(key, event.target);
      return;
    }
    if (action === "detail-filter") {"""
content = content.replace(old_click_handler, new_click_handler)

# Also handle remove-filter tags in handleStageClick
old_close_detail = "if (action === \"close-detail\") {"
new_remove_filter = """if (action === "remove-filter") {
      const key = event.target.closest("[data-remove-filter]")?.dataset.removeFilter;
      if (key) {
        state._activeFilters = state._activeFilters || {};
        state._activeFilters[key] = "";
        const tableEl = event.target.closest("[data-detail-table-id]");
        updateFilterTags(tableEl);
        if (tableEl) applyDetailFilters(tableEl.dataset.detailTableId);
      }
      return;
    }
    if (action === "clear-all-filters") {
      state._activeFilters = {};
      const tableEl = event.target.closest("[data-detail-table-id]");
      updateFilterTags(tableEl);
      if (tableEl) applyDetailFilters(tableEl.dataset.detailTableId);
      return;
    }
    if (action === "close-detail") {"""
content = content.replace(old_close_detail, new_remove_filter)

# 5. Update applyDetailFilters to use state._activeFilters
old_filters = """const filters = {};
    root.querySelectorAll(".filter-bar [data-filter-key]").forEach(el => {
      const val = asText(el.value || el.textContent).trim();
      if (val) filters[el.dataset.filterKey] = val.toLowerCase();
    });
    root.querySelectorAll(".filter-bar .detail-filter[data-filter]").forEach(input => {
      filters[input.dataset.filter] = asText(input.value).trim().toLowerCase();
    });"""
new_filters = """const filters = Object.assign({}, state._activeFilters || {});
    root.querySelectorAll(".filter-bar .detail-filter[data-filter]").forEach(input => {
      filters[input.dataset.filter] = asText(input.value).trim().toLowerCase();
    });"""
content = content.replace(old_filters, new_filters)

# 6. Update handleStageInput to simplify
old_select_handler = """if (target.matches("[data-action='detail-filter'],[data-filter-input]")) {
      const tableId = target.closest("[data-detail-table-id]")?.dataset.detailTableId;
      if (!tableId) return;
      if (target.matches("[data-filter-input]")) {
        clearTimeout(target._debounce);
        target._debounce = setTimeout(() => applyDetailFilters(tableId), 200);
      } else {
        applyDetailFilters(tableId);
      }
    }
    if (target.matches(".detail-filter[data-filter]")) {"""
new_select_handler = """if (target.matches(".detail-filter[data-filter]")) {"""
content = content.replace(old_select_handler, new_select_handler)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
