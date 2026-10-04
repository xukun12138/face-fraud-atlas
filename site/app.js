/* Face Fraud Atlas: dependency-free static interface. Metadata is never inferred. */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const VIEWS = ["overview", "library", "benchmarks", "tools", "figures", "resources"];
const PREFERENCE_KEYS = {
  theme: "face-fraud-atlas.preferences.v2.theme",
  language: "face-fraud-atlas.preferences.v2.language",
};
const ROLE_NAMES = {
  PAD: "呈现攻击检测", digital: "数字篡改检测", generation: "生成机制",
  morph: "人脸融合检测", adversarial: "对抗识别攻击", "systems/privacy": "系统与隐私",
  surveys: "综述", official: "官方资料",
};
const FORM_NAMES = {
  article: "期刊论文", conference: "会议论文", workshop: "研讨会论文",
  chapter: "已出版书章", preprint: "预印本", official: "官方资料",
};
const UNIT_NAMES = {
  video: "视频", video_stream: "视频流", multichannel_video: "多通道录制",
  image: "图像", face_sequence: "人脸序列", presentation: "呈现事件",
};
const state = {
  papers: [], benchmarks: [], taxonomy: { claims: [], scenarios: [] }, figures: [],
  readingNotes: {}, allowedIds: [], language: "en", loaded: false, lastFocus: null,
};
const locale = () => state.language === "en" ? "en-US" : "zh-CN";
const number = value => {
  const numeric = Number(value);
  if (numeric !== 0 && Math.abs(numeric) < 0.01) {
    return numeric.toLocaleString(locale(), { maximumSignificantDigits: 3, useGrouping: false });
  }
  return numeric.toLocaleString(locale(), { maximumFractionDigits: 2 });
};
const text = (key, fallback) => {
  const dictionary = globalThis.ATLAS_I18N || {};
  return dictionary[state.language]?.[key] ?? fallback;
};
const literal = value => text(`ui.literal.${String(value)}`, String(value));
function format(key, fallback, values = {}) {
  return text(key, fallback).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
}

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined && content !== null) node.textContent = literal(content);
  return node;
}

function safeURL(value) {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = new URL(value, document.baseURI);
    return ["https:", "http:"].includes(parsed.protocol) ? parsed.href : null;
  } catch { return null; }
}

function link(label, url, className = "") {
  const href = safeURL(url);
  if (!href) return el("span", className, label);
  const node = el("a", className, label);
  node.href = href;
  if (new URL(href).origin !== location.origin) {
    node.target = "_blank";
    node.rel = "noopener noreferrer";
  }
  return node;
}

function empty(container, message, isError = false) {
  if (!container) return;
  const node = el("p", isError ? "empty-state error" : "empty-state", message);
  if (isError) node.setAttribute("role", "alert");
  container.replaceChildren(node);
}

function isResearch(paper) {
  return paper.is_research !== false && paper.publication_form !== "official"
    && paper.primary_role !== "official";
}

function roleName(role) { return text(`role.${role}`, ROLE_NAMES[role] || role || "未分类"); }
function formName(form) { return text(`form.${form}`, FORM_NAMES[form] || form || "未报告"); }
function unitName(unit) { return text(`unit.${unit}`, UNIT_NAMES[unit] || unit || "未报告"); }
function evidenceName(paper) {
  const kind = !isResearch(paper) ? "official" : paper.evidence_level;
  const names = {
    "direct-system": "金融系统研究", "identity-verification": "身份验证研究",
    "component-transfer": "组件迁移", context: "背景与综述", official: "规范与指导背景",
  };
  return text(`ui.evidence.${kind}`, names[kind] || kind || literal("未报告"));
}
function evidenceDescription(paper) {
  const kind = !isResearch(paper) ? "official" : paper.evidence_level;
  return text(`ui.evidenceDescription.${kind}`, "");
}
function readingField(paper, field) {
  if (state.language !== "en") return paper[field] || "";
  return paper[`${field}_en`] || state.readingNotes[paper.id]?.[field]
    || paper.translations?.en?.[field] || paper[field] || "";
}
function authorsOf(paper) {
  return Array.isArray(paper.authors) ? paper.authors.filter(Boolean) :
    typeof paper.authors === "string" ? [paper.authors] : [];
}

function selectView(view, { writeHash = false, focus = false } = {}) {
  if (!VIEWS.includes(view)) view = "overview";
  const tabs = $$('[data-tab]');
  for (const tab of tabs) {
    const navigation = tab.matches(".main-nav [data-tab]");
    const active = navigation && tab.dataset.tab === view;
    tab.classList.toggle("active", active);
    tab.classList.toggle("is-active", active);
    tab.removeAttribute("aria-selected");
    tab.removeAttribute("tabindex");
    if (active) tab.setAttribute("aria-current", "page");
    else tab.removeAttribute("aria-current");
    if (focus && active) tab.focus();
  }
  for (const section of $$("section.view")) {
    const active = section.id === `view-${view}`;
    section.hidden = !active;
    section.classList.toggle("active", active);
    section.classList.toggle("is-active", active);
  }
  if (writeHash) history.replaceState(null, "", `#${view}`);
  document.body.dataset.view = view;
}

