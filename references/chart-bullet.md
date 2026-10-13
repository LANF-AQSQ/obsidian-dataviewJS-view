---
创建时间: 星期二, 十月 13日 2026, 8:54:48 晚上
修改时间: 星期二, 十月 13日 2026, 9:06:07 晚上
---

> 节选自 `制作更多数据视图.md` → **子弹图（进度条）**（原内容未做改写）

# 子弹图 (进度条)

## 提示词模版 (进度条)

```
# 数据来源
(文件、文件夹、当前知识库、元数据、隐藏元数据、内联元数据、笔记内容)

# 数据类型
(文本、元数据、隐藏元数据、内联元数据、待办任务列表)

# 视图类型
- 子弹图(进度条)

# 视图配置
	- 进度条数：如果有多组数据需要查看进度则输入条数，默认为单条
	- 进度条数据配置：必填
	- 进度条最大值：选填

# 图例配置
## 图例名称：
(为各个区域数据命名)

## 图例位置
(顶部/底部/左侧/右侧)

## 图例方向
(垂直/水平)

# 颜色配置
	- 进度条完成区域色：
	- 进度条未完成区域色：
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

## 黑曜石教程学习进度 (进度条示例)

```dataviewjs
const ENTRY = "知识库插件/知识检索插件/DataViewJs与AI/JS附件/echarts-view-base.js";
await eval(await dv.io.load(ENTRY));

await window.EchartsViewBase.create(dv, {
    id: "task-progress-bullet",

    fetchData: async (dv) => {
        const TARGET = "任务面板/黑曜石教程任务面板";
        const page = dv.page(TARGET);
        if (!page) return { emptyText: `未找到文件：\n${TARGET}` };
        const tasks = page.file?.tasks || [];
        if (!tasks.length) return { emptyText: "该文件中不存在任何待办任务列表" };

        const stats = {};
        const tasksByHeading = {};
        for (const t of tasks) {
            const h = t.section?.subpath || "无所属标题";
            stats[h] = stats[h] || { total: 0, done: 0 };
            stats[h].total += 1;
            if (t.completed) stats[h].done += 1;
            (tasksByHeading[h] = tasksByHeading[h] || []).push({ text: t.text, path: t.path, line: t.line, completed: !!t.completed });
        }
        const categories = Object.keys(stats).filter(h => stats[h].total > 0);
        return categories.length
            ? { categories,
                completedData: categories.map(h => stats[h].done),
                totalData: categories.map(h => stats[h].total),
                tasksByHeading }
            : { emptyText: "无数据" };
    },

    hasData: (d) => Array.isArray(d.categories) && d.categories.length > 0,

    onItemClick: (p, d) => {
        const list = d.tasksByHeading?.[p.name] || [];
        if (!list.length) return null;
        const done = list.filter(t => t.completed).length;
        return {
            title: `${p.name}（${done}/${list.length}）`,
            items: list.map(t => ({ text: t.text, task: t }))
        };
    },

    buildOption: (d, { legendOpt, gridOpt, TEXT }) => {
        const pct = d.completedData.map((v, i) => d.totalData[i] > 0 ? Math.round(v / d.totalData[i] * 100) : 0);
        return {
            // 默认进度条为绿色，不写入 series.itemStyle.color，让基座面板调色板/单系列取色器能覆盖它
            color: ['#00E676'],
            legend: { ...legendOpt, data: ['完成进度'] },
            grid: { ...gridOpt, top: 20, bottom: 20, right: 95 },
            tooltip: {
                trigger: 'item', backgroundColor: 'rgba(0,0,0,0.85)', borderWidth: 0, textStyle: { color: TEXT },
                formatter: (p) => `<b>${p.name}</b><br/>完成进度: ${d.completedData[p.dataIndex]} / ${d.totalData[p.dataIndex]} (${pct[p.dataIndex]}%)`
            },
            xAxis: { type: 'value', show: false, min: 0, max: 100 },
            yAxis: {
                type: 'category', inverse: true, data: d.categories,
                axisLabel: { color: TEXT, fontSize: 13, width: 110, overflow: 'truncate' },
                axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false }
            },
            series: [{
                name: '完成进度', type: 'bar', data: pct,
                barWidth: 14,
                showBackground: true,
                backgroundStyle: { color: 'rgba(255,255,255,0.07)', borderRadius: 7 },
                itemStyle: { borderRadius: 7 }, // 颜色交给基座全局 color 系统
                label: {
                    show: true, position: 'right', distance: 8, fontSize: 12, color: 'rgba(255,255,255,0.85)',
                    formatter: (p) => `${d.completedData[p.dataIndex]}/${d.totalData[p.dataIndex]} · ${pct[p.dataIndex]}%`
                }
            }]
        };
    }
});
```
