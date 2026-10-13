> 节选自 `制作更多数据视图.md` → **条形图**（原内容未做改写）

# 条形图

## 提示词模版 (条形图)

```
# 数据来源
(文件、文件夹、当前知识库、元数据、隐藏元数据、内联元数据、笔记内容)

# 数据类型
(文本、元数据、隐藏元数据、内联元数据、待办任务列表)

# 视图类型
- 条形图

# 视图配置
	- X轴数据配置：必填
	- 单位条形数：默认情况下单条，如果有多个数据要展示则填写单位需要展示的条形数。单条时可删除此行
	- 条形数据配置：必填
	- Y轴最大值：选填
	- Y轴最小值：选填
	- Y轴刻度间隔：选填
	- 单位条间隔：选填

# 图例配置
## 图例名称：
(为各个区域数据命名)

## 图例位置
(顶部/底部/左侧/右侧)

## 图例方向
(垂直/水平)

# 颜色配置
	- 条形的颜色：
	- 图例边框色：

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

## 每日创建的笔记数量 (条形图示例)

```dataviewjs
const ENTRY = "知识库插件/知识检索插件/DataViewJs与AI/JS附件/echarts-view-base.js";
await eval(await dv.io.load(ENTRY));

await window.EchartsViewBase.create(dv, {
    id: "daily-notes-bar",

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
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 0, textStyle: { color: TEXT } },
        xAxis: { type: 'category', data: d.dates, axisLabel: { color: TEXT }, axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { show: false } },
        yAxis: { type: 'value', axisLabel: { color: TEXT }, axisLine: { lineStyle: { color: AXIS_LINE } }, splitLine: { lineStyle: { color: SPLIT_LINE } } },
        series: [{ name: '每日创建文件数', type: 'bar', data: d.counts, itemStyle: { borderRadius: [4, 4, 0, 0] } }]
    })
});
```