function readHash() {
  const raw = location.hash.slice(1);
  const [route, query = ""] = raw.split("?");
  const parameters = new URLSearchParams(query);
  if (route.startsWith("paper/")) {
    selectView("library");
    let id = route.slice(6);
    try { id = decodeURIComponent(id); } catch { /* Treat an invalid escape literally. */ }
    if (state.loaded) openPaper(id);
    return;
  }
  const view = VIEWS.includes(route) ? route : "overview";
  selectView(view);
  if (view === "library" && state.loaded && query) {
    state.allowedIds = (parameters.get("ids") || "").split(",").filter(Boolean);
    const settings = { "#paper-search": "q", "#role-filter": "role", "#year-filter": "year", "#type-filter": "type" };
    for (const [selector, key] of Object.entries(settings)) {
      const control = $(selector);
      if (control) control.value = parameters.get(key) || "";
    }
    const official = $("#show-official");
    if (official) official.checked = parameters.get("official") === "1" ||
      state.allowedIds.some(id => state.papers.some(paper => paper.id === id && !isResearch(paper)));
    renderPapers();
  }
  if (view === "overview" && parameters.has("scenario") && $("#scenario-select")) {
    $("#scenario-select").value = parameters.get("scenario");
    renderScenario();
  }
}

function setupTabs() {
  const tabs = $$('[data-tab]');
  for (const tab of tabs) {
    const view = tab.dataset.tab;
    if (!VIEWS.includes(view)) continue;
    tab.removeAttribute("role");
    tab.removeAttribute("tabindex");
    tab.setAttribute("aria-controls", `view-${view}`);
    tab.addEventListener("click", event => { event.preventDefault(); selectView(view, { writeHash: true }); });
  }
  window.addEventListener("hashchange", readHash);
  readHash();
}

function populateSelect(selector, values, allLabel, labelFunction = String) {
  const select = $(selector);
  if (!select) return;
  const previous = select.value;
  const nodes = [new Option(literal(allLabel), ""), ...values.map(value => new Option(labelFunction(value), String(value)))];
  select.replaceChildren(...nodes);
  if (values.map(String).includes(previous)) select.value = previous;
}

function setupLibrary() {
  if ($("#show-official")) $("#show-official").checked = false;
  populateLibraryFilters();
  for (const selector of ["#paper-search", "#role-filter", "#year-filter", "#type-filter", "#show-official"]) {
    const control = $(selector);
    if (!control) continue;
    control.addEventListener(selector === "#paper-search" ? "input" : "change", () => {
      state.allowedIds = [];
      if ((selector === "#role-filter" || selector === "#type-filter") && control.value === "official" && $("#show-official")) {
        $("#show-official").checked = true;
      }
      renderPapers();
      writeFilterHash();
    });
  }
  $("#reset-filters")?.addEventListener("click", resetFilters);
  $("#export-csv")?.addEventListener("click", exportCSV);
  $("#export-bib")?.addEventListener("click", exportBib);
  $("#paper-count")?.setAttribute("aria-live", "polite");
  renderPapers();
}

function populateLibraryFilters() {
  populateSelect("#role-filter", Object.keys(ROLE_NAMES).filter(role => state.papers.some(paper => paper.primary_role === role)), "全部主题", roleName);
  populateSelect("#year-filter", [...new Set(state.papers.map(paper => Number(paper.year)).filter(Number.isFinite))].sort((a, b) => b - a), "全部年份");
  populateSelect("#type-filter", Object.keys(FORM_NAMES).filter(form => state.papers.some(paper => paper.publication_form === form)), "全部发表形态", formName);
}

function resetFilters() {
  for (const selector of ["#paper-search", "#role-filter", "#year-filter", "#type-filter"]) if ($(selector)) $(selector).value = "";
  if ($("#show-official")) $("#show-official").checked = false;
  state.allowedIds = [];
  renderPapers();
  writeFilterHash();
}

function filteredPapers() {
  const query = ($("#paper-search")?.value || "").trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const role = $("#role-filter")?.value || "";
  const year = $("#year-filter")?.value || "";
  const form = $("#type-filter")?.value || "";
  const includeOfficial = $("#show-official")?.checked || false;
  return state.papers.filter(paper => {
    if (!isResearch(paper) && !includeOfficial) return false;
    if (state.allowedIds.length && !state.allowedIds.includes(paper.id)) return false;
    if (role && paper.primary_role !== role) return false;
    if (year && String(paper.year) !== year) return false;
    if (form && paper.publication_form !== form) return false;
    const haystack = [paper.id, paper.title, ...authorsOf(paper), paper.venue, paper.year,
      paper.primary_role, ROLE_NAMES[paper.primary_role],
      globalThis.ATLAS_I18N?.en?.[`role.${paper.primary_role}`], paper.section, paper.method,
      paper.contribution, paper.limitations, paper.evidence_note,
      ...["contribution", "limitations", "evidence_note"].map(field => state.readingNotes[paper.id]?.[field] || paper[`${field}_en`])]
      .join(" ").toLocaleLowerCase();
    return query.every(token => haystack.includes(token));
  });
}

