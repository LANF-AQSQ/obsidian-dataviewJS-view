---
创建时间: 星期二, 十月 13日 2026, 8:54:48 晚上
修改时间: 星期二, 十月 13日 2026, 9:05:51 晚上
---

> 节选自 `制作更多数据视图.md` → **饼图**（原内容未做改写）

# 饼图

## 提示词模版 (饼图)

```
# 数据来源
(文件、文件夹、当前知识库、元数据、隐藏元数据、内联元数据、笔记内容)

# 数据类型
(文本、元数据、隐藏元数据、内联元数据、待办任务列表)

# 视图类型
- 甜甜圈图

# 视图配置
	- 圆心圆的圆心数据(数据显示在圆心正中心上)：(当不需要显示圆心圆时可删除该行)
	- 次级外环数据配置：可多个次级外环，但内圆+外1环最稳定
	- 饼图数据配置：当删除前两项时可使用此项，否则删除此行即可

# 图例配置
## 图例名称：
(为各个区域数据命名)

## 图例位置
(顶部/底部/左侧/右侧)

## 图例方向
(垂直/水平)

# 颜色配置
	- 圆心圆背景色：
	- 圆心圆数据字体颜色：
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

## 知识库笔记篇幅数据 (饼图示例)

```dataviewjs
const ENTRY = "知识库插件/知识检索插件/DataViewJs与AI/JS附件/echarts-view-base.js";
await eval(await dv.io.load(ENTRY));

await window.EchartsViewBase.create(dv, {
    id: "md-length-pie",

    fetchData: async (dv) => {
        const countChars = (md) => {
            let s = String(md || "");
            s = s.replace(/^---[\s\S]*?---\s*/m, "");      // frontmatter
            s = s.replace(/`{3}[\s\S]*?`{3}/g, "");         // 代码块（用 {3} 写法避免冲破外层围栏）
            s = s.replace(/`[^`]*`/g, "");                  // 行内代码
            s = s.replace(/!\[[^\]]*?\]\([^)]+\)/g, "");    // 图片
            s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");  // 链接保留文字
            s = s.replace(/<[^>]+>/g, "");                  // HTML 标签
            return s.replace(/\s+/g, "").length;
        };
        const bucketOf = (n) => n <= 500 ? "0-500字" : n <= 1000 ? "500-1000字" : n <= 2000 ? "1000-2000字"
            : n <= 3000 ? "2000-3000字" : n <= 4000 ? "3000-4000字" : "4000字以上";

        const mdPages = dv.pages().array().filter(p => String(p?.file?.path || "").toLowerCase().endsWith(".md"));
        const counters = { "0-500字": 0, "500-1000字": 0, "1000-2000字": 0, "2000-3000字": 0, "3000-4000字": 0, "4000字以上": 0 };
        const filesByBucket = { "0-500字": [], "500-1000字": [], "1000-2000字": [], "2000-3000字": [], "3000-4000字": [], "4000字以上": [] };

        // 并发 10 读取文件内容，避免大库卡顿
        let idx = 0;
        await Promise.all(new Array(Math.min(10, mdPages.length)).fill(0).map(async () => {
            while (idx < mdPages.length) {
                const p = mdPages[idx++];
                if (!p?.file?.path) continue;
                const b = bucketOf(countChars(await dv.io.load(p.file.path)));
                counters[b] += 1;
                filesByBucket[b].push(p.file.path);
            }
        }));

        return mdPages.length
            ? { total: mdPages.length, buckets: Object.keys(counters).map(name => ({ name, value: counters[name] })), filesByBucket }
            : { emptyText: "未找到任何 .md 文件" };
    },

    hasData: (d) => Number(d.total || 0) > 0,

    onItemClick: (p, d) => {
        const files = (d.filesByBucket?.[p.name] || []).sort();
        if (!files.length) return null;
        return {
            title: `${p.name}（${files.length} 篇）`,
            items: files.map(f => ({ text: f.split('/').pop().replace(/\.md$/i, ''), link: f }))
        };
    },

    buildOption: (d, { legendOpt, config, TEXT }) => {
        // 图例位置避让：移动饼图圆心
        const pos = config.legendShow ? config.legendPos : "";
        let cx = '50%', cy = '50%';
        if (pos === 'bottom-center') cy = '45%';
        else if (pos === 'top-center') cy = '55%';
        else if (pos === 'left-center') cx = '60%';
        else if (pos === 'right-center') cx = '40%';
        const center = [cx, cy];
        const outerMax = (pos === 'left-center' || pos === 'right-center') ? '62%' : '70%';

        return {
            legend: { ...legendOpt, data: d.buckets.map(b => b.name) },
            tooltip: {
                trigger: 'item', backgroundColor: 'rgba(0,0,0,0.75)', borderWidth: 0, textStyle: { color: TEXT },
                formatter: (p) => p.seriesName === '字数区间' ? `${p.name}<br/>${p.value} 篇 (${p.percent}%)` : `${p.name}<br/>${p.value} 篇`
            },
            series: [
                { name: '全部.md', type: 'pie', center, radius: ['0%', '30%'], silent: true,
                  label: { show: true, position: 'center', color: TEXT, fontSize: 16, fontWeight: 'bold', formatter: () => `${d.total}\n篇.md` },
                  labelLine: { show: false }, tooltip: { show: false }, itemStyle: { color: '#00BFFF' },
                  data: [{ name: '全部.md', value: d.total }] },
                { name: '字数区间', type: 'pie', center, radius: ['33%', outerMax], avoidLabelOverlap: true,
                  label: { show: false }, labelLine: { show: false },
                  itemStyle: { borderColor: 'rgba(0,0,0,0.18)', borderWidth: 1 }, data: d.buckets }
            ]
        };
    }
});
```
