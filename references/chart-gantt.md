---
创建时间: 星期二, 十月 13日 2026, 8:54:48 晚上
修改时间: 星期二, 十月 13日 2026, 9:05:52 晚上
---

> 节选自 `制作更多数据视图.md` → **甘特图**（原内容未做改写）

# 甘特图

## 提示词模版 (甘特图)

```
# 数据来源
(文件、文件夹、当前知识库、元数据、隐藏元数据、内联元数据、笔记内容)

# 数据类型
(文本、元数据、隐藏元数据、内联元数据、待办任务列表)

# 视图类型
- 甘特图

# 视图配置
- 检索目标
	- 开始日期
	- 结束日期
 
# 颜色配置
	- 图例条的默认配色描述

在正式回答我的问题或提出解决方案之前，请先充分理解我的真实需求。
请遵循以下规则：
1. 不要急于给出最终答案。
2. 每次只向我提出一个最关键的问题。
3. 根据我的回答，动态决定下一步应该询问什么，而不是提前列出所有问题。
4. 如果我的回答存在歧义、遗漏或互相矛盾，请继续追问并澄清。
5. 不要为了尽快结束提问而自行假设我没有明确表达的信息。
6. 当你认为已经充分理解我的需求、目标、限制条件和期望结果时，再停止提问。
7. 在你确信自己已经能够准确执行我的最终目标（约95%的把握）后，再给出完整方案。
8. 如果已经获得足够信息，就不要为了达到某个固定的问题数量而继续提问。
最终回答时，请先简要总结你对我的需求的理解，然后再给出完整方案。
```

## 任务进度管理 (甘特图)

```dataviewjs
/* ================= 配置区（按需修改） ================= */
const CONFIG = {
  source: "",                 // 扫描文件夹，如 "任务面板"；留空 "" = 全库
  exclude: ["模版", "模板"],   // 排除的文件夹
  colWidth: { day: 36, week: 96, month: 160, quarter: 220 }, // 每刻度列宽(px)
  labelWidth: 230,            // 左侧任务名列宽(px)
  rowHeight: 30,
  headerHeight: 44,
  colorActive: "#5b8def",     // 进行中
  colorDone: "#6aa84f",       // 已完成
  colorOverdue: "#d9534f"     // 已逾期
};
const SCALES = [
  { id: "day", name: "日" },
  { id: "week", name: "周" },
  { id: "month", name: "月" },
  { id: "quarter", name: "季" }
];
/* ================= 配置区结束 ================= */

/* ================= 加载共享基座 ================= */
// 注意：基座只需加载一次。重复执行时若再次 await 加载，会让出执行权，
// Dataview 已清空的容器会被浏览器先渲染一帧空白（视图闪一下）。
// 因此已加载过时跳过重载，保证后续逻辑同步执行、不闪帧。
const BASE = "AI/提示词/DataViewJS/custom-view-base-entry.js";
if (!window.CustomViewBase) await eval(await dv.io.load(BASE));
const { TEXT, toHex, mkBtn, removeDataviewBlock, applyBorderStyle, isVisible, clearAutoRefresh, startAutoRefresh, makeCloseBtn } = window.CustomViewBase;

const VIEW_ID = "gantt-task-progress";
// VIEW_ID: gantt-task-progress
const FILEID = btoa(encodeURIComponent(dv.current()?.file?.path || "")).replace(/[^a-zA-Z0-9]/g, "").slice(-30);
const CONFIG_KEY = `gantt_ui_config_${FILEID}_${VIEW_ID}`;
const DEFAULTS = {
  clickModal: true,
  autoRefresh: false,
  refreshInterval: 30,
  refreshUnit: "sec",
  colorActive: CONFIG.colorActive,
  colorDone: CONFIG.colorDone,
  colorOverdue: CONFIG.colorOverdue,
  borderColor: "#FFFFFF",
  showBorder: true
};
let config = Object.assign({ ...DEFAULTS }, JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"));
const saveConfig = () => localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

function applyConfigColors() {
  CONFIG.colorActive = config.colorActive;
  CONFIG.colorDone = config.colorDone;
  CONFIG.colorOverdue = config.colorOverdue;
}

function applyLocalBorderStyle() {
  applyBorderStyle(wrapper, config.borderColor, config.showBorder);
}
const PANEL_HTML = `
<h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.14); padding-bottom: 5px; color: ${TEXT};">⚙️ 视图控制面板</h4>
<div style="margin-bottom: 15px;">
  <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; cursor: pointer; font-size: 13px; color: ${TEXT};">
    <input type="checkbox" class="ctrl-click-modal"> 点击任务显示详情弹窗
  </label>
</div>
<div style="margin-bottom: 15px;">
  <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">状态颜色:</div>
  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
    <span style="flex: 1; font-size: 12px; color: rgba(255,255,255,0.85);">进行中</span>
    <input type="color" class="ctrl-color-active" style="width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;">
  </div>
  <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
    <span style="flex: 1; font-size: 12px; color: rgba(255,255,255,0.85);">已完成</span>
    <input type="color" class="ctrl-color-done" style="width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;">
  </div>
  <div style="display: flex; align-items: center; gap: 6px;">
    <span style="flex: 1; font-size: 12px; color: rgba(255,255,255,0.85);">已逾期</span>
    <input type="color" class="ctrl-color-overdue" style="width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;">
  </div>
</div>
<div style="margin-bottom: 15px;">
  <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">视图边框:</div>
  <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; cursor: pointer; font-size: 13px; color: ${TEXT};">
    <input type="checkbox" class="ctrl-border-on"> 显示视图边框
  </label>
  <div style="display: flex; align-items: center; gap: 6px;">
    <span style="flex: 1; font-size: 12px; color: rgba(255,255,255,0.85);">边框颜色</span>
    <input type="color" class="ctrl-border-color" value="#FFFFFF" style="width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;">
  </div>
