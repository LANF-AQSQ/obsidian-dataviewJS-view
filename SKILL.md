---
创建时间: 星期二, 十月 13日 2026, 9:01:24 晚上
修改时间: 星期二, 十月 13日 2026, 9:06:32 晚上
description: 在 Obsidian 中用 DataviewJS + ECharts 制作数据视图（折线图、条形图、饼图、子弹图/进度条、甘特图、自定义视图、表格）。当用户要在笔记里做统计图表/可视化看板/任务进度条/甘特图，或提到 dataviewjs、echarts-view-base.js、custom-view-base.js、"数据视图制作"时使用。
name: obsidian-dataview-view
---

# Obsidian 数据视图生成器

把用户的自然语言需求，变成一个能直接粘贴进 Obsidian 笔记的 `dataviewjs` 代码块。

用户的知识库里已经有**共享基座**（负责 ECharts 加载、控制面板、配置持久化、自动刷新、

点击弹窗、空态/报错兜底、关闭视图按钮），你**只写业务部分**，绝不重复实现这些能力。

## 工作流

### 1. 澄清需求（沿用原提示词的提问纪律）

不要拿到需求就开写。按下面的顺序，**每次只问一个最关键的问题**，根据回答动态决定下一个问题，

不是一次性列清单。四个必填维度：**数据来源 / 数据类型 / 视图类型 / 其他要求**。

- 不要急于给最终答案，不要在信息不足时自行假设。
- 如果用户描述有歧义或自相矛盾，继续追问澄清。
- 信息够了就停（约 95% 把握），不要为了凑提问数量继续问。
- **最终回答时，先一句话总结你对需求的理解，再给完整方案。**

### 2. 定位基座路径（这一步不能跳过）

视图代码块顶部要写一个指向基座的相对路径，它**每个库都不一样**。先用脚本查准：

```bash
python scripts/find_base.py "<Obsidian库根目录>"
```

输出里取 `OK` 行的相对路径。若某个基座文件命中多个 → 先告诉用户清理到唯一，

否则 `*base-entry.js` 靠文件名定位会加载到错误实现。

### 3. 读对应的 reference

按用户要的视图类型，读**一个** reference 就够了（模板 + 可直接改的完整示例都在里面）：

| 视图类型 | 文件 | 走哪个基座 |
|---|---|---|
| 折线图 | `references/chart-line.md` | ECharts |
| 条形图 | `references/chart-bar.md` | ECharts |
| 饼图 | `references/chart-pie.md` | ECharts |
| 子弹图/进度条 | `references/chart-bullet.md` | ECharts |
| 甘特图 | `references/chart-gantt.md` | CustomViewBase（自定义 DOM） |
| 表格 | `references/chart-table.md` | CustomViewBase |
| 契约原文（首提示词） | `references/core-contract.md` | — |
| 基座 API 速查 | `references/base-api.md` | — |

### 4. 交付前体检（强制）

```bash
python scripts/check_dataviewjs.py "<生成/修改的 .md 文件>"
```

有 `ERROR` 必须修完再交付；`WARN` 逐条确认。>200 行的代码块尤其要跑——

DataviewJS 走 `eval`，少一个括号整段都不执行，肉眼很难看出来。

## 硬性约束

**代码结构（ECharts 类，`chart-*.md` 示例均为此结构）：**

```js
const ENTRY = "<第2步查到的相对路径>";
await eval(await dv.io.load(ENTRY));           // ①必须直接 eval
await window.EchartsViewBase.create(dv, {       // ②
    id: "视图唯一英文ID",
    fetchData: async (dv) => { ... },
    hasData: (d) => ...,
    buildOption: (d, ctx) => ({ ... })
});
```

- ① **禁止写成 `(0, eval)`**：间接 eval 会让代码跑在全局作用域，取不到块级作用域里的
  `obsidian` / `dv` / `app`，直接报 `xxx is not defined`。
- ② **禁止用 try/catch 包住 `create`**，基座已有统一错误兜底。
- 业务代码控制在 **70 行以内**（甘特图这类自定义 DOM 视图除外）。

**三个函数的分工：**

- `fetchData`：只查数、只 return 数据对象；无数据 return `{ emptyText: "原因" }`。
  禁止在这里 `setOption` 或操作 DOM。
- `hasData`：return 布尔；注意入参可能是空对象 `{}`。
- `buildOption`：return ECharts option 片段。**必须**用 ctx 透传的值：
  `ctx.legendOpt`（图例）、`ctx.gridOpt`（网格）、`ctx.config`、`ctx.COLORS`、`ctx.TEXT`
  （`#FFFFFF`）、`ctx.AXIS_LINE`、`ctx.SPLIT_LINE`。
  - 直角坐标系图表：**必须** `grid: ctx.gridOpt`，图例必须 `legend: { ...ctx.legendOpt, data: [...] }`。
  - 饼图/日历图等无坐标轴图表：**不要**返回 `grid/xAxis/yAxis`，图例避让自己挪 `center`。
- `onItemClick`（可选）：`(params, data) => ({ title, items })`，返回 `null` 不弹窗。
  items 元素三种形态：`{ text }` / `{ text, link }` / `{ text, task: {path,line,completed} }`
  （task 形态可在弹窗里直接勾选，并写回源文件）。

**配色与刷新（踩过坑，别自己发明）：**

- 文字颜色统一 `ctx.TEXT`；数据染色默认走 `ctx.COLORS` 彩虹序列。
  **不要硬编码 color 数组**，除非需求明确指定（如进度条绿/白）——否则基座的
  5 套调色板 + 单系列取色器就失效了。
- **禁止自己写定时器/自动刷新**，一律用基座控制面板的开关（支持秒/分钟，笔记不可见自动暂停）。
- 空数据标题、加载动画、报错展示都由基座处理，不要在 `buildOption` 里写空态逻辑。

**写进 .md 时的围栏纪律：**

- 代码块内部**禁止出现三个连续的反引号字符**（哪怕是正则里）——会提前闭合外层围栏，
  Obsidian 渲染和脚本提取双双截断。要匹配它就用量词写法 ``/`{3}/g``，注释里也不能直写。
- 同一笔记里多个视图必须有**不同的 `id`**，否则视图互相串数据，且「关闭视图」会删错块。

## 附件

- `assets/echarts-view-base.js`（v1.3）、`assets/custom-view-base.js`（v1.1）：
  基座参考实现的**备份副本**。放在这里是为了让 skill 自包含、方便在新库里落地。
  它们**不参与** `find_base.py` 的定位（脚本已自动跳过）。要在别的库使用时，
  应该复制出去并**替换**已有实现，而不是新增第二份 —— 同库内同名文件必须唯一。
- `references/base-api.md`：基座暴露的所有 API 与默认配置值，改高级行为前先看它。
