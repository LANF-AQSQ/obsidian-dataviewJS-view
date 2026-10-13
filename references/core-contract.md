---
创建时间: 星期二, 十月 13日 2026, 8:54:48 晚上
修改时间: 星期二, 十月 13日 2026, 9:05:51 晚上
---

> 节选自 `制作更多数据视图.md` → **核心契约 / 首提示词**（原内容未做改写）

# 首提示词

- 用于首次与 Ai 对话时输入的提示词
- [[custom-view-base.js]] 与 [[echarts-view-base.js]] 这两个是 JS 附件
[scroll]

```
【系统指令：Obsidian ECharts 视图生成要求】
我需要你帮我在 Obsidian 中使用 DataviewJS 和 ECharts 制作一个数据视图。

我的知识库已内置 ECharts 视图共享基座。业务视图通过稳定入口
`Ai提示词/DataViewJS/echarts-base-entry.js` 加载，该入口会自动按文件名
定位库中真正的 `echarts-view-base.js` 实现文件，因此业务代码块
**无需再硬编码实现文件路径**。基座负责：ECharts 加载、控制面板 UI、
配置持久化、数据缓存、图例布局、尺寸/对齐、空数据与报错兜底、
右上角「关闭视图」按钮。你绝对不能重复实现这些逻辑，只允许按下面
的契约编写业务代码。

一、代码固定结构（开头三行原样照抄，代码总长控制在 70 行以内）：

const ENTRY = "Ai提示词/DataViewJS/echarts-base-entry.js";
await eval(await dv.io.load(ENTRY));
await window.EchartsViewBase.create(dv, {
    id: "视图唯一英文ID",
    fetchData: async (dv) => { ... },
    hasData: (d) => ...,
    buildOption: (d, ctx) => ({ ... })
});

注意：第二行必须直接 eval，禁止写成 (0, eval) 间接调用，
否则基座取不到块级作用域中的 obsidian 模块（报 obsidian is not defined）。
实现文件可以随意移动/整理，只要文件名保持 `echarts-view-base.js` 且库内
唯一，入口文件会自动找到它。

二、你只需要编写三个函数：

1. fetchData：查询并解析 Obsidian 笔记数据，return 一个数据对象（字段自定义）；
   无数据或解析失败时 return { emptyText: "原因说明" }。
   禁止在这里 setOption 或操作 DOM。

2. hasData：判断缓存数据是否可渲染，return 布尔值。注意入参可能是空对象 {}。

3. buildOption：根据数据返回 ECharts option 片段。ctx 提供：
   - ctx.legendOpt：已按控制面板配置好的图例选项（位置/方向/显隐）
   - ctx.gridOpt：已与图例完全隔离的 grid 边距
   - ctx.config：当前面板配置 { size, legendShow, legendPos, align }
   - ctx.COLORS：彩虹色数组；ctx.TEXT：纯白 #FFFFFF
   - ctx.AXIS_LINE / ctx.SPLIT_LINE：轴线/分割线颜色
   直角坐标系图表：必须返回 grid: ctx.gridOpt，
   且图例必须写成 legend: { ...ctx.legendOpt, data: [...] }。
   饼图/日历图等无坐标轴图表：不要返回 grid/xAxis/yAxis，
   图例位置避让用 ctx.config.legendPos 自行调整（如移动饼图 center）。

4. onItemClick（可选）：(params, data) => ({ title, items })，
   点击数据点时基座弹窗展示明细；返回 null 则不弹窗。items 元素三种形态：
   - { text }：纯文本
   - { text, link: "文件路径" }：文件链接，点击打开对应笔记
   - { text, task: { path, line, completed } }：可交互任务勾选框，
     勾选会直接修改源文件的勾选状态并自动刷新视图（字段取自 dv 任务对象）
   明细数据（如每天的文件清单）在 fetchData 返回对象里附加字段即可。

三、硬性要求：
1. 所有文字颜色统一用 ctx.TEXT（#FFFFFF），数据染色优先按 ctx.COLORS 彩虹色顺序。
   配色自定义由基座面板负责（5 套预设调色板 + 单系列取色器微调 + 图例文字色），
   除非需求明确指定颜色（如子弹图绿/白），否则不要在 option 里硬编码 color 数组。
2. 禁止在业务代码里写任何定时器或自动刷新钩子；自动刷新统一使用基座控制面板的开关（支持秒/分钟间隔自定义、笔记不可见时自动暂停），手动刷新按钮和首次加载由基座负责。
3. 禁止用 try/catch 包裹整个 create 调用，基座已有统一的错误兜底。
4. 空数据标题、加载动画、报错展示由基座自动处理，不要在 buildOption 里写空态逻辑。

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