function writeFilterHash() {
  const params = new URLSearchParams();
  for (const [selector, key] of [["#paper-search", "q"], ["#role-filter", "role"], ["#year-filter", "year"], ["#type-filter", "type"]]) {
    const value = $(selector)?.value;
    if (value) params.set(key, value);
  }
  if ($("#show-official")?.checked) params.set("official", "1");
  if (state.allowedIds.length) params.set("ids", state.allowedIds.join(","));
  history.replaceState(null, "", `#library${params.size ? `?${params}` : ""}`);
}

function renderPapers() {
  const container = $("#paper-list");
  if (!container) return;
  const papers = filteredPapers();
  if ($("#export-csv")) $("#export-csv").disabled = papers.length === 0;
  if ($("#export-bib")) $("#export-bib").disabled = !papers.some(paper => paper.bibtex?.trim());
  const count = $("#paper-count");
  if (count) count.textContent = format("ui.resultCount", "显示 {shown} / {total} 条", {
    shown: papers.length, total: $("#show-official")?.checked ? state.papers.length : state.papers.filter(isResearch).length,
  }) + (state.allowedIds.length ? format("ui.sceneReferences", " · 场景引用：{ids}", { ids: state.allowedIds.join(", ") }) : "");
  if (!papers.length) { empty(container, "没有符合当前条件的条目。请修改搜索或重置筛选。"); return; }
  const fragment = document.createDocumentFragment();
  for (const paper of papers) {
    const card = el("article", "paper-card");
    card.id = `paper-${paper.id}`;
    card.append(el("p", "card-eyebrow", `${paper.id} · ${roleName(paper.primary_role)}`));
    const title = el("h3", "paper-title", paper.title);
    title.lang = /[\u3400-\u9fff]/.test(paper.title) ? "zh-CN" : "en";
    card.append(title);
    const authors = authorsOf(paper);
    if (authors.length) card.append(el("p", "paper-authors", authors.slice(0, 3).join(" · ") + (authors.length > 3 ? ` · ${text("ui.etAl", "等")}` : "")));
    card.append(el("p", "card-meta", [paper.venue, paper.year, formName(paper.publication_form)].filter(Boolean).join(" · ")));
    const badges = el("div", "badges");
    if (paper.core_venue) {
      const core = el("span", "badge core", text("ui.coreVenue", "本选集的核心发表来源"));
      core.title = text("ui.coreVenueNote", "这是本综述的来源选择类别，不是单篇论文质量排名。");
      badges.append(core);
    }
    if (paper.evidence_level) {
      const evidence = el("span", "badge", format("ui.financialEvidence", "研究关联：{kind}", { kind: evidenceName(paper) }));
      evidence.title = evidenceDescription(paper);
      badges.append(evidence);
    }
    if (!isResearch(paper)) badges.append(el("span", "badge official", "官方资料"));
    if (badges.childElementCount) card.append(badges);
    const actions = el("div", "paper-actions");
    const detail = el("button", "button secondary", "详情与证据边界");
    detail.type = "button";
    detail.setAttribute("aria-haspopup", "dialog");
    detail.addEventListener("click", () => openPaper(paper.id, detail));
    actions.append(detail, link("核验来源 ↗", paper.source_url, "source-link"));
    card.append(actions);
    fragment.append(card);
  }
  container.replaceChildren(fragment);
}

function appendFact(list, label, value) {
  list.append(el("dt", "", label), el("dd", "", value === null || value === undefined || value === "" ? "未报告" : value));
}

function openPaper(id, trigger) {
  const paper = state.papers.find(item => item.id === id);
  const dialog = $("#paper-detail");
  if (!paper || !dialog) return;
  state.lastFocus = trigger || document.activeElement;
  const body = el("div", "paper-detail-body");
  const close = el("button", "dialog-close", "关闭 ×");
  close.type = "button";
  close.setAttribute("aria-label", literal("关闭文献详情"));
  close.addEventListener("click", closeDialog);
  body.append(close, el("p", "card-eyebrow", `${paper.id} · ${roleName(paper.primary_role)}`));
  const title = el("h2", "", paper.title);
  title.id = "paper-detail-title";
  title.lang = /[\u3400-\u9fff]/.test(paper.title) ? "zh-CN" : "en";
  body.append(title);
  const facts = el("dl", "detail-facts");
  appendFact(facts, "作者", authorsOf(paper).join("; "));
  appendFact(facts, "发表来源", paper.venue);
  appendFact(facts, "年份 / 形态", `${paper.year ?? "未报告"} / ${formName(paper.publication_form)}`);
  appendFact(facts, "综述位置", paper.section);
  appendFact(facts, "金融相关证据", evidenceName(paper));
  body.append(facts);
  if (paper.core_venue) body.append(el("p", "scope-note", text("ui.coreVenueNote", "这是本综述的来源选择类别，不是单篇论文质量排名。")));
  body.append(el("p", "scope-note", "类别表示与金融验证的关联方式，不是研究质量或证据强弱排序。"));
  const fields = [["contribution", "研究贡献"], ["limitations", "研究限制"], ["evidence_note", "证据边界"]];
  if (state.language === "en" && fields.some(([field]) => /[\u3400-\u9fff]/.test(readingField(paper, field)))) {
    body.append(el("p", "scope-note", text("ui.originalNotes", "Some reading notes are available only in the original Chinese; an English translation is not yet available.")));
  }
  for (const [field, label] of fields) {
    const value = readingField(paper, field);
    if (!value) continue;
    const paragraph = el("p", "detail-paragraph", value);
    paragraph.lang = /[\u3400-\u9fff]/.test(value) ? "zh-CN" : "en";
    body.append(el("h3", "", label), paragraph);
  }
  body.append(link("打开已核验来源 ↗", paper.source_url, "button secondary"));
  if (paper.bibtex) {
    const details = el("details", "bibtex-detail");
    details.append(el("summary", "", "查看原始 BibTeX"), el("pre", "", paper.bibtex));
    body.append(details);
  }
  dialog.replaceChildren(body);
  dialog.setAttribute("aria-labelledby", title.id);
  if (!dialog.open) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else { dialog.setAttribute("open", ""); dialog.hidden = false; }
  }
  close.focus();
}