</div>
<div style="margin-bottom: 5px;">
  <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">自动刷新:</div>
  <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; cursor: pointer; font-size: 13px; color: ${TEXT};">
    <input type="checkbox" class="ctrl-auto-on"> 开启自动刷新
  </label>
  <div style="display: flex; gap: 6px;">
    <input type="number" class="ctrl-auto-val" min="1" placeholder="30" style="flex:1; width: 50%; padding: 6px 8px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
    <select class="ctrl-auto-unit" style="flex:1; padding: 6px 8px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
      <option value="sec">秒</option><option value="min">分钟</option>
    </select>
  </div>
  <div style="font-size: 11px; margin-top: 5px; color: rgba(255,255,255,0.45);">秒最低 5、分钟最低 1；笔记不可见时自动暂停</div>
</div>`;
/* ================= 视图控制面板结束 ================= */

const DAY = 86400000;
function d0(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function fmt(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) { const x = d0(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }
function toJsDate(v) { if (!v) return null; if (v.toJSDate) return d0(v.toJSDate()); const d = new Date(v); return isNaN(d) ? null : d0(d); }
function parseEmojiDate(text, emoji) {
  const m = text.match(new RegExp(emoji + "\\s*(\\d{4}-\\d{2}-\\d{2})"));
  return m ? d0(new Date(m[1] + "T00:00:00")) : null;
}
function cleanText(t) {
  return t
    .replace(/[🛫⏳📅✅➕]\s*\d{4}-\d{2}-\d{2}/g, "")
    .replace(/🔁[^🛫⏳📅✅➕⏫🔼🔽⏬]*/g, "")
    .replace(/[⏫🔼🔽⏬]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function baseName(path) { return path.split("/").pop().replace(/\.md$/, ""); }

/* ------- 状态（跨渲染保留） ------- */
const STATE_KEY = "__dvGanttState_v1";
window[STATE_KEY] = window[STATE_KEY] || {};
const sk = "gantt:" + (CONFIG.source || "__all__");
const state = window[STATE_KEY][sk] || (window[STATE_KEY][sk] = {});
const GANTT_DEFAULTS = {
  scale: "day", rangeStart: "", rangeEnd: "", todayLine: true,
  labelVisible: true, collapsed: {}
};
for (const k in GANTT_DEFAULTS) if (state[k] === undefined || state[k] === null) state[k] = GANTT_DEFAULTS[k];

/* ------- 来源（多选，localStorage 持久化，重启不丢） ------- */
const LS_KEY = "dvGantt.sources:" + sk;
if (!Array.isArray(state.sources)) {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { saved = null; }
  state.sources = Array.isArray(saved) ? saved
    : (CONFIG.source ? [{ type: "folder", path: CONFIG.source }] : []);
}
function saveSources() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state.sources)); } catch (e) { /* 忽略 */ }
}
function inSources(path) {
  if (!state.sources.length) return true;
  return state.sources.some(s => s.type === "file"
    ? path === s.path
    : (path === s.path || path.startsWith(s.path + "/")));
}
function allCandidates() {
  const folders = new Set();
  const files = [];
  for (const f of app.vault.getMarkdownFiles()) {
    files.push(f.path);
    const parts = f.path.split("/");
    for (let i = 1; i < parts.length; i++) folders.add(parts.slice(0, i).join("/"));
  }
  return { folders: [...folders].sort(), files: files.sort() };
}

/* ------- 收集任务 ------- */
function collectTasks() {
  const pages = dv.pages("");
  const out = [];
  for (const p of pages) {
    if (!p.file || !p.file.tasks) continue;
    if (!inSources(p.file.path)) continue;
    if (CONFIG.exclude.some(ex => p.file.path === ex || p.file.path.startsWith(ex + "/"))) continue;
    for (const t of p.file.tasks) {
      const start = toJsDate(t.start) || toJsDate(t.scheduled) || parseEmojiDate(t.text, "🛫") || parseEmojiDate(t.text, "⏳") || toJsDate(t.due) || parseEmojiDate(t.text, "📅");
      const end = toJsDate(t.due) || parseEmojiDate(t.text, "📅") || toJsDate(t.start) || parseEmojiDate(t.text, "🛫") || toJsDate(t.scheduled) || parseEmojiDate(t.text, "⏳");
      if (!start || !end) continue;
      out.push({
        text: cleanText(t.text) || "(无标题任务)",
        completed: !!t.completed,
        path: t.path,
        line: t.line,
        start: start,
        end: end < start ? start : end
      });
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

/* ------- 源文件读写工具 ------- */
async function locateTaskLine(lines, task) {
  let idx = task.line;
  if (!lines[idx] || !/^\s*[-*+]\s+\[.\]/.test(lines[idx])) {
    idx = lines.findIndex(l => /^\s*[-*+]\s+\[.\]/.test(l) && l.includes(task.text.slice(0, 12)));
  }
  return idx;
}
async function modifyTaskLine(task, transform) {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!file) return;
  const content = await app.vault.read(file);
  const lines = content.split("\n");
  const idx = await locateTaskLine(lines, task);
  if (idx < 0) return;
  lines[idx] = transform(lines[idx]);
  await app.vault.modify(file, lines.join("\n"));
}

/* 勾选完成状态 */
async function toggleTask(task, checked) {
  await modifyTaskLine(task, (line) => {
    if (checked) {
      line = line.replace(/^(\s*[-*+]\s+)\[.\]/, "$1[x]");
      if (!/✅\s*\d{4}-\d{2}-\d{2}/.test(line)) line += " ✅ " + fmt(new Date());
    } else {
      line = line.replace(/^(\s*[-*+]\s+)\[.\]/, "$1[ ]");
      line = line.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "");
    }
    return line;
  });
}

/* 拖动后回写日期 */
async function updateTaskDates(task, newStart, newEnd) {
  const s = fmt(newStart), e = fmt(newEnd);
  await modifyTaskLine(task, (line) => {
    if (/🛫\s*\d{4}-\d{2}-\d{2}/.test(line)) line = line.replace(/(🛫\s*)\d{4}-\d{2}-\d{2}/, "$1" + s);
    else line += " 🛫 " + s;
    if (/📅\s*\d{4}-\d{2}-\d{2}/.test(line)) line = line.replace(/(📅\s*)\d{4}-\d{2}-\d{2}/, "$1" + e);
    else line += " 📅 " + e;
    return line;
  });
}

/* 编辑任务文本 */
async function updateTaskText(task, newText) {
  await modifyTaskLine(task, (line) => {
    const prefix = (line.match(/^\s*[-*+]\s+\[.\]\s*/) || [""])[0];
    const annotations = line.match(/[🛫⏳📅✅➕]\s*\d{4}-\d{2}-\d{2}|🔁\s*\S+|[⏫🔼🔽⏬]/g) || [];
    return prefix + newText.trim() + (annotations.length ? " " + annotations.join(" ") : "");
  });
}

/* 删除任务行（含其计划日期） */
async function deleteTask(task) {
  const file = app.vault.getAbstractFileByPath(task.path);
  if (!file) return;
  const content = await app.vault.read(file);
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const idx = await locateTaskLine(lines, task);
  if (idx < 0) return;
  lines.splice(idx, 1);
  await app.vault.modify(file, lines.join("\n"));
}

/* ------- 打开来源笔记并定位到任务行 ------- */
async function openSource(path, line) {
  const f = app.vault.getAbstractFileByPath(path);
  if (!f) return;
  await app.workspace.getLeaf(false).openFile(f, { eState: { line: line } });
}

/* ------- 弹窗 ------- */
function openModal(root, task) {
  const old = root.querySelector(".gx-overlay");
  if (old) old.remove();
  const overlay = root.createDiv({ cls: "gx-overlay" });
  const modal = overlay.createDiv({ cls: "gx-modal" });

  const title = modal.createDiv({ cls: "gx-modal-title" });
  title.setText("任务详情");

  const statusRow = modal.createDiv({ cls: "gx-modal-row" });
  const cb = statusRow.createEl("input", { type: "checkbox" });
  cb.checked = task.completed;
  statusRow.createEl("span", { text: " 已完成" });
  cb.addEventListener("change", async () => {
    cb.disabled = true;
    await toggleTask(task, cb.checked);
    overlay.remove();
  });

  const dateRow = modal.createDiv({ cls: "gx-modal-row" });
  dateRow.setText("📆 " + fmt(task.start) + " → " + fmt(task.end));

  const editRow = modal.createDiv({ cls: "gx-modal-row" });
  const input = editRow.createEl("input", { type: "text", cls: "gx-input gx-edit-input" });
  input.value = task.text;
  const saveBtn = editRow.createEl("button", { text: "保存", cls: "gx-btn" });
  const doSave = async () => {
    const v = input.value.trim();
    if (!v || v === task.text) { overlay.remove(); return; }
    saveBtn.disabled = true;
    await updateTaskText(task, v);
    overlay.remove();
  };
  saveBtn.addEventListener("click", doSave);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") doSave(); });

  const srcRow = modal.createDiv({ cls: "gx-modal-row" });
  srcRow.createEl("span", { text: "来源：" });
  const link = srcRow.createEl("a", { text: task.path, cls: "gx-link" });
  link.addEventListener("click", async (e) => {
    e.preventDefault();
    overlay.remove();
    await openSource(task.path, task.line);
  });

  const delBtn = modal.createEl("button", { text: "删除任务", cls: "gx-btn" });
  delBtn.style.cssText = "background:var(--text-error);color:#fff;margin-right:auto;";
  delBtn.title = "两次点击删除，避免误删";
  let delState = 0;
  let delTimer = null;
  const resetDelBtn = () => {
    delState = 0;
    delBtn.textContent = "删除任务";
    delBtn.title = "两次点击删除，避免误删";
  };
  delBtn.addEventListener("click", async () => {
    if (delState === 0) {
      delState = 1;
      delBtn.textContent = "再次点击确认删除";
      delBtn.title = "3 秒内再次点击将删除该任务";
      if (delTimer) clearTimeout(delTimer);
      delTimer = setTimeout(resetDelBtn, 3000);
    } else {
      if (delTimer) clearTimeout(delTimer);
      resetDelBtn();
      delBtn.disabled = true;
      await deleteTask(task);
      overlay.remove();
    }
  });

  const closeBtn = modal.createEl("button", { text: "关闭", cls: "gx-btn gx-btn-plain" });
  closeBtn.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

/* ------- 主渲染（带工具栏包装） ------- */
let wrapper = null;
let chartContainer = null;
let panel = null;
let timers = { autoTimer: null, watchTimer: null };
const CACHE_KEY = `gantt_view_cache_${FILEID}_${VIEW_ID}`;

function startAuto() {
  startAutoRefresh({ timers, config, wrapper, visibleEl: chartContainer, onTick: () => { try { renderGantt(); } catch (e) { console.error(e); } } });
}

function syncFormUI() {
  if (!panel) return;
  panel.querySelector(".ctrl-click-modal").checked = !!config.clickModal;
  panel.querySelector(".ctrl-color-active").value = config.colorActive;
  panel.querySelector(".ctrl-color-done").value = config.colorDone;
  panel.querySelector(".ctrl-color-overdue").value = config.colorOverdue;
  panel.querySelector(".ctrl-border-on").checked = config.showBorder !== false;
  panel.querySelector(".ctrl-border-color").value = toHex(config.borderColor);
  panel.querySelector(".ctrl-auto-on").checked = !!config.autoRefresh;
  panel.querySelector(".ctrl-auto-val").value = config.refreshInterval;
  panel.querySelector(".ctrl-auto-unit").value = config.refreshUnit;
}

function renderGantt() {
  applyConfigColors();
  syncFormUI();
  if (!chartContainer) return;
  chartContainer.empty();
  injectStyle(chartContainer);
  const tasks = collectTasks();
  buildToolbar(chartContainer, tasks);
  buildLegend(chartContainer);
  const chartHolder = chartContainer.createDiv({ cls: "gx-chart-holder" });
  renderChart(chartHolder, tasks);
}

function buildToolbar(root, tasks) {
  const bar = root.createDiv({ cls: "gx-toolbar" });

  bar.createEl("span", { text: "范围:", cls: "gx-tb-label" });
  const startInput = bar.createEl("input", { type: "date", cls: "gx-input" });
  startInput.value = state.rangeStart;
  const endInput = bar.createEl("input", { type: "date", cls: "gx-input" });
  endInput.value = state.rangeEnd;
  startInput.addEventListener("change", () => { state.rangeStart = startInput.value; renderGantt(); });
  endInput.addEventListener("change", () => { state.rangeEnd = endInput.value; renderGantt(); });
  const allBtn = bar.createEl("button", { text: "全部", cls: "gx-btn" });
  allBtn.addEventListener("click", () => { state.rangeStart = ""; state.rangeEnd = ""; renderGantt(); });

  bar.createEl("span", { text: " 尺度:", cls: "gx-tb-label" });
  const sel = bar.createEl("select", { cls: "gx-input" });
  for (const s of SCALES) {
    const opt = sel.createEl("option", { text: s.name, value: s.id });
    if (s.id === state.scale) opt.selected = true;
  }
  sel.addEventListener("change", () => { state.scale = sel.value; renderGantt(); });

  const tlLabel = bar.createEl("label", { cls: "gx-tb-label gx-today-toggle" });
  const tlCb = tlLabel.createEl("input", { type: "checkbox" });
  tlCb.checked = state.todayLine;
  tlLabel.createEl("span", { text: " 今日竖线" });
  tlCb.addEventListener("change", () => { state.todayLine = tlCb.checked; renderGantt(); });

  const lvBtn = bar.createEl("button", { text: state.labelVisible ? "收起任务列" : "展开任务列", cls: "gx-btn gx-btn-plain" });
  lvBtn.addEventListener("click", () => { state.labelVisible = !state.labelVisible; renderGantt(); });

  const srcRow = bar.createDiv({ cls: "gx-sources-row" });
  srcRow.createEl("span", { text: "来源:", cls: "gx-tb-label" });
  const chipsBox = srcRow.createDiv({ cls: "gx-chips" });
  for (const s of state.sources) {
    const chip = chipsBox.createDiv({ cls: "gx-chip" });
    chip.createEl("span", { text: (s.type === "file" ? "📄 " : "📁 ") + s.path, cls: "gx-chip-text" });
    const x = chip.createEl("span", { text: "×", cls: "gx-chip-x" });
    x.title = "移除该来源";
    x.addEventListener("click", () => {
      state.sources = state.sources.filter(it => !(it.type === s.type && it.path === s.path));
      saveSources();
      renderGantt();
    });
  }
  const searchWrap = srcRow.createDiv({ cls: "gx-search-wrap" });
  const searchInput = searchWrap.createEl("input", { type: "text", cls: "gx-input gx-search-input" });
  searchInput.placeholder = state.sources.length ? "继续添加文件夹/文件…" : "搜索文件夹/文件（不选 = 全库扫描）";
  const dropdown = searchWrap.createDiv({ cls: "gx-dropdown" });
  dropdown.style.display = "none";

  function hideDropdown() { dropdown.style.display = "none"; }
  function showDropdown() {
    const q = searchInput.value.trim().toLowerCase();
    const cand = allCandidates();
    const picked = new Set(state.sources.map(s => s.type + ":" + s.path));
    const mf = (q ? cand.folders.filter(p => p.toLowerCase().includes(q)) : cand.folders).filter(p => !picked.has("folder:" + p));
    const mm = (q ? cand.files.filter(p => p.toLowerCase().includes(q)) : cand.files).filter(p => !picked.has("file:" + p));
    const items = mf.slice(0, 8).map(p => ({ type: "folder", path: p }))
      .concat(mm.slice(0, 8).map(p => ({ type: "file", path: p })));
    dropdown.empty();
    if (!items.length) { hideDropdown(); return; }
    for (const it of items) {
      const opt = dropdown.createDiv({ cls: "gx-dropdown-item" });
      opt.setText((it.type === "file" ? "📄 " : "📁 ") + it.path);
      opt.addEventListener("mousedown", (e) => {
        e.preventDefault();
        state.sources.push(it);
        saveSources();
        searchInput.value = "";
        renderGantt();
      });
    }
    dropdown.style.display = "block";
  }
  searchInput.addEventListener("input", showDropdown);
  searchInput.addEventListener("focus", showDropdown);
  searchInput.addEventListener("blur", () => setTimeout(hideDropdown, 150));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && dropdown.style.display !== "none") {
      const first = dropdown.querySelector(".gx-dropdown-item");
      if (first) first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    }
    if (e.key === "Escape") hideDropdown();
  });
}

function buildLegend(root) {
  const legend = root.createDiv({ cls: "gx-legend" });
  const items = [
    ["进行中", CONFIG.colorActive],
    ["已完成", CONFIG.colorDone],
    ["已逾期", CONFIG.colorOverdue]
  ];
  for (const [name, color] of items) {
    const item = legend.createDiv({ cls: "gx-legend-item" });
    const dot = item.createDiv({ cls: "gx-legend-dot" });
    dot.style.background = color;
    item.createEl("span", { text: name });
  }
}

function renderChart(holder, allTasks) {
  holder.empty();
  const today = d0(new Date());
  const lw = state.labelVisible ? CONFIG.labelWidth : 0;

  let tasks = allTasks;
  const rs = state.rangeStart ? d0(new Date(state.rangeStart + "T00:00:00")) : null;
  const re = state.rangeEnd ? d0(new Date(state.rangeEnd + "T00:00:00")) : null;
  if (rs || re) {
    tasks = allTasks.filter(t => (!re || t.start <= re) && (!rs || t.end >= rs));
  }
  if (tasks.length === 0) {
    holder.createDiv({ cls: "gx-empty", text: "当前条件下没有带日期的任务（需含 🛫/⏳/📅 中至少一个日期）" });
    return;
  }

  const groupMap = new Map();
  for (const t of tasks) {
    if (!groupMap.has(t.path)) groupMap.set(t.path, []);
    groupMap.get(t.path).push(t);
  }
  const groupList = [...groupMap.entries()].sort((a, b) => a[1][0].start - b[1][0].start);

  let minD = rs || tasks[0].start;
  let maxD = re || tasks.reduce((m, t) => t.end > m ? t.end : m, tasks[0].end);
  if (state.todayLine) {
    if (today < minD) minD = today;
    if (today > maxD) maxD = today;
  }

  const px = CONFIG.colWidth[state.scale] || 36;

  if (state.todayLine && !rs && !re) {
    const viewW = Math.max(400, (wrapper?.clientWidth || 800) - lw);
    const padCount = Math.max(1, Math.ceil(viewW / (2 * px)));
    const padDays = state.scale === "day" ? padCount
      : state.scale === "week" ? padCount * 7
      : state.scale === "month" ? padCount * 30
      : padCount * 90;
    minD = addDays(minD, -padDays);
    maxD = addDays(maxD, padDays);
  }

  const cols = [];
  if (state.scale === "day") {
    for (let d = startOfWeek(minD); d <= addDays(maxD, 1); d = addDays(d, 1)) {
      cols.push({ start: d, end: addDays(d, 1), px: px, label: (d.getMonth() + 1) + "/" + d.getDate(), sub: "日一二三四五六"[d.getDay()] });
    }
  } else if (state.scale === "week") {
    for (let d = startOfWeek(minD); d <= maxD; d = addDays(d, 7)) {
      cols.push({ start: d, end: addDays(d, 7), px: px, label: (d.getMonth() + 1) + "/" + d.getDate(), sub: "周" });
    }
  } else if (state.scale === "month") {
    for (let d = new Date(minD.getFullYear(), minD.getMonth(), 1); d <= maxD; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      cols.push({ start: d0(d), end: d0(new Date(d.getFullYear(), d.getMonth() + 1, 1)), px: px, label: d.getFullYear() + "年" + (d.getMonth() + 1) + "月", sub: "" });
    }
  } else {
    const q0 = Math.floor(minD.getMonth() / 3) * 3;
    for (let d = new Date(minD.getFullYear(), q0, 1); d <= maxD; d = new Date(d.getFullYear(), d.getMonth() + 3, 1)) {
      cols.push({ start: d0(d), end: d0(new Date(d.getFullYear(), d.getMonth() + 3, 1)), px: px, label: d.getFullYear() + " Q" + (Math.floor(d.getMonth() / 3) + 1), sub: "" });
    }
  }

  const offsets = [];
  let acc = 0;
  for (const c of cols) { offsets.push(acc); acc += c.px; }
  const totalW = acc;
  function timeToX(t) {
    const time = d0(t).getTime();
    if (time <= cols[0].start.getTime()) return 0;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (time < c.end.getTime()) {
        return offsets[i] + (time - c.start.getTime()) / (c.end.getTime() - c.start.getTime()) * c.px;
      }
    }
    return totalW;
  }
  function xToDate(x) {
    if (x <= 0) return cols[0].start;
    for (let i = 0; i < cols.length; i++) {
      if (x < offsets[i] + cols[i].px) {
        const frac = (x - offsets[i]) / cols[i].px;
        return d0(new Date(cols[i].start.getTime() + frac * (cols[i].end.getTime() - cols[i].start.getTime())));
      }
    }
    return d0(cols[cols.length - 1].end);
  }

  const scroller = holder.createDiv({ cls: "gx-scroller" });
  const content = scroller.createDiv({ cls: "gx-content" });
  content.style.width = (lw + totalW) + "px";

  const header = content.createDiv({ cls: "gx-header" });
  header.style.height = CONFIG.headerHeight + "px";
  if (state.labelVisible) {
    const headLabel = header.createDiv({ cls: "gx-label gx-head-label" });
    headLabel.style.width = lw + "px";
    headLabel.setText("任务 (" + tasks.length + ")");
  }
  const ticks = header.createDiv({ cls: "gx-ticks" });
  ticks.style.width = totalW + "px";
  for (const c of cols) {
    const tick = ticks.createDiv({ cls: "gx-tick" });
    tick.style.width = c.px + "px";
    tick.createDiv({ cls: "gx-tick-main", text: c.label });
    if (c.sub) tick.createDiv({ cls: "gx-tick-sub", text: c.sub });
  }

  const dragHint = holder.createDiv({ cls: "gx-drag-hint" });
  dragHint.style.display = "none";

  const body = content.createDiv({ cls: "gx-body" });
  for (const [path, gTasks] of groupList) {
    const isCollapsed = !!state.collapsed[path];

    const gRow = body.createDiv({ cls: "gx-row gx-group-row" });
    gRow.style.height = CONFIG.rowHeight + "px";
    if (state.labelVisible) {
      const gLabel = gRow.createDiv({ cls: "gx-label gx-group-label" });
      gLabel.style.width = lw + "px";
      gLabel.setText((isCollapsed ? "▸ " : "▾ ") + baseName(path) + " (" + gTasks.length + ")");
      gLabel.addEventListener("click", () => {
        if (isCollapsed) delete state.collapsed[path]; else state.collapsed[path] = true;
        renderChart(holder, allTasks);
      });
    }
    const gLane = gRow.createDiv({ cls: "gx-lane gx-group-lane" });
    gLane.style.width = totalW + "px";
    gLane.addEventListener("click", () => {
      if (isCollapsed) delete state.collapsed[path]; else state.collapsed[path] = true;
      renderChart(holder, allTasks);
    });

    if (isCollapsed) continue;

    for (const t of gTasks) {
      const row = body.createDiv({ cls: "gx-row" });
      row.style.height = CONFIG.rowHeight + "px";
      if (state.labelVisible) {
        const label = row.createDiv({ cls: "gx-label gx-row-label" + (t.completed ? " gx-done-text" : "") });
        label.style.width = lw + "px";
        const tcb = label.createEl("input", { type: "checkbox", cls: "gx-row-cb" });
        tcb.checked = t.completed;
        tcb.addEventListener("click", (e) => e.stopPropagation());
        tcb.addEventListener("change", async () => {
          tcb.disabled = true;
          await toggleTask(t, tcb.checked);
        });
        const nameSpan = label.createEl("span", { text: t.text, cls: "gx-row-name" });
        nameSpan.title = t.text + "  (" + t.path + ":" + (t.line + 1) + ")";
        nameSpan.addEventListener("click", () => { if (config.clickModal) openModal(holder, t); });
      }

      const lane = row.createDiv({ cls: "gx-lane" });
      lane.style.width = totalW + "px";
      const left = timeToX(t.start);
      const right = timeToX(addDays(t.end, 1));
      const w = Math.max(right - left, 6);
      const bar = lane.createDiv({ cls: "gx-bar" });
      bar.style.left = left + "px";
      bar.style.width = w + "px";
      const overdue = !t.completed && t.end < today;
      bar.style.background = t.completed ? CONFIG.colorDone : (overdue ? CONFIG.colorOverdue : CONFIG.colorActive);
      bar.setText(t.text);
      bar.title = t.text + "\n" + fmt(t.start) + " → " + fmt(t.end) + "\n" + t.path;

      const hL = bar.createDiv({ cls: "gx-handle gx-handle-l" });
      const hR = bar.createDiv({ cls: "gx-handle gx-handle-r" });

      attachDrag(bar, hL, hR, t, dragHint);

      bar.addEventListener("click", () => {
        if (bar.dataset.dragged === "1") { bar.dataset.dragged = ""; return; }
        if (config.clickModal) openModal(holder, t);
      });
    }
  }

  function attachDrag(bar, hL, hR, task, hint) {
    let mode = null, startClientX = 0, origLeft = 0, origW = 0, moved = false;

    function begin(e, m) {
      e.preventDefault();
      e.stopPropagation();
      mode = m;
      moved = false;
      startClientX = e.clientX;
      origLeft = parseFloat(bar.style.left);
      origW = parseFloat(bar.style.width);
      document.body.classList.add("gx-dragging");
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp, { once: true });
    }
    function onMove(e) {
      const dx = e.clientX - startClientX;
      if (Math.abs(dx) > 3) moved = true;
      if (!moved) return;
      let newLeft = origLeft, newW = origW;
      if (mode === "move") {
        newLeft = Math.max(0, Math.min(origLeft + dx, totalW - origW));
      } else if (mode === "left") {
        newLeft = Math.max(0, Math.min(origLeft + dx, origLeft + origW - 6));
        newW = origW + (origLeft - newLeft);
      } else {
        newW = Math.max(6, Math.min(origW + dx, totalW - origLeft));
      }
      bar.style.left = newLeft + "px";
      bar.style.width = newW + "px";
      const ns = mode === "move" ? xToDate(newLeft) : (mode === "left" ? xToDate(newLeft) : task.start);
      const neRaw = mode === "right" ? addDays(xToDate(newLeft + newW), -1) : (mode === "move" ? addDays(ns, Math.round((task.end - task.start) / DAY)) : task.end);
      hint.style.display = "block";
      hint.setText(fmt(ns) + " → " + fmt(neRaw < ns ? ns : neRaw));
    }
    async function onUp(e) {
      window.removeEventListener("pointermove", onMove);
      document.body.classList.remove("gx-dragging");
      hint.style.display = "none";
      if (!moved) { mode = null; return; }
      bar.dataset.dragged = "1";
      const newLeft = parseFloat(bar.style.left);
      const newW = parseFloat(bar.style.width);
      let ns, ne;
      if (mode === "move") {
        ns = xToDate(newLeft);
        ne = addDays(ns, Math.round((task.end - task.start) / DAY));
      } else if (mode === "left") {
        ns = xToDate(newLeft);
        ne = task.end;
        if (ne < ns) ne = ns;
      } else {
        ns = task.start;
        ne = addDays(xToDate(newLeft + newW), -1);
        if (ne < ns) ne = ns;
      }
      mode = null;
      await updateTaskDates(task, ns, ne);
    }
    bar.addEventListener("pointerdown", (e) => begin(e, "move"));
    hL.addEventListener("pointerdown", (e) => begin(e, "left"));
    hR.addEventListener("pointerdown", (e) => begin(e, "right"));
  }

  if (state.todayLine && cols.length) {
    let lineX = lw + timeToX(today) + (state.scale === "day" ? px / 2 : 0);
    lineX = Math.max(lw, Math.min(lw + totalW, lineX));
    const line = content.createDiv({ cls: "gx-today-line" });
    line.style.left = lineX + "px";
    const tag = content.createDiv({ cls: "gx-today-tag" });
    tag.style.left = lineX + "px";
    tag.setText("今天");
    requestAnimationFrame(() => {
      const viewW = scroller.clientWidth - lw;
      const maxScroll = Math.max(0, content.offsetWidth - scroller.clientWidth);
      scroller.scrollLeft = Math.min(maxScroll, Math.max(0, lineX - lw - viewW / 2));
    });
  }
}

/* ------- 样式 ------- */
function injectStyle(root) {
  const style = root.createEl("style");
  style.textContent = [
    ".gx-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:6px;font-size:13px;color:var(--text-normal)}",
    ".gx-tb-label{color:var(--text-muted)}",
    ".gx-input{background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;padding:2px 6px;font-size:12px}",
    ".gx-btn{background:var(--interactive-accent);color:var(--text-on-accent);border:none;border-radius:4px;padding:3px 12px;font-size:12px;cursor:pointer}",
    ".gx-btn-plain{background:var(--background-secondary);color:var(--text-normal);border:1px solid var(--background-modifier-border)}",
    ".gx-today-toggle{display:flex;align-items:center;cursor:pointer;margin-left:8px}",
    ".gx-legend{display:flex;gap:16px;align-items:center;margin-bottom:6px;font-size:12px;color:var(--text-muted)}",
    ".gx-legend-item{display:flex;align-items:center;gap:5px}",
    ".gx-legend-dot{width:12px;height:12px;border-radius:3px;flex:0 0 auto}",
    ".gx-empty{padding:20px;color:var(--text-muted);font-size:13px}",
    ".gx-scroller{overflow-x:auto;overflow-y:hidden;border:1px solid var(--background-modifier-border);border-radius:6px;max-width:100%}",
    ".gx-content{position:relative}",
    ".gx-header{display:flex;position:sticky;top:0;background:var(--background-secondary);border-bottom:1px solid var(--background-modifier-border);z-index:2}",
    ".gx-label{flex:0 0 auto;position:sticky;left:0;z-index:4;background:var(--background-primary);border-right:1px solid var(--background-modifier-border);overflow:hidden;white-space:nowrap;padding:0 8px;display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-normal)}",
    ".gx-head-label{background:var(--background-secondary);z-index:6;font-weight:600}",
    ".gx-group-row{background:var(--background-secondary)}",
    ".gx-group-label{background:var(--background-secondary);cursor:pointer;font-weight:600}",
    ".gx-group-lane{cursor:pointer}",
    ".gx-ticks{display:flex;flex:0 0 auto}",
    ".gx-tick{flex:0 0 auto;border-left:1px solid var(--background-modifier-border);text-align:center;overflow:visible;display:flex;flex-direction:column;justify-content:center}",
    ".gx-tick-main{font-size:12px;color:var(--text-normal);white-space:nowrap}",
    ".gx-tick-sub{font-size:10px;color:var(--text-faint);white-space:nowrap}",
    ".gx-row{display:flex;border-bottom:1px solid var(--background-modifier-border)}",
    ".gx-row:hover .gx-label{background:var(--background-secondary)}",
    ".gx-row-cb{flex:0 0 auto;cursor:pointer}",
    ".gx-row-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}",
    ".gx-done-text .gx-row-name{text-decoration:line-through;color:var(--text-faint)}",
    ".gx-lane{flex:0 0 auto;position:relative}",
    ".gx-bar{position:absolute;top:5px;bottom:5px;border-radius:4px;color:#fff;font-size:11px;line-height:1.6;padding:0 8px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:grab;opacity:0.92;touch-action:none}",
    ".gx-bar:hover{opacity:1;box-shadow:0 0 0 2px var(--interactive-accent)}",
    ".gx-handle{position:absolute;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:2}",
    ".gx-handle-l{left:0;border-radius:4px 0 0 4px}",
    ".gx-handle-r{right:0;border-radius:0 4px 4px 0}",
    ".gx-handle:hover{background:rgba(255,255,255,0.35)}",
    ".gx-drag-hint{position:sticky;bottom:4px;left:40%;display:inline-block;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--interactive-accent);border-radius:4px;padding:2px 10px;font-size:12px;z-index:10;pointer-events:none;width:max-content;margin:4px auto}",
    "body.gx-dragging{user-select:none;cursor:grabbing}",
    ".gx-today-line{position:absolute;top:0;bottom:0;width:2px;background:var(--interactive-accent);z-index:3;pointer-events:none}",
    ".gx-today-tag{position:absolute;top:2px;transform:translateX(-50%);background:var(--interactive-accent);color:var(--text-on-accent);font-size:10px;padding:0 5px;border-radius:3px;z-index:5;pointer-events:none}",
    ".gx-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:999;display:flex;align-items:center;justify-content:center}",
    ".gx-modal{background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:8px;padding:16px 20px;min-width:320px;max-width:520px;box-shadow:0 8px 30px rgba(0,0,0,0.4)}",
    ".gx-modal-title{font-weight:600;font-size:15px;margin-bottom:12px}",
    ".gx-modal-row{margin-bottom:10px;font-size:13px;display:flex;align-items:center;flex-wrap:wrap;gap:6px}",
    ".gx-edit-input{flex:1;min-width:180px}",
    ".gx-link{color:var(--interactive-accent);cursor:pointer;word-break:break-all}",
    ".gx-modal .gx-btn{margin-top:2px}",
    ".gx-sources-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px;flex-basis:100%;margin-top:6px}",
    ".gx-chips{display:flex;flex-wrap:wrap;gap:4px}",
    ".gx-chip{display:flex;align-items:center;gap:4px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:10px;padding:1px 8px;font-size:12px;color:var(--text-normal)}",
    ".gx-chip-text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:260px}",
    ".gx-chip-x{cursor:pointer;color:var(--text-muted);font-weight:600;padding:0 2px}",
    ".gx-chip-x:hover{color:var(--text-error)}",
    ".gx-search-wrap{position:relative;flex:1;min-width:180px}",
    ".gx-search-input{width:100%;box-sizing:border-box}",
    ".gx-dropdown{position:absolute;top:100%;left:0;right:0;z-index:50;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;max-height:260px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,0.3)}",
    ".gx-dropdown-item{padding:4px 10px;font-size:12px;color:var(--text-normal);cursor:pointer;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}",
    ".gx-dropdown-item:hover{background:var(--background-secondary)}"
  ].join("\n");
}

/* ------- 初始化 ------- */
// 数据签名：笔记编辑会触发 Dataview 重新执行整个代码块（与自动刷新开关无关）。
// 若任务数据没有变化，直接复用旧 DOM（不重建、不闪、滚动位置不丢）；
// 数据真变了才走下方正常的重建流程。刷新逻辑仍由初版 startAuto 控制。
function dataSig() {
  // 行号 t.line 会随手在任务上方敲字而整体偏移，不代表任务数据变化，必须剔除；
  // 文本剔除尾随的 ^块ID，避免给任务行加块引用时被误判为数据变化。
  return JSON.stringify(collectTasks().map(t => [t.path, t.completed, +t.start, +t.end, t.text.replace(/\s*\^[A-Za-z0-9-]+$/, "")]));
}

const currentSig = dataSig();
const oldCache = window[CACHE_KEY];
if (oldCache?.timers) clearAutoRefresh(oldCache.timers);

if (oldCache?.wrapper && oldCache.sig === currentSig) {
  wrapper = oldCache.wrapper;
  chartContainer = oldCache.chartContainer;
  panel = oldCache.panel;
  timers = oldCache.timers || timers;
  if (!wrapper.isConnected) dv.container.appendChild(wrapper);
  applyLocalBorderStyle();
  syncFormUI();
  startAuto();
  window[CACHE_KEY] = { wrapper, chartContainer, panel, timers, sig: currentSig };
  return;
}
if (oldCache?.wrapper?.isConnected) oldCache.wrapper.remove();

wrapper = document.createElement("div");
wrapper.style.cssText = "position: relative; display: block; isolation: isolate; z-index: 1; padding-top: 46px; width: 100%; box-sizing: border-box;";

const ui = document.createElement("div");
ui.style.cssText = "position: absolute; top: 10px; left: 10px; display: flex; align-items: flex-start; gap: 8px; z-index: 100;";

panel = document.createElement("div");
panel.style.cssText = "display: none; position: absolute; top: 38px; left: 0; width: 270px; max-height: 420px; overflow-y: auto; background: rgba(18,18,18,0.96); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.55); text-align: left;";
panel.innerHTML = PANEL_HTML;

ui.appendChild(mkBtn("settings", "视图设置", () => {
  panel.style.display = panel.style.display === "none" ? "block" : "none";
}));
ui.appendChild(mkBtn("refresh-cw", "手动刷新数据", () => { renderGantt(); startAuto(); }));
ui.appendChild(mkBtn("rotate-ccw", "恢复默认视图", () => {
  for (const k in DEFAULTS) config[k] = DEFAULTS[k];
  syncFormUI();
  saveConfig();
  renderGantt();
  startAuto();
}));
ui.appendChild(makeCloseBtn({ viewId: VIEW_ID, dv, wrapper }));
ui.appendChild(panel);
wrapper.appendChild(ui);

chartContainer = document.createElement("div");
chartContainer.style.cssText = "position: relative; z-index: 2; width: 100%;";
wrapper.appendChild(chartContainer);

dv.container.appendChild(wrapper);
applyLocalBorderStyle();

const q = (sel) => panel.querySelector(sel);
q(".ctrl-click-modal").onchange = (e) => { config.clickModal = e.target.checked; saveConfig(); };
q(".ctrl-border-on").onchange = (e) => { config.showBorder = e.target.checked; saveConfig(); applyLocalBorderStyle(); };
q(".ctrl-border-color").onchange = (e) => { config.borderColor = e.target.value; saveConfig(); applyLocalBorderStyle(); };
q(".ctrl-color-active").onchange = (e) => { config.colorActive = e.target.value; CONFIG.colorActive = e.target.value; saveConfig(); renderGantt(); };
q(".ctrl-color-done").onchange = (e) => { config.colorDone = e.target.value; CONFIG.colorDone = e.target.value; saveConfig(); renderGantt(); };
q(".ctrl-color-overdue").onchange = (e) => { config.colorOverdue = e.target.value; CONFIG.colorOverdue = e.target.value; saveConfig(); renderGantt(); };
q(".ctrl-auto-on").onchange = (e) => { config.autoRefresh = e.target.checked; saveConfig(); startAuto(); };
const applyAuto = () => {
  config.refreshUnit = q(".ctrl-auto-unit").value;
  const min = config.refreshUnit === "min" ? 1 : 5;
  const max = config.refreshUnit === "min" ? 1440 : 3600;
  let v = parseInt(q(".ctrl-auto-val").value);
  if (isNaN(v)) v = min;
  config.refreshInterval = Math.min(max, Math.max(min, v));
  q(".ctrl-auto-val").value = config.refreshInterval;
  saveConfig();
  startAuto();
};
q(".ctrl-auto-val").onchange = applyAuto;
q(".ctrl-auto-unit").onchange = applyAuto;

renderGantt();
startAuto();

window[CACHE_KEY] = { wrapper, chartContainer, panel, timers, sig: currentSig };
```
