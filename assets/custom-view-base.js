// ============================================================================
// custom-view-base.js  v1.1
// Obsidian DataviewJS 非 ECharts 自定义视图共享基座
// 职责：公共按钮、配置持久化辅助、边框样式、自动刷新、关闭视图、颜色转换
//
// 用法（在 dataviewjs 代码块顶部原样照抄）：
//   const BASE = "AI/提示词/DataViewJS/custom-view-base-entry.js";
//   eval(await dv.io.load(BASE));
//   const { TEXT, toHex, mkBtn, removeDataviewBlock,
//          applyBorderStyle, isVisible, clearAutoRefresh, startAutoRefresh,
//          makeCloseBtn } = window.CustomViewBase;
// ============================================================================
window.CustomViewBase = (() => {
    const VERSION = "1.1";
    const TEXT = "#FFFFFF";
    const DEFAULT_BORDER = "rgba(255,255,255,0.35)";

    // 将 rgba / hex / 非法颜色统一转为 6 位 hex，供 <input type="color"> 使用
    function toHex(c) {
        if (typeof c !== "string") return TEXT;
        if (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(c)) return c;
        const m = c.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
        if (!m) return TEXT;
        const r = Number(m[1]).toString(16).padStart(2, "0");
        const g = Number(m[2]).toString(16).padStart(2, "0");
        const b = Number(m[3]).toString(16).padStart(2, "0");
        return "#" + r + g + b;
    }

    // 创建左上角工具栏按钮（优先使用 Obsidian 图标，否则用 emoji 兜底）
    function mkBtn(icon, title, onClick) {
        const b = document.createElement("button");
        b.style.cssText = "padding: 6px 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; border-radius: 4px;";
        const ob = (typeof obsidian !== "undefined") ? obsidian : window.obsidian;
        if (ob?.setIcon) ob.setIcon(b, icon);
        else b.textContent = ({ settings: "⚙", "refresh-cw": "⟳", "rotate-ccw": "↺", x: "✕" })[icon] || icon;
        b.title = title;
        b.onclick = onClick;
        return b;
    }

    // 从当前笔记中删除对应的 dataviewjs 代码块
    // 匹配 id: "..."（ECharts 视图）、const VIEW_ID = "..."（自定义视图）或 // VIEW_ID: ... 标记
    async function removeDataviewBlock(dv, viewId) {
        const filePath = dv.current()?.file?.path || dv.currentFilePath || "";
        if (!filePath) throw new Error("无法确定当前文件路径");
        const file = window.app?.vault?.getAbstractFileByPath(filePath);
        if (!file) throw new Error("未找到当前笔记文件: " + filePath);

        const rawContent = await window.app.vault.read(file);
        const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        const lines = content.split('\n');
        const escapedId = viewId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const idRe = new RegExp(`(?:^|[^\w])(?:id|VIEW_ID)\s*[:=]\s*["']${escapedId}["']|//\s*VIEW_ID:\s*${escapedId}(?:\s|$)`);
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

    // 给 wrapper 应用统一的圆角边框
    // showBorder 为 false 时强制移除边框，保留圆角；使用 !important 覆盖主题/插件 CSS
    function applyBorderStyle(wrapper, borderColor, showBorder = true) {
        if (!wrapper) return;
        if (showBorder === false) {
            wrapper.style.setProperty("border", "0px solid transparent", "important");
        } else {
            wrapper.style.setProperty("border", `1px solid ${borderColor || DEFAULT_BORDER}`, "important");
        }
        wrapper.style.borderRadius = "8px";
    }

    // 复制文本到剪贴板
    // 同步方案优先：在用户手势内创建临时 textarea + execCommand("copy")，最可靠
    // 失败再降级到 Clipboard API / Electron clipboard
    function copyText(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        try {
            const ok = document.execCommand("copy");
            document.body.removeChild(ta);
            if (ok) return Promise.resolve(true);
        } catch (e) {
            document.body.removeChild(ta);
        }
        try {
            const electron = window.require?.("electron");
            if (electron?.clipboard?.writeText) {
                electron.clipboard.writeText(text);
                return Promise.resolve(true);
            }
        } catch (e) { /* 降级 */ }
        if (navigator?.clipboard?.writeText) {
            return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
        }
        return Promise.resolve(false);
    }

    // 判断视图容器是否可见（用于自动刷新暂停/恢复）
    // checkVisibility 返回 false 时再用 offsetParent 兜底，避免某些主题/容器把它判为不可见
    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        if (typeof el.checkVisibility === "function" && el.checkVisibility()) return true;
        return el.offsetParent !== null;
    }

    // 清理自动刷新定时器
    function clearAutoRefresh(timers) {
        if (timers.autoTimer) clearInterval(timers.autoTimer);
        if (timers.watchTimer) clearInterval(timers.watchTimer);
        timers.autoTimer = timers.watchTimer = null;
    }

    // 启动自动刷新（可见性感知，笔记关闭自动停止，防泄漏）
    // opts: { timers, config, wrapper, visibleEl, onTick, onVisibleChange? }
    // 与 echarts-view-base.js 保持一致：config 对象引用稳定，不重新赋值
    function startAutoRefresh(opts) {
        const { timers, config, wrapper, visibleEl, onTick, onVisibleChange } = opts;
        clearAutoRefresh(timers);
        if (!config?.autoRefresh) return;
        const v = Math.max(1, Number(config.refreshInterval) || 30);
        const ms = config.refreshUnit === 'min' ? v * 60000 : Math.max(5, v) * 1000;
        let wasVisible = true;
        timers.autoTimer = setInterval(() => { if (isVisible(visibleEl)) onTick(); }, ms);
        timers.watchTimer = setInterval(() => {
            if (!wrapper?.isConnected) { clearAutoRefresh(timers); return; }
            const vis = isVisible(visibleEl);
            if (vis && !wasVisible) onTick();
            wasVisible = vis;
            if (typeof onVisibleChange === "function") onVisibleChange(vis);
        }, 2000);
    }

    // 创建「关闭视图」按钮（两次点击删除机制）
    // opts: { viewId, dv, wrapper, onBeforeDelete?, onAfterDelete?, onError? }
    function makeCloseBtn(opts) {
        const { viewId, dv, wrapper, onBeforeDelete, onAfterDelete, onError } = opts;
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
                        if (typeof onBeforeDelete === "function") onBeforeDelete();
                        const newContent = await removeDataviewBlock(dv, viewId);
                        const filePath = dv.current()?.file?.path || dv.currentFilePath || "";
                        const file = window.app?.vault?.getAbstractFileByPath(filePath);
                        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
                        await window.app?.vault?.modify(file, newContent);
                        if (wrapper?.isConnected) wrapper.remove();
                        if (typeof onAfterDelete === "function") onAfterDelete();
                    } catch (e) {
                        console.error("关闭视图失败:", e);
                        if (typeof onError === "function") onError(e);
                        else alert("关闭视图失败: " + (e?.message || String(e)));
                    }
                }, 0);
            }
        };
        return closeBtn;
    }

    return {
        VERSION, TEXT, DEFAULT_BORDER,
        toHex, mkBtn, removeDataviewBlock, applyBorderStyle, copyText,
        isVisible, clearAutoRefresh, startAutoRefresh, makeCloseBtn
    };
})();
