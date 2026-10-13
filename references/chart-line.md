---
创建时间: 星期二, 十月 13日 2026, 8:54:48 晚上
修改时间: 星期二, 十月 13日 2026, 9:05:49 晚上
---

> 节选自 `制作更多数据视图.md` → **折线图**（原内容未做改写）

# 折线图

## 提示词模版 (折线图)

```
# 数据来源
(文件、文件夹、当前知识库、元数据、隐藏元数据、内联元数据、笔记内容)

# 数据类型
(文本、元数据、隐藏元数据、内联元数据、待办任务列表)

# 视图类型
- 折线图

# 视图配置
	- X轴数据配置：必填
	- 折线数据配置：必填
	- Y轴最大值：选填
	- Y轴最小值：选填
	- Y轴刻度间隔：选填
	- 折线宽度：选填
	- 数据点大小：选填
	- 是否隐藏折线：选填
	- 是否隐藏数据点：选填

# 图例配置
## 图例名称：
(为各个折线命名)

## 图例位置
(顶部/底部/左侧/右侧)

## 图例方向
(垂直/水平)

# 颜色配置
	- 折线颜色：选填、默认情况下以彩虹色自动染色
	- 数据点颜色：选填
	- 数据点圈颜色：选填
	- 图例边框色：选填

# 其他要求
(描述清楚要对视图进行细节或功能上的其他要求)

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

## 每日创建的笔记数量 (折线图示例)

- 如果视图报错不显示，请检查：1) 库中是否存在名为 `echarts-view-base.js` 的实现文件；2) 是否存在 `Ai提示词/DataViewJS/echarts-base-entry.js` 入口文件；3) 是否在一个笔记中为多个视图使用了重复的 `id`。若移动了实现文件，只要保持文件名 `echarts-view-base.js` 不变，入口文件会自动重新定位。

```dataviewjs
const ENTRY = "知识库插件/知识检索插件/DataViewJs与AI/JS附件/echarts-view-base.js";
await eval(await dv.io.load(ENTRY));

await window.EchartsViewBase.create(dv, {
    id: "daily-notes-line",

    fetchData: async (dv) => {
        const toDateStr = (c) => {
            if (!c) return null;
            if (typeof c?.toISODate === "function") return c.toISODate();
            try { return new Date(c).toISOString().split('T')[0]; } catch { return null; }
        };
        const dateCounts = {};
        const filesByDate = {};
        for (const p of dv.pages()) {
            const ds = toDateStr(p?.file?.ctime);
            if (!ds) continue;
            dateCounts[ds] = (dateCounts[ds] || 0) + 1;
            (filesByDate[ds] = filesByDate[ds] || []).push(p.file.path);
        }
        const dates = Object.keys(dateCounts).sort();
        return dates.length
            ? { dates, counts: dates.map(k => dateCounts[k]), filesByDate }
            : { emptyText: "当前库内暂无可统计的创建日期数据" };
    },

    hasData: (d) => Array.isArray(d.dates) && d.dates.length > 0,

    onItemClick: (p, d) => {
        const files = (d.filesByDate?.[p.name] || []).sort();
        if (!files.length) return null;
        return {
            title: `${p.name} 创建的笔记（${files.length} 篇）`,
            items: files.map(f => ({ text: f.split('/').pop().replace(/\.md$/i, ''), link: f }))
        };
    },

    buildOption: (d, { legendOpt, gridOpt, TEXT, AXIS_LINE, SPLIT_LINE }) => ({
        grid: gridOpt,
        legend: { ...legendOpt, data: ['每日创建文件数'] },
        tooltip: { trigger: 'axis', backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 0, textStyle: { color: TEXT } },
        xAxis: { type: 'category', data: d.dates, axisLabel: { color: TEXT }, axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { color: TEXT }, axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
        series: [{ name: '每日创建文件数', type: 'line', data: d.counts, smooth: true, symbolSize: 6, lineStyle: { width: 2 } }]
    })
});
```
