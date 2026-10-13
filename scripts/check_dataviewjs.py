# -*- coding: utf-8 -*-
"""
check_dataviewjs.py —— Obsidian DataviewJS 代码块体检器

背景（都是踩过的坑）：
1. DataviewJS 代码块是被 Dataview 包进 async 函数里执行的，所以**顶层 await / return 合法**。
   直接 `node --check xxx.js` 会误报 "Illegal return statement" / "await is only valid in async
   functions"。因此本脚本会把代码包进 `async function` 里再检查。
2. 语法通过 ≠ 能在 Obsidian 跑：还要查间接 eval、裸全局库名、围栏嵌套这三类运行时坑。

用法：
    python check_dataviewjs.py <文件或目录> [--node <node.exe 路径>]
    python check_dataviewjs.py D:/笔记/我的视图.md
    python check_dataviewjs.py ../references      # 目录：递归检查所有 .md

退出码：0 = 全部通过；1 = 存在 ERROR（warn 不影响退出码）
"""
import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

# 注意：开启 re.S 后不能用 (?:\s.*)? 这类写法——`.` 会跨行吞掉整个块。
# 围栏行内的空白只用 [ \t]*\r?\n 精确匹配。
BLOCK_RE = re.compile(r"^ {0,3}(`{3,}|~{3,})[ \t]*dataviewjs[ \t]*\r?\n(.*?)^ {0,3}\1[ \t]*\r?$", re.S | re.M)

WRAPPER_HEAD = "async function __dvjs_block__(dv, app, obsidian, moment, luxon) {\n"
WRAPPER_TAIL = "\n}\n"

CHECKS = [
    # (id, 级别, 正则, 说明)
    ("indirect-eval", "ERROR", r"\(\s*0\s*,\s*eval\s*\)",
     "禁止间接 eval：(0, eval) 会让代码跑在全局作用域，取不到 DataviewJS 块级作用域里的 "
     "obsidian / dv / app，运行时报 'xxx is not defined'。必须写成 eval(await dv.io.load(ENTRY))"),
    ("bare-echarts", "WARN", r"(?<![\w$.])echarts\s*\.\s*(init|getInstanceByDom)",
     "检测到裸 echarts：DataviewJS 沙盒里没有 echarts 全局变量，必须写 window.echarts.init(...)"),
    ("bare-chartjs", "WARN", r"(?<![\w$.])new\s+Chart\s*\(",
     "检测到裸 Chart：请用 window.Chart 或自行注入"),
    ("hardcoded-timer", "WARN", r"(?<![\w.])setInterval\s*\(",
     "业务代码里出现定时器：自动刷新应交由基座控制面板负责（可见性感知 + 笔记关闭自动停止），"
     "手写 setInterval 会内存泄漏。ECharts 视图与 CustomViewBase 视图都应删除该逻辑"),
    ("whole-trycatch", "WARN", r"try\s*{[^}]{0,200}await\s+window\.(?:Echarts|Custom)ViewBase\.create",
     "不要用 try/catch 包住整个 create 调用，基座已有统一错误兜底"),
]


def find_node(cli_node):
    if cli_node:
        return cli_node
    p = shutil.which("node")
    if p:
        return p
    for cand in (
        Path.home() / ".workbuddy/binaries/node/versions/22.22.2-6/node.exe",
        Path.home() / ".workbuddy/binaries/node/versions/22.22.2/node.exe",
    ):
        if cand.exists():
            return str(cand)
    return None


def extract_blocks(text):
    blocks = []
    for m in BLOCK_RE.finditer(text):
        line_no = text[:m.start()].count("\n") + 1
        blocks.append((line_no, m.group(2)))
    return blocks


def check_block(node, name, idx, line_no, code, tmpdir):
    issues = []
    wrapped = WRAPPER_HEAD + code + WRAPPER_TAIL
    f = Path(tmpdir) / f"block_{idx}.mjs"
    f.write_text(wrapped, encoding="utf-8", newline="\n")
    r = subprocess.run([node, "--check", str(f)], capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        msg = (r.stderr or "").strip().split("\n")
        issues.append(("ERROR", "syntax", "语法错误: " + " / ".join(x.strip() for x in msg[-4:] if x.strip())))

    for cid, level, pattern, hint in CHECKS:
        m = re.search(pattern, code)
        if m:
            ln = code[:m.start()].count("\n") + 1
            issues.append((level, cid, f"第 {ln} 行命中 -> {hint}"))

    return issues


def main():
    ap = argparse.ArgumentParser(description="Obsidian DataviewJS 代码块体检器")
    ap.add_argument("target", help=".md 文件或目录")
    ap.add_argument("--node", default=None, help="node.exe 路径（默认自动查找）")
    args = ap.parse_args()

    node = find_node(args.node)
    if not node:
        print("ERROR: 找不到 node.exe，请用 --node 指定路径", file=sys.stderr)
        return 2
    print(f"[node] {node}")

    t = Path(args.target)
    files = [t] if t.is_file() else sorted(t.rglob("*.md"))
    if not files:
        print("ERROR: 没有找到 .md 文件", file=sys.stderr)
        return 2

    total, errors, warns, empty = 0, 0, 0, 0
    with tempfile.TemporaryDirectory(prefix="dvjs-check-") as td:
        for md in files:
            blocks = extract_blocks(md.read_text(encoding="utf-8"))
            if not blocks:
                continue
            print(f"\n--- {md.name}  ({len(blocks)} 个 dataviewjs 块)")
            for i, (ln, code) in enumerate(blocks):
                total += 1
                issues = check_block(node, md.name, i, ln, code, td)
                tag = f"块#{i} (起始行 {ln}, {len(code.splitlines())} 行)"
                if not issues:
                    print(f"  OK   {tag}")
                    continue
                lvl = "FAIL" if any(x[0] == "ERROR" for x in issues) else "WARN"
                print(f"  {lvl} {tag}")
                for level, cid, msg in issues:
                    errors += level == "ERROR"
                    warns += level == "WARN"
                    print(f"        [{level}] {cid}: {msg}")

    print(f"\n==== 代码块 {total} 个 | ERROR {errors} | WARN {warns} ====")
    if empty:
        print("提示: 未提取到任何 dataviewjs 代码块，请确认围栏写作 ```dataviewjs")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
