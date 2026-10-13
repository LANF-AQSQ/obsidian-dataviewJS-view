---
创建时间: 星期二, 十月 13日 2026, 9:02:45 晚上
修改时间: 星期二, 十月 13日 2026, 9:05:48 晚上
---

# 基座 API 速查

业务代码只消费这些 API。**不在这里面的能力，业务代码一律不许自己实现。**

（本文件由 `assets/*.js` 源码整理，版本以源码头部注释为准）

## EChartsViewBase（v1.3）

```js
window.EchartsViewBase = {
  create,            // (dv, opts) => Promise
  loadEcharts,       // () => Promise
  COLORS, TEXT, AXIS_LINE, SPLIT_LINE,
  VERSION            // "1.3"
};
```

**常量：**

| 常量 | 值 |
|---|---|
| `COLORS` | `#FF2A2A #FF7A00 #FFD700 #00E676 #00BFFF #9D00FF #FF007F`（彩虹） |
| `PALETTES` | `rainbow` / `warm` / `cool` / `mint` / `pastel`（面板可选） |
| `TEXT` | `#FFFFFF` |
| `AXIS_LINE` | `rgba(255,255,255,0.35)` |
| `SPLIT_LINE` | `rgba(255,255,255,0.10)` |
| ECharts CDN | `https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js` |

**`create(dv, opts)` 的 opts：**

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓（强烈建议） | 视图唯一英文 ID。清洗规则 `String(id).replace(/[^a-zA-Z0-9_-]/g, "")`，同一笔记不可重复 |
| `fetchData` | ✓ | `async (dv) => data`，无数据返回 `{ emptyText }` |
| `hasData` | ✓ | `(data) => boolean`，入参可能是 `{}` |
| `buildOption` | ✓ | `(data, ctx) => option` |
| `onItemClick` |  | `(params, data) => ({title, items}) \| null` |
| `defaults` |  | 覆盖下面 DEFAULTS 的部分字段 |

**`buildOption` 第二个参数（ctx）提供：**

| ctx 字段 | 用途 |
|---|---|
| `legendOpt` | 已按面板配置的图例选项，务必 `{ ...legendOpt, data: [...] }` |
| `gridOpt` | 已与图例隔离的 grid 边距，直角坐标系图表必须 `grid: gridOpt` |
| `config` | 当前面板配置对象（见下） |
| `COLORS` / `TEXT` / `AXIS_LINE` / `SPLIT_LINE` | 配色常量 |

**面板 DEFAULTS（= `ctx.config` 默认形态）：**

```js
{ size: 500,            // 高度 px，或 'auto'
  legendShow: true,
  legendPos: 'bottom-center',
  align: 'center',      // left / center / right
  clickDetail: true,    // 点击弹窗开关
  autoRefresh: false,
  refreshInterval: 30,
  refreshUnit: 'sec',   // 'sec' | 'min'（秒最低 5，分钟最低 1）
  palette: 'rainbow',
  legendColor: '#FFFFFF',
  seriesColors: {},
  borderColor: 'rgba(255,255,255,0.35)',
  showBorder: true }
```

**持久化键**（调试时用，浏览器 devtools 里看 localStorage）：

- `echarts_persist_${FILEID}_${INST}` — DOM / chart 实例缓存（内存，挂在 window 上）
- `echartsdata_cache_${FILEID}_${VIEW_ID}` — 数据缓存
- `echarts_ui_config_${FILEID}_${VIEW_ID}` — 面板配置
- `echarts_observer_${FILEID}_${INST}` — ResizeObserver（自动 resize）

`FILEID` = `btoa(encodeURIComponent(当前文件路径))` 去非字母数字后取末 30 位。

**关闭视图按钮**：定位并删除当前笔记里含

`(?:id|VIEW_ID)\s*[:=]\s*["']<id>["']` 的 `dataviewjs` 代码块（连同其后空行）。

## CustomViewBase（v1.1，非 ECharts 视图 / 自定义 DOM 视图用）

```js
window.CustomViewBase = {
  VERSION, TEXT, DEFAULT_BORDER,
  toHex, mkBtn, copyText, applyBorderStyle, isVisible,
  clearAutoRefresh, startAutoRefresh, removeDataviewBlock, makeCloseBtn
};
```

| API | 说明 |
|---|---|
| `toHex(c)` | rgba / hex 统一转 6 位 hex，喂给 `<input type="color">` |
| `mkBtn(icon, title, onClick)` | 左上角工具栏按钮；`obsidian` 取不到时自动降级 emoji |
| `removeDataviewBlock(dv, viewId)` | 删除代码块。支持三种 ID 写法：`id: "..."`、`const VIEW_ID = "..."`、`// VIEW_ID: xxx` |
| `applyBorderStyle(wrapper, color, showBorder)` | 统一圆角边框，`showBorder=false` 强制去边框 |
| `copyText(text)` | execCommand → electron clipboard → Clipboard API 三级降级 |
| `isVisible(el)` | `checkVisibility()` 失败时用 `offsetParent` 兜底 |
| `clearAutoRefresh(timers)` | 清 `autoTimer` / `watchTimer` |
| `startAutoRefresh(opts)` | 见下 |
| `makeCloseBtn(opts)` | 两段式（点两次）关闭按钮，`opts = { viewId, dv, wrapper, onBeforeDelete, onAfterDelete, onError }` |

```js
startAutoRefresh({
  timers,            // {} 容器，注意：引用要保持稳定，不要重新赋值
  config,            // 含 autoRefresh / refreshInterval / refreshUnit
  wrapper, visibleEl,
  onTick,            // 刷新回调
  onVisibleChange    // 可选，(visible) => {}
});
// 间隔换算：min → v*60000；sec → max(5, v)*1000
// 不可见时自动跳过 tick；wrapper 脱离文档后自动清定时器（防泄漏）
```

## 排查清单（视图白屏 / 不显示时按顺序查）

1. 库里是否存在 `echarts-view-base.js`（或被入口文件指向的实现）？路径对不对？→ 跑 `find_base.py`
2. 同名的基座实现文件是不是不止一份？→ 重名会导致加载到错误版本
3. 同一笔记里是不是有重复的 `id`？→ 视图串数据、关闭按钮删错块
4. 是不是写了 `(0, eval)`？→ `dv` / `obsidian` 取不到，报 `xxx is not defined`
5. 代码块里是否有 3 个连续反引号？→ 围栏提前闭合，代码被截断
6. `buildOption` 返回的对象里 `series` 是否为空数组？→ 基座判定为无数据
