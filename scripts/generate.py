#!/usr/bin/env python3
"""从 MaYIHEI/paperclip 脚本头部注释聚合生成 Quantumult X 订阅。

用法:
    python3 generate.py

生成产物:
    quanx/paperclip.json          # 订阅入口: 每条 task 的 config=签到定时, addons=对应脚本的 conf（无重写则不挂）
    quanx/conf/app/*.conf         # App 脚本重写规则（一脚本一 conf）
    quanx/conf/miniprogram/*.conf # 小程序脚本重写规则（一脚本一 conf）
"""
import json, re, subprocess, os, datetime

UPSTREAM = "https://raw.githubusercontent.com/MaYIHEI/paperclip/refs/heads/main/"
# 在用脚本清单: 以作者 loon/paperclip-checkin/paperclip-checkin.lpx 内的 cron 引用为准
SCRIPTS = [
    "app/agentrouter/agentrouter.js", "app/baidunetdisk/baidunetdisk.js",
    "app/camscanner/camscanner.js", "app/dreame/dreame.js", "app/laifen/laifen.js",
    "app/lhtj/lhtj.js", "app/linghu/linghu.js", "app/mihoyo/mihoyo.js",
    "app/milottery/milottery.js", "app/mishop/mishop.js", "app/newmixc/newmixc.js",
    "app/nodeseek/nodeseek.js", "app/pan1/pan1.js", "app/qqmusic/qqmusic.js",
    "app/sgcc/sgcc.js", "app/summary/summary.js", "app/tenvideo/tenvideo.js",
    "app/tingtingfm/tingtingfm.js", "app/wanda/wanda.js", "app/weibotalk/weibotalk.js",
    "app/wps/wps.js", "app/youpin/youpin.js",
    "miniprogram/bhg/bhg.js", "miniprogram/haidilao/haidilao.js",
    "miniprogram/huisheng/huisheng.js", "miniprogram/lhtj/lhtj.js",
    "miniprogram/linli/linli.js", "miniprogram/longde/longde.js",
    "miniprogram/miniso/miniso.js", "miniprogram/ppmt/ppmt.js",
    "miniprogram/tuhu/tuhu.js", "miniprogram/wedome/wedome.js",
]
# 同脚本多 cron 的 URL 去重处理（QuanX 按脚本 URL 去重只留第一条，追加查询参数区分）
URL_QUERY = {
    ("app/qqmusic/qqmusic.js", "QQ音乐每日任务"): "",
    ("app/qqmusic/qqmusic.js", "QQ音乐定时金币"): "?cron=coin",
    ("app/qqmusic/qqmusic.js", "QQ音乐红包雨"): "?cron=redpacket",
}

def fetch(path):
    return subprocess.run(["curl", "-s", UPSTREAM + path],
                          capture_output=True, text=True, timeout=30).stdout

def clean_block(b):
    return [re.sub(r"^\s*\*\s?", "", ln).rstrip() for ln in b.splitlines() if ln.strip()]

def script_key_of(script_path):
    """app/mihoyo/mihoyo.js -> app/mihoyo（目录 key，用于 conf 归属与命名）"""
    parts = script_path.split("/")
    return f"{parts[0]}/{parts[1]}"

