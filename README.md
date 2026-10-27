# 📎 paperclip-quanx

[MaYIHEI/paperclip](https://github.com/MaYIHEI/paperclip) 的 **Quantumult X 一键订阅**。

作者仓库只维护了 Loon(`.lpx`) / Surge(`.sgmodule`) 插件,**没有 QuanX 订阅**。本仓库从作者每个脚本头部的 `Quantumult X` 配置注释自动聚合,生成**一个订阅搞定签到 + Cookie 抓取**。脚本 URL 全部直接引用作者仓库 raw,**作者更新脚本 = 订阅自动生效**,无需手动同步。

## 📡 订阅链接（就一个）

```
https://raw.githubusercontent.com/s1sunny/paperclip-quanx/main/quanx/paperclip.json
```

> 对应重写规则文件（addons 自动引用，无需手动添加）：
> `https://raw.githubusercontent.com/s1sunny/paperclip-quanx/main/quanx/paperclip.conf`

## 📦 内容

| 类型 | 数量 | 说明 |
|---|---|---|
| `task[].config` 定时签到 | 34 条 | 31 个在用脚本 + 11:30 签到汇总；QQ音乐 3 时段（每日任务/定时金币/红包雨，`?cron=` 参数防 QuanX 去重，同一 conf 只挂一次） |
| `task[].addons` 重写 conf | 29 个 | **一脚本一 conf**，每条有重写的任务挂自己脚本的 conf（App → `conf/app/`，小程序 → `conf/miniprogram/`）；无重写脚本（AgentRouter/网上国网/汇总）不挂 |
| `[mitm]` 域名 | 每 conf 各自 | 各脚本抓包域名，随对应 addons 自动启用 |

每个 conf 只含该脚本自己的重写规则，例如 `conf/miniprogram/ppmt.conf` 只管泡泡玛特、`conf/app/tenvideo.conf` 只管腾讯视频。

## 🚀 使用方法

1. **添加订阅**：Quantumult X → **任务 → 引用**（Task-Gallery 入口，不是重写页）→ 添加订阅 → 粘贴上面的 `paperclip.json` 链接。定时任务和重写规则一起生效：
   - 34 条签到定时任务出现在「任务」列表
   - 每条有重写的任务自动把对应 `quanx/conf/*.conf` 加进「重写 → 引用」（一脚本一 conf）
   - ⚠️ 若之前在「重写 → 引用」添加过（JSON 不是重写格式，会读不出），先删掉旧引用，再从任务页添加
2. **配置 BoxJS**（数据存储）：先装 [BoxJS](https://github.com/chavyleung/scripts)，添加数据源
   ```
   https://raw.githubusercontent.com/MaYIHEI/paperclip/main/paperclip.boxjs.json
   ```
3. **抓 Cookie**：开着订阅进要用的 App / 小程序页面 → 收到「✅ Cookie 获取成功」。全部抓完后可**关闭本订阅**（重写规则即停、不再解密这些域名；下次要抓再开）
4. **签到**：订阅开着即自动签到，11:30 收到汇总通知

## 🔄 重新生成

上游（脚本新增/失效/cron 调整）更新后重新聚合:

```bash
python3 scripts/generate.py
```

以作者 `loon/paperclip-checkin/paperclip-checkin.lpx` 内的在用脚本清单为准，提取各脚本头部 `===== Quantumult X =====` 注释片段，输出：

- `quanx/paperclip.json` — 订阅入口（config 定时 + 每脚本一个 addons 重写 conf）
- `quanx/conf/app/*.conf`、`quanx/conf/miniprogram/*.conf` — 一脚本一 conf（App/小程序分目录）

## ⚠️ 说明

- 配置内容版权归 @MaYIHEI 所有，仅做格式聚合，无功能改动
- 龙湖 App/小程序、华联/龙德 为同 URL 双脚本，QuanX 全部匹配生效，与作者设计一致
- 脚本仅供学习研究，使用者自行评估风险
