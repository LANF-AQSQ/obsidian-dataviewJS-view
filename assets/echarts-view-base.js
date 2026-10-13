// ============================================================================
// echarts-view-base.js  v1.3
// Obsidian DataviewJS + ECharts 共享视图基座
// 职责：ECharts 加载、控制面板 UI（含调色板/系列颜色微调）、配置持久化、数据缓存、
//       图例布局、尺寸对齐、自动刷新（可见性感知）、数据点点击弹窗、空数据/报错兜底。
//       业务视图只需提供 fetchData / hasData / buildOption，可选 onItemClick。
//
// 用法（在 dataviewjs 代码块中，顶部三行固定照抄）：
//   const BASE = "AI/提示词/DataViewJS/echarts-view-base.js";
//   eval(await dv.io.load(BASE));   // 必须直接 eval：(0, eval) 间接调用会丢失块级 obsidian 作用域
//   await window.EchartsViewBase.create(dv, { id, fetchData, hasData, buildOption });
// ============================================================================
window.EchartsViewBase = (() => {
    const VERSION = "1.3";
    const COLORS = ['#FF2A2A', '#FF7A00', '#FFD700', '#00E676', '#00BFFF', '#9D00FF', '#FF007F'];
    const PALETTES = {
        rainbow: COLORS,
        warm: ['#FF2A2A', '#FF7A00', '#FFA940', '#FFD700', '#FF007F', '#FF5500', '#FFE58F'],
        cool: ['#00BFFF', '#0057FF', '#7B61FF', '#9D00FF', '#00E5FF', '#36CFC9', '#69C0FF'],
        mint: ['#B7EB8F', '#95DE64', '#73D13D', '#52C41A', '#389E0D', '#237804', '#135200'],
        pastel: ['#FF9C9C', '#FFC069', '#FFE58F', '#95DE64', '#5CDBD3', '#85A5FF', '#B37FEB']
    };
    const TEXT = '#FFFFFF';
    const AXIS_LINE = 'rgba(255,255,255,0.35)';
    const SPLIT_LINE = 'rgba(255,255,255,0.10)';
    const CDN = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';

    async function loadEcharts() {
        if (window.echarts) return;
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[src*="echarts"]');
            if (existing) {
                const t0 = Date.now();
                const timer = setInterval(() => {
                    if (window.echarts) { clearInterval(timer); resolve(); }
                    else if (Date.now() - t0 > 15000) { clearInterval(timer); reject(new Error("ECharts 加载超时")); }
                }, 100);
            } else {
                const s = document.createElement('script');
                s.src = CDN;
                s.onload = () => resolve();
                s.onerror = () => reject(new Error("ECharts 脚本加载失败"));
                document.head.appendChild(s);
            }
        });
    }

    function mkBtn(icon, title, onClick) {
        const b = document.createElement("button");
        b.style.cssText = "padding: 6px 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px;";
        // obsidian 在 dataviewjs 块级作用域中（直接 eval 可沿作用域链取到）；取不到时用文字图标兜底
        const ob = (typeof obsidian !== "undefined") ? obsidian : window.obsidian;
        if (ob?.setIcon) ob.setIcon(b, icon);
        else b.textContent = ({ settings: "⚙", "refresh-cw": "⟳", "rotate-ccw": "↺" })[icon] || icon;
        b.title = title;
        b.onclick = onClick;
        return b;
    }

    const PANEL_HTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.14); padding-bottom: 5px; color: ${TEXT};">⚙️ 视图控制面板</h4>
        <div style="margin-bottom: 15px;">
            <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">视图位置:</div>
            <select class="ctrl-align" style="width: 100%; padding: 6px 8px; margin-bottom: 10px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
                <option value="left">靠左对齐</option><option value="center">居中对齐</option><option value="right">靠右对齐</option>
            </select>
            <label style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px; cursor: pointer; font-size: 13px; color: ${TEXT};">
                <input type="checkbox" class="ctrl-lgd-show"> 开启图例
            </label>
            <select class="ctrl-lgd-pos" style="width: 100%; padding: 6px 8px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
                <option value="top-center">正上方</option><option value="bottom-center">正下方</option><option value="left-center">左侧垂直</option><option value="right-center">右侧垂直</option>
            </select>
            <label style="display: flex; align-items: center; gap: 6px; margin-top: 10px; cursor: pointer; font-size: 13px; color: ${TEXT};">
                <input type="checkbox" class="ctrl-click-detail"> 点击数据点显示明细弹窗
            </label>
        </div>
        <div style="margin-bottom: 15px;">
            <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">颜色配置:</div>
            <select class="ctrl-palette" style="width: 100%; padding: 6px 8px; margin-bottom: 8px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
                <option value="rainbow">彩虹（默认）</option><option value="warm">暖阳</option><option value="cool">冷色</option><option value="mint">薄荷绿</option><option value="pastel">马卡龙</option><option value="custom">自定义配色</option>
            </select>
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <span style="flex: 1; font-size: 12px; color: rgba(255,255,255,0.72);">图例文字色</span>
                <input type="color" class="ctrl-lgd-color" value="#FFFFFF" style="width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;">
            </div>
            <div class="ctrl-series-colors" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>
        <div style="margin-bottom: 5px;">
            <div style="font-size: 12px; margin-bottom: 5px; color: rgba(255,255,255,0.72);">图表高度/宽度尺寸:</div>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px;">
                <button class="ctrl-sz-btn" data-s="300" style="padding: 6px 10px; background: rgba(36,36,36,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;">300px</button>
                <button class="ctrl-sz-btn" data-s="500" style="padding: 6px 10px; background: rgba(36,36,36,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;">500px</button>
                <button class="ctrl-sz-auto" style="padding: 6px 10px; background: rgba(36,36,36,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;">全宽展现</button>
            </div>
            <div style="display: flex; gap: 6px;">
                <input type="number" class="ctrl-sz-custom" placeholder="自定义(>=300)" style="flex:1; width: 60%; padding: 6px 8px; background: rgba(30,30,30,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.16); border-radius: 6px;">
                <button class="ctrl-sz-apply" style="padding: 6px 12px; background: rgba(36,36,36,0.98); color: ${TEXT}; border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;">应用</button>
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

    // opts: { id?, defaults?, fetchData(dv), hasData(data), buildOption(data, ctx) }
    async function create(dv, opts) {
        const { fetchData, hasData, buildOption } = opts;
        const DEFAULTS = Object.assign({ size: 500, legendShow: true, legendPos: 'bottom-center', align: 'center', clickDetail: true, autoRefresh: false, refreshInterval: 30, refreshUnit: 'sec', palette: 'rainbow', legendColor: '#FFFFFF', seriesColors: {}, borderColor: 'rgba(255,255,255,0.35)', showBorder: true }, opts.defaults || {});
        const VIEW_ID = String(opts.id || 'main').replace(/[^a-zA-Z0-9_-]/g, '');

        const FILEID = btoa(encodeURIComponent(dv.current()?.file?.path || dv.currentFilePath || "")).replace(/[^a-zA-Z0-9]/g, "").slice(-30);
        const el = dv.container;
        if (el?.dataset && !el.dataset.echartsViewInstance) {
            window.__ECHARTS_DVJS_INSTANCE_SEQ__ = (window.__ECHARTS_DVJS_INSTANCE_SEQ__ || 0) + 1;
            el.dataset.echartsViewInstance = String(window.__ECHARTS_DVJS_INSTANCE_SEQ__);
        }
        const INST = el?.dataset?.echartsViewInstance || String(Math.random()).slice(2);

        const STORAGE_KEY = `echarts_persist_${FILEID}_${INST}`;
        const CACHEKEY = `echartsdata_cache_${FILEID}_${VIEW_ID}`;
        const CONFIG_KEY = `echarts_ui_config_${FILEID}_${VIEW_ID}`;
        const OBSERVER_KEY = `echarts_observer_${FILEID}_${INST}`;

        const cache = window[STORAGE_KEY] = window[STORAGE_KEY] || { isInit: false, wrapper: null, chartContainer: null, panel: null, myChart: null };
        let config = Object.assign({ ...DEFAULTS }, JSON.parse(localStorage.getItem(CONFIG_KEY)) || {});
        const saveConfig = () => localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

        function syncFormUI() {
            if (!cache.panel) return;
            cache.panel.querySelector('.ctrl-align').value = config.align;
            cache.panel.querySelector('.ctrl-lgd-show').checked = config.legendShow;
            cache.panel.querySelector('.ctrl-lgd-pos').value = config.legendPos;
            cache.panel.querySelector('.ctrl-auto-on').checked = !!config.autoRefresh;
            cache.panel.querySelector('.ctrl-auto-val').value = config.refreshInterval;
            cache.panel.querySelector('.ctrl-auto-unit').value = config.refreshUnit;
            cache.panel.querySelector('.ctrl-palette').value = config.palette || 'rainbow';
            cache.panel.querySelector('.ctrl-lgd-color').value = toHex(config.legendColor);
            cache.panel.querySelector('.ctrl-click-detail').checked = !!config.clickDetail;
            cache.panel.querySelector('.ctrl-border-on').checked = config.showBorder !== false;
            cache.panel.querySelector('.ctrl-border-color').value = toHex(config.borderColor);
        }

        function applyBorderStyle() {
            if (!cache.wrapper) return;
            if (config.showBorder === false) {
                cache.wrapper.style.setProperty("border", "0px solid transparent", "important");
            } else {
                cache.wrapper.style.setProperty("border", `1px solid ${config.borderColor || 'rgba(255,255,255,0.35)'}`, "important");
            }
            cache.wrapper.style.borderRadius = "8px";
        }

        function toHex(c) {
            return (typeof c === "string" && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) ? c : TEXT;
        }

        // ===== 关闭视图：从当前笔记中删除对应的 dataviewjs 代码块 =====
        async function removeDataviewBlock(viewId) {
            const filePath = dv.current()?.file?.path || dv.currentFilePath || "";
            if (!filePath) throw new Error("无法确定当前文件路径");
            const file = window.app?.vault?.getAbstractFileByPath(filePath);
            if (!file) throw new Error("未找到当前笔记文件: " + filePath);

            const content = await window.app.vault.read(file);
            const lines = content.split('\n');
            const escapedId = viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const idRe = new RegExp(`(?:id|VIEW_ID)\\s*[:=]\\s*["']${escapedId}["']`);
            let i = 0;
            while (i < lines.length) {
                const line = lines[i];
                const openMatch = line.match(/^ {0,3}(`{3,}|~{3,})\s*dataviewjs(?:\s|$)/);
                if (openMatch) {
                    const start = i;
                    i++;
                    while (i < lines.length && !lines[i].match(/^ {0,3}(`{3,}|~{3,})\s*$/)) i++;
                    const blockEnd = i;
                    const blockText = lines.slice(start, blockEnd + 1).join('\n');
                    if (idRe.test(blockText)) {
                        let endIdx = blockEnd + 1;
                        while (endIdx < lines.length && lines[endIdx].trim() === '') endIdx++;
                        lines.splice(start, endIdx - start);
                        return lines.join('\n');
                    }
                    i = blockEnd + 1;
                } else {
                    i++;
                }
            }
            throw new Error("未找到当前视图的 dataviewjs 代码块（id: " + viewId + "）");
        }

        // 按图例项生成单系列取色器（仅在「自定义配色」模式下显示）
        function syncColorUI(names, colors) {
            const box = cache.panel?.querySelector('.ctrl-series-colors');
            if (!box) return;
            box.innerHTML = "";
            const isCustom = config.palette === 'custom';
            box.style.display = isCustom ? 'flex' : 'none';
            if (!isCustom) return;
            (names || []).forEach((n, i) => {
                const row = document.createElement("div");
                row.style.cssText = "display: flex; align-items: center; gap: 6px;";
                const label = document.createElement("span");
                label.style.cssText = "flex: 1; font-size: 12px; color: rgba(255,255,255,0.85); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
                label.textContent = n;
                label.title = n;
                const picker = document.createElement("input");
                picker.type = "color";
                picker.value = toHex(colors?.[i]);
                picker.title = `自定义「${n}」颜色`;
                picker.style.cssText = "width: 40px; height: 22px; padding: 0; border: 1px solid rgba(255,255,255,0.16); border-radius: 4px; background: none; cursor: pointer;";
                picker.onchange = () => {
                    config.seriesColors = { ...(config.seriesColors || {}), [n]: picker.value };
                    saveConfig();
                    update();
                };
                row.append(label, picker);
                box.appendChild(row);
            });
        }

        // ===== 自动刷新（可见性感知，笔记关闭自动停止，防定时器泄漏） =====
        let autoTimer = null;
        let watchTimer = null;
        let wasVisible = true;

        function isVisible() {
            const el = cache.chartContainer;
            if (!el || !el.isConnected) return false;
            if (typeof el.checkVisibility === "function") return el.checkVisibility();
            return el.offsetParent !== null;
        }

        function clearTimers() {
            if (autoTimer) clearInterval(autoTimer);
            if (watchTimer) clearInterval(watchTimer);
            autoTimer = watchTimer = null;
        }

        function startAuto() {
            clearTimers();
            if (!config.autoRefresh) return;
            const v = Math.max(1, Number(config.refreshInterval) || 30);
            const ms = config.refreshUnit === 'min' ? v * 60000 : Math.max(5, v) * 1000;
            autoTimer = setInterval(() => { if (isVisible()) render(true); }, ms);
            watchTimer = setInterval(() => {
                if (!cache.wrapper?.isConnected) { clearTimers(); return; } // 笔记已关闭，彻底停止
                const vis = isVisible();
                if (vis && !wasVisible) render(true); // 重新可见，补刷一次
                wasVisible = vis;
            }, 2000);
        }

        // ===== 数据点点击弹窗（文件链接 / 可交互任务勾选框） =====
        function closeModal() {
            if (cache.modal) { cache.modal.remove(); cache.modal = null; }
        }

        async function openFile(path) {
            try {
                const file = window.app?.vault?.getAbstractFileByPath(path);
                if (file) await window.app.workspace.getLeaf(false).openFile(file);
                else await window.app.workspace.openLinkText(path, '', false);
            } catch (e) { console.error('打开文件失败:', e); }
        }

        // 勾选框直接改源文件：按任务行号翻转 [ ] <-> [x]
        async function toggleTask(task) {
            const file = window.app?.vault?.getAbstractFileByPath(task.path);
            if (!file) return;
            const lines = (await window.app.vault.read(file)).split('\n');
            const i = task.line;
            if (i == null || i < 0 || i >= lines.length) return;
            if (lines[i].includes('[ ]')) lines[i] = lines[i].replace('[ ]', '[x]');
            else lines[i] = lines[i].replace(/\[[xX]\]/, '[ ]');
            await window.app.vault.modify(file, lines.join('\n'));
        }

        function showModal({ title, items }) {
            closeModal();
            const overlay = document.createElement("div");
            overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000; display: flex; align-items: center; justify-content: center;";
            const box = document.createElement("div");
            box.style.cssText = `width: min(520px, 85vw); max-height: 70vh; overflow-y: auto; background: rgba(18,18,18,0.98); border: 1px solid rgba(255,255,255,0.16); border-radius: 10px; padding: 16px 18px; color: ${TEXT}; box-shadow: 0 12px 32px rgba(0,0,0,0.6); text-align: left;`;

            const head = document.createElement("div");
            head.style.cssText = "display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.14); padding-bottom: 8px;";
            const titleEl = document.createElement("span");
            titleEl.style.cssText = "font-size: 14px; font-weight: bold;";
            titleEl.textContent = title || "明细";
            const closeBtn = document.createElement("span");
            closeBtn.textContent = "✕";
            closeBtn.style.cssText = "cursor: pointer; opacity: 0.7; font-size: 15px; padding: 0 4px;";
            closeBtn.onclick = closeModal;
            head.append(titleEl, closeBtn);
            box.appendChild(head);

            const list = document.createElement("div");
            list.style.cssText = "max-height: 160px; overflow-y: auto;"; // 固定显示 5 行（32px/行），超出滚动

            if (!items.length) {
                const empty = document.createElement("div");
                empty.style.cssText = "opacity: 0.6; font-size: 13px; padding: 8px 0;";
                empty.textContent = "无明细数据";
                list.appendChild(empty);
            }
            for (const it of items) {
                const row = document.createElement("div");
                row.style.cssText = "height: 32px; box-sizing: border-box; line-height: 19px; padding: 6px 4px; border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 13px; display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden;";
                row.title = it.text || ""; // 悬停显示完整内容
                if (it.task) {
                    const cb = document.createElement("input");
                    cb.type = "checkbox";
                    cb.checked = !!it.task.completed;
                    cb.style.cursor = "pointer";
                    cb.style.flexShrink = "0";
                    const span = document.createElement("span");
                    span.textContent = it.text;
                    span.style.cssText = "flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
                    const paint = () => { span.style.textDecoration = cb.checked ? "line-through" : "none"; span.style.opacity = cb.checked ? "0.55" : "1"; };
                    paint();
                    cb.onchange = async () => {
                        cb.disabled = true;
                        try {
                            await toggleTask(it.task);
                            it.task.completed = cb.checked;
                        } catch (e) {
                            console.error('任务状态切换失败:', e);
                            cb.checked = !cb.checked; // 失败回滚勾选状态
                        }
                        paint();
                        cb.disabled = false;
                        render(true); // 刷新图表进度
                    };
                    const openBtn = document.createElement("button");
                    openBtn.textContent = "→";
                    openBtn.title = `来源：${it.task.path}`;
                    openBtn.style.cssText = "padding: 0 4px; font-size: 11px; background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.7); border: 1px solid rgba(255,255,255,0.14); border-radius: 4px; cursor: pointer; margin-left: auto;";
                    openBtn.onclick = () => openFile(it.task.path);
                    row.append(cb, span, openBtn);
                } else if (it.link) {
                    const a = document.createElement("a");
                    a.textContent = it.text;
                    a.style.cssText = "color: #00BFFF; cursor: pointer; text-decoration: none; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;";
                    a.onmouseenter = () => a.style.textDecoration = "underline";
                    a.onmouseleave = () => a.style.textDecoration = "none";
                    a.onclick = () => openFile(it.link);
                    row.appendChild(a);
                } else {
                    row.textContent = it.text;
                }
                list.appendChild(row);
            }
            box.appendChild(list);
            if (items.length > 5) {
                const more = document.createElement("div");
                more.style.cssText = "font-size: 11px; opacity: 0.5; margin-top: 6px; text-align: right;";
                more.textContent = `共 ${items.length} 条，滚动查看更多`;
                box.appendChild(more);
            }
            overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
            overlay.appendChild(box);
            cache.wrapper.appendChild(overlay); // 挂在视图内，笔记关闭时随视图自动销毁
            cache.modal = overlay;
        }

        function bindClick() {
            if (typeof opts.onItemClick !== "function") return;
            cache.myChart.on('click', (params) => {
                if (!config.clickDetail) return; // 面板开关可关闭点击弹窗
                if (params.componentType !== 'series') return;
                const data = window[CACHEKEY] || {};
                if (!hasData(data)) return;
                const r = opts.onItemClick(params, data);
                if (r && Array.isArray(r.items)) showModal(r);
            });
        }

        function update() {
            syncFormUI();
            const isAuto = config.size === 'auto';
            cache.chartContainer.style.width = isAuto ? "100%" : (config.size + "px");
            cache.chartContainer.style.height = isAuto ? "400px" : (config.size + "px");
            cache.chartContainer.style.margin = config.align === 'left' ? "0 auto 0 0" : (config.align === 'right' ? "0 0 0 auto" : "0 auto");
            saveConfig();
            if (!cache.myChart) return;
            cache.myChart.resize();

            // 图例与图表区域隔离：按图例位置动态调整 grid 边距
            const gridOpt = { top: 40, bottom: 40, left: 50, right: 50, containLabel: true };
            const legendOpt = { show: config.legendShow, textStyle: { color: TEXT }, padding: 5 };
            if (config.legendShow) {
                const pos = config.legendPos;
                if (pos === 'top-center') { legendOpt.top = 0; legendOpt.left = 'center'; legendOpt.orient = 'horizontal'; gridOpt.top = 50; }
                else if (pos === 'bottom-center') { legendOpt.bottom = 0; legendOpt.left = 'center'; legendOpt.orient = 'horizontal'; gridOpt.bottom = 50; }
                else if (pos === 'left-center') { legendOpt.left = 0; legendOpt.top = 'middle'; legendOpt.orient = 'vertical'; gridOpt.left = 120; }
                else if (pos === 'right-center') { legendOpt.right = 0; legendOpt.top = 'middle'; legendOpt.orient = 'vertical'; gridOpt.right = 120; }
            }

            const data = window[CACHEKEY] || {};
            let option;
            if (hasData(data)) {
                option = buildOption(data, { legendOpt, gridOpt, config, COLORS, TEXT, AXIS_LINE, SPLIT_LINE });
            } else {
                option = {
                    legend: { show: false },
                    title: { text: data.emptyText || "无数据", left: 'center', top: 'middle', textStyle: { color: TEXT, fontSize: 14 } },
                    xAxis: { show: false },
                    yAxis: { show: false },
                    series: []
                };
            }

            // 颜色系统：预设调色板 + 自定义配色 + 图例文字色
            const isCustom = config.palette === 'custom';
            const palette = PALETTES[config.palette] || COLORS;
            const srcColors = option.color || palette;
            const names = option.legend?.data || (option.series || []).map(s => s?.name).filter(Boolean);
            const finalColors = names.length
                ? names.map((n, i) => (isCustom && config.seriesColors?.[n]) || srcColors[i % srcColors.length])
                : srcColors;
            if (option.legend) {
                option.legend.textStyle = { ...(option.legend.textStyle || {}), color: config.legendColor || TEXT };
            }
            const { color: _omit, ...restOption } = option;
            cache.myChart.setOption({ color: finalColors, textStyle: { color: TEXT }, ...restOption }, true);
            syncColorUI(names, finalColors);
        }

        async function render(forceRefresh = false) {
            const refreshBtn = cache.wrapper?.querySelector('button[title="手动刷新数据"]');
            try {
                await loadEcharts();
                if (!cache.myChart || cache.myChart.isDisposed()) {
                    cache.myChart = window.echarts.init(cache.chartContainer);
                    bindClick();
                }
                const cur = window[CACHEKEY];
                if (!cur || !hasData(cur) || forceRefresh) {
                    try {
                        if (refreshBtn) refreshBtn.style.opacity = "0.5";
                        cache.myChart.showLoading({ text: '加载并解析数据中...', color: '#00BFFF', textColor: TEXT, maskColor: 'rgba(0,0,0,0.4)' });
                        window[CACHEKEY] = (await fetchData(dv)) || {};
                    } catch (e) {
                        window[CACHEKEY] = { emptyText: e?.message || String(e) || "数据解析失败" };
                    } finally {
                        if (refreshBtn) refreshBtn.style.opacity = "1";
                        cache.myChart.hideLoading();
                    }
                }
                update();
            } catch (e) {
                // echarts 不可用时的纯 DOM 兜底，不依赖图表库
                cache.chartContainer.innerHTML = `<div style="color:${TEXT};padding:24px;text-align:center;">⚠️ ${e?.message || String(e) || "视图初始化失败"}</div>`;
            }
        }

        if (!cache.isInit || !cache.wrapper) {
            cache.wrapper = document.createElement("div");
            cache.wrapper.style.cssText = "position: relative; display: block; isolation: isolate; z-index: 1; padding-top: 50px; width: 100%; box-sizing: border-box;";

            const ui = document.createElement("div");
            ui.style.cssText = "position: absolute; top: 10px; left: 10px; display: flex; align-items: flex-start; gap: 8px; z-index: 100;";

            cache.panel = document.createElement("div");
            cache.panel.style.cssText = "display: none; position: absolute; top: 38px; left: 0; width: 280px; max-height: 360px; overflow-y: auto; background: rgba(18,18,18,0.96); border: 1px solid rgba(255,255,255,0.14); border-radius: 8px; padding: 15px; box-shadow: 0 8px 16px rgba(0,0,0,0.55); text-align: left;";
            cache.panel.innerHTML = PANEL_HTML;

            ui.appendChild(mkBtn("settings", "视图设置", () => {
                cache.panel.style.display = cache.panel.style.display === "none" ? "block" : "none";
            }));
            ui.appendChild(mkBtn("refresh-cw", "手动刷新数据", () => { render(true); startAuto(); }));
            ui.appendChild(mkBtn("rotate-ccw", "恢复默认视图", () => { config = { ...DEFAULTS }; update(); startAuto(); }));
            const closeBtn = mkBtn("x", "关闭并删除当前视图代码块", null);
            let closeState = 0;
            let closeTimer = null;
            const resetCloseBtn = () => {
                closeState = 0;
                closeBtn.style.background = "";
                closeBtn.style.color = "";
                closeBtn.title = "关闭并删除当前视图代码块";
            };
            closeBtn.onclick = () => {
                if (closeState === 0) {
                    closeState = 1;
                    closeBtn.style.background = "var(--text-error)";
                    closeBtn.style.color = "#fff";
                    closeBtn.title = "再次点击确认删除";
                    if (closeTimer) clearTimeout(closeTimer);
                    closeTimer = setTimeout(resetCloseBtn, 3000);
                } else {
                    if (closeTimer) clearTimeout(closeTimer);
                    resetCloseBtn();
                    // 延迟执行删除，避免按钮点击事件与 Obsidian 焦点冲突
                    setTimeout(async () => {
                        try {
                            if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                            const newContent = await removeDataviewBlock(VIEW_ID);
                            const filePath = dv.current()?.file?.path || dv.currentFilePath || "";
                            const file = window.app?.vault?.getAbstractFileByPath(filePath);
                            await window.app?.vault?.modify(file, newContent);
                            if (cache.wrapper?.isConnected) cache.wrapper.remove();
                        } catch (e) {
                            console.error("关闭视图失败:", e);
                            alert("关闭视图失败: " + (e?.message || String(e)));
                        }
                    }, 0);
                }
            };
            ui.appendChild(closeBtn);
            ui.appendChild(cache.panel);
            cache.wrapper.appendChild(ui);

            cache.chartContainer = document.createElement("div");
            cache.chartContainer.style.cssText = "position: relative; z-index: 2; transition: all 0.3s ease; width: 100%; height: 500px;";
            cache.wrapper.appendChild(cache.chartContainer);

            const q = (sel) => cache.panel.querySelector(sel);
            q('.ctrl-align').onchange = (e) => { config.align = e.target.value; update(); };
            q('.ctrl-lgd-show').onchange = (e) => { config.legendShow = e.target.checked; update(); };
            q('.ctrl-lgd-pos').onchange = (e) => { config.legendPos = e.target.value; update(); };
            cache.panel.querySelectorAll('.ctrl-sz-btn').forEach(b => b.onclick = (e) => { config.size = parseInt(e.target.getAttribute('data-s')); update(); });
            q('.ctrl-sz-auto').onclick = () => { config.size = 'auto'; update(); };
            q('.ctrl-sz-apply').onclick = () => {
                const val = parseInt(q('.ctrl-sz-custom').value);
                if (!isNaN(val)) { config.size = Math.max(300, val); update(); }
            };
            q('.ctrl-auto-on').onchange = (e) => { config.autoRefresh = e.target.checked; saveConfig(); startAuto(); };
            const applyAuto = () => {
                config.refreshUnit = q('.ctrl-auto-unit').value;
                const min = config.refreshUnit === 'min' ? 1 : 5;
                const max = config.refreshUnit === 'min' ? 1440 : 3600;
                let v = parseInt(q('.ctrl-auto-val').value);
                if (isNaN(v)) v = min;
                config.refreshInterval = Math.min(max, Math.max(min, v));
                q('.ctrl-auto-val').value = config.refreshInterval;
                saveConfig(); startAuto();
            };
            q('.ctrl-auto-val').onchange = applyAuto;
            q('.ctrl-auto-unit').onchange = applyAuto;
            q('.ctrl-palette').onchange = (e) => { config.palette = e.target.value; saveConfig(); update(); };
            q('.ctrl-lgd-color').onchange = (e) => { config.legendColor = e.target.value; saveConfig(); update(); };
            q('.ctrl-click-detail').onchange = (e) => { config.clickDetail = e.target.checked; saveConfig(); };
            q('.ctrl-border-on').onchange = (e) => { config.showBorder = e.target.checked; saveConfig(); applyBorderStyle(); };
            q('.ctrl-border-color').onchange = (e) => { config.borderColor = e.target.value; saveConfig(); applyBorderStyle(); };

            if (window[OBSERVER_KEY]) window[OBSERVER_KEY].disconnect();
            window[OBSERVER_KEY] = new ResizeObserver(() => { if (cache.myChart) cache.myChart.resize(); });
            window[OBSERVER_KEY].observe(cache.chartContainer);

            cache.isInit = true;
        }

        dv.container.appendChild(cache.wrapper);
        applyBorderStyle();
        await render();
        startAuto(); // 持久化的自动刷新状态在打开笔记时自动恢复
    }

    return { create, loadEcharts, COLORS, TEXT, AXIS_LINE, SPLIT_LINE, VERSION };
})();