function closeDialog() {
  const dialog = $("#paper-detail");
  if (!dialog) return;
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
  if (state.lastFocus?.isConnected) state.lastFocus.focus();
}

function setupDialog() {
  const dialog = $("#paper-detail");
  if (!dialog) return;
  dialog.addEventListener("close", () => { if (state.lastFocus?.isConnected) state.lastFocus.focus(); });
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDialog();
  });
  dialog.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); }
    if (event.key !== "Tab") return;
    const focusable = $$('button, a[href], input, select, textarea, summary, [tabindex="0"]', dialog)
      .filter(node => !node.disabled && node.getClientRects().length);
    const first = focusable[0], last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
}

function download(content, type, filename) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = el("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
function exportCSV() {
  const fields = ["id", "title", "authors", "venue", "year", "primary_role", "publication_form", "core_venue", "is_research", "evidence_level", "source_url"];
  const rows = filteredPapers().map(paper => fields.map(field => csvCell(field === "authors" ? authorsOf(paper).join("; ") : paper[field])).join(","));
  download("\uFEFF" + [fields.join(","), ...rows].join("\r\n"), "text/csv;charset=utf-8", "face-fraud-selected-papers.csv");
}

function exportBib() {
  const papers = filteredPapers();
  const entries = papers.map(paper => paper.bibtex).filter(value => typeof value === "string" && value.trim());
  if (!entries.length) return;
  const missing = papers.filter(paper => !paper.bibtex).map(paper => paper.id);
  const note = missing.length ? `% No verified BibTeX entry available for: ${missing.join(", ")}\n\n` : "";
  download(note + entries.join("\n\n") + "\n", "application/x-bibtex;charset=utf-8", "face-fraud-selected-references.bib");
}

function makeTable(headers, rows, className = "data-table") {
  const table = el("table", className);
  const head = el("thead"), headRow = el("tr");
  headers.forEach(header => { const th = el("th", "", header); th.scope = "col"; headRow.append(th); });
  head.append(headRow);
  const body = el("tbody");
  rows.forEach(cells => {
    const row = el("tr");
    cells.forEach((value, index) => {
      const cell = el(index === 0 ? "th" : "td");
      if (index === 0) cell.scope = "row";
      if (value instanceof Node) cell.append(value);
      else cell.textContent = literal(value ?? "未报告");
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  return table;
}

function datasetName(row) { return row.name || row.dataset || row.id; }
function countText(value) { return value === null || value === undefined || value === "" ? literal("未报告") : number(value); }
function additionalCounts(row) {
  const entries = Object.entries(row.additional_counts || {});
  if (!entries.length) return literal("未报告");
  const list = el("dl", "benchmark-extra-counts");
  for (const [key, value] of entries) {
    const fallback = key.replaceAll("_", " ").replace(/^./, letter => letter.toUpperCase());
    const label = text(`ui.benchmarkCount.${key}`, fallback);
    const display = /(?:^|_)year$/.test(key) && value !== null ? String(value) : countText(value);
    list.append(el("dt", "", label), el("dd", "", display));
  }
  return list;
}
function setupBenchmarks() {
  renderBenchmarkTable();
  for (const selector of ["#benchmark-a", "#benchmark-b"]) {
    const select = $(selector);
    if (!select) continue;
    select.replaceChildren(...state.benchmarks.map(row => new Option(datasetName(row), row.id || row.citekey)));
    select.addEventListener("change", renderBenchmarkComparison);
  }
  if ($("#benchmark-b") && state.benchmarks.length > 1) $("#benchmark-b").selectedIndex = 1;
  renderBenchmarkComparison();
}

function renderBenchmarkTable() {
  const container = $("#benchmarks-table");
  if (container) {
    if (!state.benchmarks.length) empty(container, "数据集资料暂未加载。");
    else {
      const rows = state.benchmarks.map(row => [datasetName(row), row.year ?? "未报告", countText(row.total_count), unitName(row.unit),
        (row.modalities || []).join(" / "), row.version || "原论文版本", link("原论文 ↗", row.source_url)]);
      const table = makeTable(["数据集", "年份", "报告总量", "计数单位", "模态", "版本范围", "来源"], rows);
      if (container.tagName === "TABLE") container.replaceChildren(...table.childNodes);
      else container.replaceChildren(table);
    }
  }
}

function renderBenchmarkComparison() {
  const container = $("#benchmark-comparison");
  if (!container) return;
  const a = state.benchmarks.find(row => (row.id || row.citekey) === $("#benchmark-a")?.value);
  const b = state.benchmarks.find(row => (row.id || row.citekey) === $("#benchmark-b")?.value);
  if (!a || !b) { empty(container, "选择两份数据集资料以比较。"); return; }
  const notes = el("p", "scope-note", a.unit === b.unit ?
    "相同计数单位仍可能对应不同采样与派生方式；规模不能代表检测效能或金融适用性。" :
    "两份资料的计数单位不同，报告数量不能直接比较；此处不计算规模比率或检测成绩。");
  const fields = [
    ["版本范围", row => row.version || "原论文版本"],
    ["报告总量", row => countText(row.total_count)],
    ["计数单位", row => unitName(row.unit)],
    ["真实 / 真人类数量", row => countText(row.real_count)],
    ["呈现攻击 / 操纵类数量", row => countText(row.attack_count)],
    ["身份数", row => countText(row.identity_count)],
    ["身份统计范围", row => row.identity_scope || "未报告"],
    ["模态", row => (row.modalities || []).join(" / ") || "未报告"],
    ["协议范围", row => row.protocol || "未报告"],
    ["计数依据", row => row.count_basis || "未报告"],
    ["推导说明", row => row.derivation || "未报告"],
    ["附加计数（原始字段）", additionalCounts],
    ["限制 / 原文差异", row => (row.notes || []).join("；") || "未报告"],
    ["来源定位", row => row.source_location || "未报告"],
    ["原论文", row => link("核验来源 ↗", row.source_url)],
  ];
  container.replaceChildren(notes, el("p", "scope-note category-note",
    "类别遵循原数据集定义与计数单位。呈现攻击、操纵媒体与未经授权的业务动作是不同标签；此处不把媒体标签转换为工作流结果。"),
    makeTable(["比较项目", datasetName(a), datasetName(b)], fields.map(([label, fn]) => [label, fn(a), fn(b)]), "comparison-table data-table"));
}

function riskInputs() {
  const definitions = [
    ["prevalence", "#risk-prevalence", 0.1, 0, 100],
    ["recall", "#risk-recall", 90, 0, 100],
    ["fpr", "#risk-fpr", 1, 0, 100],
    ["sessions", "#risk-sessions", 100000, 1, 1e12],
  ];
  const result = {}, invalid = [];
  for (const [key, selector, fallback, min, max] of definitions) {
    const input = $(selector);
    const value = input ? Number(input.value.trim()) : fallback;
    const valid = (input?.value.trim() !== "" || !input) && Number.isFinite(value) && value >= min && value <= max
      && (key !== "sessions" || Number.isInteger(value));
    input?.setAttribute("aria-invalid", String(!valid));
    if (!valid) invalid.push(key);
    result[key] = value;
  }
  return { values: result, invalid };
}

function setupTools() {
  for (const [selector, defaultValue] of [["#risk-prevalence", "0.1"], ["#risk-recall", "90"], ["#risk-fpr", "1"], ["#risk-sessions", "100000"]]) {
    const input = $(selector);
    if (!input) continue;
    if (!input.value) input.value = defaultValue;
    input.addEventListener("input", renderRisk);
  }
  $("#risk-results")?.setAttribute("aria-live", "polite");
  $("#export-protocol")?.addEventListener("click", exportProtocol);
  $$('[data-protocol-axis]').forEach(input => input.addEventListener("change", renderProtocolPreview));
  for (const selector of ["#protocol-workflow", "#protocol-entry"]) $(selector)?.addEventListener("change", renderProtocolPreview);
  renderRisk();
  renderProtocolPreview();
}

function renderRisk() {
  const container = $("#risk-results");
  if (!container) return;
  const { values, invalid } = riskInputs();
  if (invalid.length) {
    empty(container, "请输入 0–100 的百分数及正整数会话数。当前输入不能用于计算。", true);
    $("#risk-chart")?.replaceChildren();
    return;
  }
  const p = values.prevalence / 100, recall = values.recall / 100, fpr = values.fpr / 100, n = values.sessions;
  const tp = n * p * recall, fp = n * (1 - p) * fpr, fn = n * p * (1 - recall), tn = n * (1 - p) * (1 - fpr);
  const alerts = tp + fp, ppv = alerts > 0 ? tp / alerts : null;
  const metrics = el("div", "risk-metrics");
  for (const [label, value] of [["预期攻击告警", number(tp)], ["预期正常会话告警", number(fp)], ["预期总告警", number(alerts)],
    ["告警精确率 PPV", ppv === null ? "无告警，未定义" : `${number(ppv * 100)}%`], ["预期漏检攻击", number(fn)], ["正常会话无告警", number(tn)]]) {
    const metric = el("div", "risk-metric");
    metric.append(el("span", "metric-label", label), el("strong", "metric-value", value));
    metrics.append(metric);
  }
  container.replaceChildren(metrics, el("p", "scope-note", text("ui.riskMetricExplanation", "告警精确率（PPV）是预期攻击告警数除以预期总告警数；所有计数单位均为会话。")),
    el("p", "scope-note", "假设场景：输入的攻击发生率、召回率与误告警率均为模型条件，结果是预期量，允许非整数；不是银行实测或算法成绩。"));
  renderRiskChart(tp, fp, alerts);
}

function svgEl(tag, attributes, content) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
  if (content !== undefined) node.textContent = literal(content);
  return node;
}

function renderRiskChart(tp, fp, alerts) {
  const container = $("#risk-chart");
  if (!container) return;
  const svg = svgEl("svg");
  svg.setAttribute("viewBox", "0 0 720 85");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-labelledby", "risk-chart-title risk-chart-description");
  svg.append(svgEl("title", { id: "risk-chart-title" }, "假设场景的预期告警组成"),
    svgEl("desc", { id: "risk-chart-description" }, format("ui.riskChartDescription", "攻击告警 {tp}，正常会话误告警 {fp}。仅按告警数缩放。", { tp: number(tp), fp: number(fp) })));
  svg.append(svgEl("rect", { x: 20, y: 20, width: 680, height: 45, rx: 8, fill: "#e7edf3" }));
  if (alerts > 0) {
    const width = 680 * tp / alerts;
    if (width > 0) svg.append(svgEl("rect", { x: 20, y: 20, width, height: 45, fill: "#36b6a4" }));
    if (width < 680) svg.append(svgEl("rect", { x: 20 + width, y: 20, width: 680 - width, height: 45, fill: "#e2aa59" }));
  }
  const legend = el("div", "risk-chart-legend");
  for (const [color, label] of [["#36b6a4", format("ui.attackAlertCount", "攻击告警 {count}", { count: number(tp) })],
    ["#e2aa59", format("ui.legitimateAlertCount", "正常会话误告警 {count}", { count: number(fp) })]]) {
    const row = el("div", "risk-chart-legend-item");
    const swatch = el("span", "risk-chart-swatch");
    swatch.style.backgroundColor = color;
    swatch.setAttribute("aria-hidden", "true");
    row.append(swatch, el("span", "", label));
    legend.append(row);
  }
  const nodes = [svg];
  if (alerts <= 0) nodes.push(el("p", "risk-chart-caption", "当前假设下无告警"));
  nodes.push(legend,
    el("p", "risk-chart-caption", text("ui.riskChartScale", "条形表示两类预期告警在总告警中的比例。")),
    el("p", "risk-chart-caption", text("ui.riskChartUnit", "单位：预期会话数；所有输入均为假设条件。")));
  container.replaceChildren(...nodes);
}

function protocolPlan() {
  const allowed = ["identity", "source", "generator", "device", "time"];
  const axes = $$('[data-protocol-axis]').filter(input => input.checked)
    .map(input => input.dataset.protocolAxis).filter(axis => allowed.includes(axis));
  const { values, invalid } = riskInputs();
  return {
    schema_version: "1.0", exported_at: new Date().toISOString(),
    status: "study_design_not_completed_evaluation",
    protected_workflow: $("#protocol-workflow")?.value || "unspecified",
    attacker_entry: $("#protocol-entry")?.value || "unspecified",
    held_out_axes: [...new Set(axes)],
    validated_threshold_assumptions: {
      status: "requires_independent_validation",
      choose_threshold_on_validation_only: true, freeze_before_test: true,
      reuse_test_data_for_calibration: false,
      numerical_inputs_are_hypothetical: true,
      proposed_operating_point: invalid.length ? null : values,
      uncertainty_unit: "independent_identity_or_session_as_appropriate",
    },
    grouping_requirements: ["Keep original and derivative media together where source is held out.",
      "Keep adaptation and calibration data separate from the final test.",
      "State acquisition path, reference provenance, challenge freshness and attacker privileges."],
    event_requirements: ["Run checks on the actual verification event.",
      "Bind identity evidence to the requested account and action.",
      "Record final legitimate completion, unauthorized action, fallback and review outcomes."],
    interpretation: "This JSON is a protocol design, not an automated evaluation or evidence of deployment security.",
  };
}

function renderProtocolPreview() {
  const container = $("#protocol-preview");
  if (!container) return;
  const plan = protocolPlan();
  container.textContent = format("ui.protocolPreview", "选择 {count} 个隔离因素：{axes}。导出文件将标记为待验证的研究设计。", {
    count: plan.held_out_axes.length, axes: plan.held_out_axes.map(axis => text(`ui.axis.${axis}`, axis)).join(" / ") || literal("尚未选择"),
  });
}

function exportProtocol() {
  download(JSON.stringify(protocolPlan(), null, 2) + "\n", "application/json;charset=utf-8", "face-fraud-protocol-design.json");
}

function librarySourceLink(keys, label = "查看对应研究") {
  const ids = Array.isArray(keys) ? keys.filter(key => state.papers.some(paper => paper.id === key)) : [];
  const node = el("a", "source-link", label);
  node.href = `#library?ids=${encodeURIComponent(ids.join(","))}`;
  if (!ids.length) { node.removeAttribute("href"); node.textContent = literal("未提供对应文献"); }
  return node;
}

function setupTaxonomy() {
  const select = $("#scenario-select");
  if (!select) return;
  select.replaceChildren(...state.taxonomy.scenarios.map(row => new Option(row.label || row.title || row.id, row.id)));
  select.addEventListener("change", renderScenario);
  renderScenario();
}

function renderScenario() {
  const container = $("#scenario-detail");
  if (!container) return;
  const scenario = state.taxonomy.scenarios.find(row => row.id === $("#scenario-select")?.value);
  if (!scenario) { empty(container, "攻击场景资料暂未加载。"); return; }
  const heading = el("h3", "", scenario.label || scenario.title || scenario.id);
  const facts = el("dl", "detail-facts scenario-facts");
  appendFact(facts, "进入方式", scenario.entry);
  appendFact(facts, "媒体生成方式", scenario.production);
  appendFact(facts, "参考风险", scenario.reference_risk);
  const claims = el("div", "scenario-claims");
  for (const claim of state.taxonomy.claims) {
    if (!scenario.claims?.includes(claim.id)) continue;
    const card = el("article", "claim-card");
    card.append(el("h4", "", claim.label), el("p", "", claim.description), librarySourceLink(claim.source_keys, "验证要求的来源"));
    claims.append(card);
  }
  container.replaceChildren(heading, el("p", "", scenario.description), facts,
    el("h4", "", "对应验证要求"), claims, librarySourceLink(scenario.source_keys, "查看此场景的机制研究"));
  if (state.taxonomy.scope_note) container.append(el("p", "scope-note", state.taxonomy.scope_note));
}

function renderFigures() {
  const container = $("#figure-grid");
  if (!container) return;
  if (!state.figures.length) { empty(container, "图形清单暂未加载。"); return; }
  const fragment = document.createDocumentFragment();
  for (const figure of state.figures) {
    const card = el("article", "figure-card");
    const body = el("div", "figure-body");
    const title = state.language === "zh" && figure.title_zh ? figure.title_zh : figure.title || format("ui.figureNumber", "图 {id}", { id: figure.id });
    const files = figure.files || {};
    const png = figure.png || figure.image || files.png;
    const imageURL = safeURL(png);
    if (imageURL) {
      const image = el("img", "figure-preview");
      image.src = imageURL;
      image.alt = figure.alt || title;
      image.loading = "lazy";
      image.decoding = "async";
      const preview = link("", png, "figure-image-link");
      preview.append(image);
      preview.setAttribute("aria-label", format("ui.openFigure", "打开 {title} 大图", { title }));
      card.append(preview);
    }
    if (figure.data_type) {
      const type = el("span", "badge figure-type", text(`ui.figureType.${figure.data_type}`, literal(figure.data_type)));
      type.title = text(`ui.figureScope.${figure.data_type}`, "");
      body.append(type);
    }
    body.append(el("h3", "", title));
    const description = state.language === "en" ? figure.description_en || figure.description || ""
      : figure.description_zh || figure.description || "";
    if (description) body.append(el("p", "", description));
    const actions = el("div", "figure-actions");
    for (const [format, value] of [["PNG", png], ["PDF", figure.pdf || files.pdf], ["SVG", figure.svg || files.svg]]) {
      if (!safeURL(value)) continue;
      const anchor = link(text(`ui.figureDownload.${format}`, literal(format)), value, "button secondary");
      anchor.setAttribute("download", "");
      actions.append(anchor);
    }
    body.append(actions);
    card.append(body);
    fragment.append(card);
  }
  container.replaceChildren(fragment);
}

function setupPreferences() {
  let savedTheme, savedLanguage;
  try {
    savedTheme = localStorage.getItem(PREFERENCE_KEYS.theme);
    savedLanguage = localStorage.getItem(PREFERENCE_KEYS.language);
  } catch { /* Storage may be unavailable. */ }
  const theme = ["light", "dark"].includes(savedTheme) ? savedTheme : "light";
  state.language = ["en", "zh"].includes(savedLanguage) ? savedLanguage : "en";
  document.documentElement.dataset.theme = theme;
  const themeButton = $("#theme-toggle");
  const updateThemeButton = () => {
    if (!themeButton) return;
    const dark = document.documentElement.dataset.theme === "dark";
    themeButton.setAttribute("aria-pressed", String(dark));
    themeButton.setAttribute("aria-label", literal(dark ? "切换浅色主题" : "切换深色主题"));
  };
  updateThemeButton();
  themeButton?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(PREFERENCE_KEYS.theme, next); } catch { /* No persistence required. */ }
    updateThemeButton();
  });
  const languageButton = $("#lang-toggle");
  const dictionary = globalThis.ATLAS_I18N;
  if (languageButton && dictionary?.zh && dictionary?.en) {
    languageButton.addEventListener("click", () => {
      state.language = state.language === "zh" ? "en" : "zh";
      try { localStorage.setItem(PREFERENCE_KEYS.language, state.language); } catch { /* No persistence required. */ }
      applyLanguage();
      updateThemeButton();
    });
  } else if (languageButton) {
    languageButton.hidden = true;
  }
  applyLanguage();
}

function applyLanguage() {
  document.documentElement.lang = state.language === "en" ? "en" : "zh-CN";
  const dictionary = globalThis.ATLAS_I18N || {};
  $$('[data-i18n]').forEach(node => {
    const value = dictionary[state.language]?.[node.dataset.i18n];
    if (typeof value === "string") node.textContent = value;
  });
  if ($("#lang-toggle")) {
    $("#lang-toggle").textContent = state.language === "zh" ? "English" : "中文";
    $("#lang-toggle").setAttribute("aria-label", state.language === "zh" ? "Switch interface to English" : "切换为中文界面");
  }
  if ($("#paper-search")) {
    $("#paper-search").placeholder = text("ui.searchPlaceholder", "搜索标题、作者、场所、关键词…");
    $("#paper-search").setAttribute("aria-label", text("ui.searchAria", "搜索文献"));
  }
  for (const selector of ["#protocol-workflow", "#protocol-entry"]) {
    for (const option of $$("option", $(selector) || document.createElement("select"))) {
      const prefix = selector === "#protocol-workflow" ? "workflow" : "entry";
      option.textContent = text(`ui.${prefix}.${option.value}`, option.textContent);
    }
  }
  for (const input of $$('[data-protocol-axis]')) {
    const wrapper = input.closest("label");
    const label = wrapper ? $("span", wrapper) : null;
    if (label) label.textContent = text(`ui.axis.${input.dataset.protocolAxis}`, label.textContent);
  }
  if (state.loaded) {
    populateLibraryFilters();
    renderPapers();
    renderBenchmarkTable();
    renderBenchmarkComparison();
    renderRisk();
    renderProtocolPreview();
    renderScenario();
    renderFigures();
    syncCounts();
  }
}

function syncCounts() {
  const research = state.papers.filter(isResearch);
  const counts = {
    research: research.length,
    official: state.papers.length - research.length,
    benchmarks: state.benchmarks.length,
    figures: state.figures.length,
    claims: state.taxonomy.claims.length,
  };
  for (const node of $$('[data-count]')) {
    if (Object.hasOwn(counts, node.dataset.count)) node.textContent = number(counts[node.dataset.count]);
  }
  const preprint = research.filter(paper => paper.publication_form === "preprint").length;
  for (const node of $$('[data-i18n="metricResearchSub"]')) {
    node.textContent = format("ui.countsResearchSub", "{published}项已出版 · {preprint}项预印本/技术报告", {
      published: number(research.length - preprint), preprint: number(preprint),
    });
  }
  for (const node of $$('[data-i18n="includeOfficial"]')) {
    node.textContent = format("ui.countsIncludeOfficial", "包括{count}项官方资源", { count: number(counts.official) });
  }
}

async function fetchData(filename) {
  const response = await fetch(new URL(`data/${filename}`, import.meta.url), { cache: "no-cache" });
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  return response.json();
}

async function loadData() {
  const tasks = ["catalog.json", "benchmarks.json", "taxonomy.json", "assets.json", "reading-notes.en.json"];
  const results = await Promise.allSettled(tasks.map(fetchData));
  const [catalog, benchmarks, taxonomy, assets, readingNotes] = results.map(result => result.status === "fulfilled" ? result.value : null);
  const notes = readingNotes?.notes || readingNotes;
  state.readingNotes = notes && typeof notes === "object" && !Array.isArray(notes) ? notes : {};
  if (catalog && Array.isArray(catalog.papers)) {
    const seen = new Set();
    state.papers = catalog.papers.filter(paper => paper.id && !seen.has(paper.id) && seen.add(paper.id));
    setupLibrary();
  } else {
    empty($("#paper-list"), "文献目录未能加载。请确认通过 HTTP 服务访问站点，并稍后刷新。", true);
    if ($("#paper-count")) $("#paper-count").textContent = literal("目录加载失败");
    for (const selector of ["#export-csv", "#export-bib"]) if ($(selector)) $(selector).disabled = true;
  }
  state.benchmarks = Array.isArray(benchmarks?.benchmarks) ? benchmarks.benchmarks : [];
  state.taxonomy = taxonomy && Array.isArray(taxonomy.scenarios) ? { ...taxonomy, claims: taxonomy.claims || [] } : { claims: [], scenarios: [] };
  state.figures = Array.isArray(assets) ? assets : Array.isArray(assets?.figures) ? assets.figures : [];
  setupBenchmarks();
  setupTaxonomy();
  renderFigures();
  state.loaded = true;
  syncCounts();
  readHash();
}

async function init() {
  setupTabs();
  setupDialog();
  setupPreferences();
  setupTools();
  for (const selector of ["#export-csv", "#export-bib"]) if ($(selector)) $(selector).disabled = true;
  empty($("#paper-list"), "正在加载已核验文献……");
  try { await loadData(); }
  catch (error) {
    console.error("Atlas initialization failed", error);
    empty($("#paper-list"), "界面加载遇到问题，请刷新重试。", true);
  }
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
else init();
