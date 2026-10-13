# -*- coding: utf-8 -*-
"""
find_base.py —— 在你的 Obsidian 库里定位视图基座文件

为什么需要它：视图代码块顶部必须写一个指向基座的路径常量（ENTRY / BASE），
这个路径**因库而异**（示例里出现过 `Ai提示词/DataViewJS/...`、
`知识库插件/知识检索插件/DataViewJs与AI/JS附件/...` 等多种位置）。
写错路径 = 视图白屏。生成视图前先跑它，拿到准确的相对路径。

用法：
    python find_base.py <库根目录> [--base assets目录]

输出每个基座文件的相对路径（直接可填进 const ENTRY = "..."），
并按"同名文件是否唯一"给出告警（入口文件靠文件名唯一性定位，重名会失效）。
"""
import argparse
import sys
from pathlib import Path

# 相对 Obsidian 库根目录要查找的基座文件（键 -> 匹配规则）
TARGETS = {
    "echarts-view-base.js": lambda n: n == "echarts-view-base.js",
    "custom-view-base.js": lambda n: n == "custom-view-base.js",
    "*-base-entry.js": lambda n: n.endswith("-base-entry.js"),
}

SKIP_DIRS = {".obsidian", ".git", ".trash", "node_modules", ".workbuddy"}

# 本 skill 自带的参考实现（assets/）不参与"库内定位"，否则会自报重名告警
SELF_ASSETS = Path(__file__).resolve().parent.parent / "assets"


def find_files(vault, matcher):
    hits = []
    for p in vault.rglob("*.js"):
        if any(part in SKIP_DIRS or part.startswith(".") for part in p.parts):
            continue
        try:
            rel = p.relative_to(vault)
        except ValueError:
            continue
        if p.resolve() == p and SELF_ASSETS.exists() and str(p.resolve()).startswith(str(SELF_ASSETS.resolve())):
            continue  # 跳过本 skill 自带的参考实现副本
        if matcher(p.name):
            hits.append(rel.as_posix())
    return sorted(hits)


def main():
    ap = argparse.ArgumentParser(description="定位 Obsidian 库中的视图基座文件")
    ap.add_argument("vault", help="Obsidian 库根目录")
    ap.add_argument("--base", default=None, help="可选的基座 assets 目录（本 skill 自带的参考实现）")
    args = ap.parse_args()

    vault = Path(args.vault)
    if not vault.is_dir():
        print(f"ERROR: 目录不存在或无权限: {vault}", file=sys.stderr)
        return 2
    print(f"[vault] {vault}\n")

    found_any = False
    for label, matcher in TARGETS.items():
        hits = find_files(vault, matcher)
        if not hits:
            print(f"  [缺失] {label}")
            continue
        found_any = True
        status = "OK  " if len(hits) == 1 else "WARN"
        print(f"  [{status}] {label}  命中 {len(hits)} 个")
        for h in hits:
            print(f"          {h}")
        if len(hits) > 1 and label != "*-base-entry.js":
            print("          ^ 同名文件不唯一！入口文件靠文件名定位，重名会导致加载到错误实现，请清理到只留一个\n")

    if not found_any:
        print("\n库里没有任何基座文件。把本 skill 的 assets/*.js 复制到库内任意位置即可，")
        print("例如 <库根>/AI/提示词/DataViewJS/  （保持文件名 echarts-view-base.js 不变）")
    else:
        print("\n可用写法（取上面 OK 行的路径）：")
        print('  const ENTRY = "<上面输出的相对路径>";')
        print('  await eval(await dv.io.load(ENTRY));   // 必须直接 eval，禁止 (0, eval)')

    if args.base:
        b = Path(args.base)
        print(f"\n[参考实现] {b}")
        for f in sorted(b.glob("*.js")):
            print(f"  {f.name}  ({f.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