def main():
    # (cron, url, tag, params, script_path)
    tasks = []
    # rewrite 规则按脚本目录聚合: key=app/mihoyo -> [(action, pattern, url)]
    rew_by_key = {}
    mitm_by_key = {}

    for s in SCRIPTS:
        out = fetch(s)
        m = re.search(r"===== Quantumult X =====\n(.*?)(?:===== \w+ =====|\*/)", out, re.S)
        if not m:
            print(f"[SKIP] {s}: 无 Quantumult X 片段", file=sys.stderr)
            continue
        key = script_key_of(s)
        section = None
        for ln in clean_block(m.group(1)):
            if ln.startswith("[MITM]"): section = "mitm"; continue
            if ln.startswith("[rewrite_local]"): section = "rewrite"; continue
            if ln.startswith("[task_local]"): section = "task"; continue
            if ln.startswith("hostname"):
                for h in [x.strip() for x in ln.split("=", 1)[1].split(",") if x.strip()]:
                    mitm_by_key.setdefault(key, set()).add(h)
                continue
            if section == "rewrite" and " url script-" in ln:
                parts = ln.split()
                idx = parts.index("url")
                rew_by_key.setdefault(key, []).append((parts[idx + 1], " ".join(parts[:idx]), parts[idx + 2]))
            elif section == "task":
                m2 = re.match(r"((?:\S+ ){4}\S+) (https://\S+)(, .*)", ln)
                if m2:
                    cron, url, params = m2.groups()
                    tag = re.search(r"tag=([^,]+)", params).group(1).strip()
                    tasks.append((cron, url, tag, params, s))
        print(f"[OK] {s}")

    # ---------- 生成 quanx/conf/<app|miniprogram>/*.conf（一脚本一 conf） ----------
    conf_dir = os.path.join("quanx", "conf")
    added = 0
    for key in sorted(rew_by_key):
        kparts = key.split("/")
        subdir = kparts[0]       # app | miniprogram
        name = kparts[1]
        d = os.path.join(conf_dir, subdir)
        os.makedirs(d, exist_ok=True)
        path = os.path.join(d, f"{name}.conf")
        body = (
            "#******************************\n"
            f"# 脚本功能：Paperclip {name} Cookie 抓取重写（聚合自 MaYIHEI/paperclip 脚本头部 QuanX 注释）\n"
            "# 仓库地址：https://github.com/s1sunny/paperclip-quanx\n"
            "# 脚本作者：MaYIHEI（聚合 s1sunny）\n"
            f"# 更新时间：{datetime.date.today().isoformat()}\n"
            "# 使用声明：此脚本仅供学习与交流，请勿转载与贩卖！\n"
            "#*******************************\n"
            "#[mitm]\n"
            "hostname = " + ", ".join(sorted(mitm_by_key.get(key, []))) + "\n"
            "\n"
            "#[rewrite_local]\n"
        )
        for action, pattern, url in rew_by_key[key]:
            body += f"{pattern} url {action} {url}\n"
        with open(path, "w") as f:
            f.write(body)
        added += 1
    print(f"[OK] quanx/conf/**: {added} 个 conf（rewrite 规则 {sum(len(v) for v in rew_by_key.values())} 条）")

    # ---------- 生成 paperclip.json ----------
    def script_path_of(url):
        for sp in SCRIPTS:
            if url.endswith(sp):
                return sp
        return None

    def key_sort(t):
        cron, url, tag, params, sp = t
        k = script_key_of(sp)
        if k.startswith("miniprogram/"):
            grp = 1
        elif sp == "app/summary/summary.js":
            grp = 2
        else:
            grp = 0
        return (grp, k)

    entries = []
    addons_done = set()  # 同一脚本 conf 只挂一次（QQ音乐 3 条 cron 共用同一 conf）
    for cron, url, tag, params, sp in sorted(tasks, key=key_sort):
        skey = script_key_of(sp)
        q = URL_QUERY.get((sp, tag), "")
        # 小程序脚本 tag 加「小程序」后缀（与 App 版区分），App 版保持原名
        task_tag = tag + "小程序" if skey.startswith("miniprogram/") else tag
        config = f"{cron} {url}{q}{params}".replace(f"tag={tag},", f"tag={task_tag},", 1)
        entry = {"config": config}
        # 每个有重写规则的脚本挂自己的 conf（同一 conf 只挂第一条 task）；无重写不挂
        if skey in rew_by_key and skey not in addons_done:
            conf_url = (f"https://raw.githubusercontent.com/s1sunny/paperclip-quanx/refs/heads/main/"
                        f"quanx/conf/{skey}.conf, tag={task_tag}-重写")
            entry["addons"] = conf_url
            addons_done.add(skey)
        entries.append(entry)

    sub = {
        "name": "Paperclip · 签到+Cookie 合集",
        "description": ("聚合自 MaYIHEI/paperclip（脚本 URL 直指上游，作者更新自动生效）。"
                        "task[].config = 31 个在用签到定时任务（含 11:30 汇总）；"
                        "每条 task 的 addons 挂对应脚本自己的重写 conf（无重写的脚本不挂）。"
                        "数据存 BoxJS：添加 paperclip.boxjs.json 数据源。"
                        "抓 Cookie 时开本订阅进 App/小程序，抓完可关（重写规则即停，签到不影响）。"),
        "task": entries,
    }
    with open("quanx/paperclip.json", "w") as f:
        json.dump(sub, f, ensure_ascii=False, indent=2)
    print(f"[OK] quanx/paperclip.json: task={len(entries)}（{sum(1 for e in entries if 'addons' in e)} 条带重写）")

if __name__ == "__main__":
    main()