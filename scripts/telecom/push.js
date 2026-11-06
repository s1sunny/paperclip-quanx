/**
 * 电信凭据推送青龙（Quantumult X）
 * v1.0.0
 *
 * 读取 BoxJS 账号数据 → 拼接为青龙环境变量 → 创建/更新并启用
 * 变量格式（换行分隔，多账号）：
 *   手机号,uid,targetId,token[,tv189t=... | tv189c=... | tv189h=...]
 */

const $ = new Env("电信Token推送");
const KEY_QL_URL = "ql_url";
const KEY_QL_TOKEN = "ql_token";
const KEY_QL_NAME = "chinatelecom_ql_name";
const DEFAULT_QL_NAME = "chinaTelecomToken";
const KEY_ACCOUNTS = "chinatelecom_accounts";
const KEY_PHONES = "chinatelecom_phones";

!(async () => {
  var accounts = [];
  try {
    var parsed = JSON.parse($.getdata(KEY_ACCOUNTS) || "[]");
    if (Array.isArray(parsed)) accounts = parsed;
  } catch (e) {}

  var withToken = accounts.filter(function (a) { return a.token; });
  if (withToken.length === 0) {
    console.log("ℹ️ 无可推送账号（尚未捕获 App Token），跳过");
    $.done({});
    return;
  }

  var orphans = accounts.filter(function (a) { return !a.token && a.tv189; });
  var lines = withToken.map(function (a) {
    return [a.phone || "", a.uid || "", a.targetId || "", a.token]
      .join(",") + tv189Field(a.tv189);
  });

  // 未绑定账号的超高清凭据，按顺序补到尚无凭据的账号行
  orphans.forEach(function (a) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(",tv189") === -1) {
        lines[i] += tv189Field(a.tv189);
        return;
      }
    }
  });

  var tokenValue = lines.join("\n");
  console.log("📋 " + lines.length + " 个账号，长度 " + tokenValue.length);

  var qlUrl = ($.getdata(KEY_QL_URL) || "").replace(/\/$/, "");
  var qlToken = $.getdata(KEY_QL_TOKEN) || "";
  var envName = $.getdata(KEY_QL_NAME) || DEFAULT_QL_NAME;

  if (!qlUrl || !qlToken) {
    $.msg($.name, "⚠️ 未配置青龙", "请在 BoxJS 填写 ql_url 与 ql_token");
    $.done({});
    return;
  }

  try {
    await Promise.race([
      syncToQinglong(qlUrl, qlToken, envName, tokenValue),
      new Promise(function (_, reject) {
        setTimeout(function () { reject(new Error("青龙同步超时(10s)")); }, 10000);
      }),
    ]);
    var display = $.getdata(KEY_PHONES) || lines.length + " 个账号";
    $.msg($.name, "✅ " + lines.length + " 个账号已推送", display.split("\n").join(" | "));
    console.log("✅ 推送成功");
  } catch (e) {
    $.msg($.name, "❌ 推送失败", e.message || String(e));
    console.log("❌ " + (e.message || String(e)));
  }
  $.done({});
})().catch(function (e) {
  console.log("❌ 异常: " + (e && e.message ? e.message : String(e)));
  try { $.msg($.name, "❌ 异常", e && e.message ? e.message : String(e)); } catch (_) {}
  $.done({});
});

function tv189Field(tv) {
  if (!tv || !tv.value) return "";
  if (tv.type === "cookie") return ",tv189h=" + toHex(tv.value);
  return ",tv189t=" + tv.value;
}

function toHex(s) {
  var out = "";
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i) & 0xff;
    out += (c < 16 ? "0" : "") + c.toString(16);
  }
  return out;
}

// ═══════════════════════════════════════
// 青龙 API
// ═══════════════════════════════════════
async function syncToQinglong(base, token, envName, envValue) {
  var apiBase = base + "/open/envs";
  var authHeader = token.indexOf("Bearer ") === 0 ? token : "Bearer " + token;
  var headers = { "Content-Type": "application/json", Authorization: authHeader };

  var listResp = await httpGet(apiBase + "?searchValue=" + encodeURIComponent(envName), headers);
  if (listResp.code !== 200) throw new Error("查询失败: " + JSON.stringify(listResp).substring(0, 100));

  var existing = (listResp.data || []).filter(function (e) { return e.name === envName; });
  var envId = null;

  if (existing.length > 0) {
    envId = existing[0].id;
    var resp = await httpPut(apiBase, headers, {
      id: envId,
      name: envName,
      value: envValue,
      remarks: existing[0].remarks || "电信Token（QuanX自动同步）",
    });
    if (resp.code !== 200) throw new Error("更新失败: " + JSON.stringify(resp).substring(0, 100));
  } else {
    var created = await httpPost(apiBase, headers, [{
      name: envName,
      value: envValue,
      remarks: "电信Token（QuanX自动同步）",
    }]);
    if (created.code !== 200) throw new Error("创建失败: " + JSON.stringify(created).substring(0, 100));
    if (created.data && created.data[0] && created.data[0].id) envId = created.data[0].id;
  }

  if (envId) {
    var en = await httpPut(base + "/open/envs/enable", headers, [envId]);
    if (en.code !== 200) console.log("⚠️ 启用变量失败，请到青龙手动启用 " + envName);
  }
}

// ═══════════════════════════════════════
// HTTP
// ═══════════════════════════════════════
function httpGet(url, headers) {
  return new Promise(function (resolve, reject) {
    $task.fetch({ url: url, method: "GET", headers: headers }).then(
      function (resp) { try { resolve(JSON.parse(resp.body)); } catch (e) { reject(new Error("JSON解析失败")); } },
      function (err) { reject(new Error(typeof err === "string" ? err : JSON.stringify(err))); }
    );
  });
}
function httpPost(url, headers, body) {
  return new Promise(function (resolve, reject) {
    $task.fetch({ url: url, method: "POST", headers: headers, body: JSON.stringify(body) }).then(
      function (resp) { try { resolve(JSON.parse(resp.body)); } catch (e) { reject(new Error("JSON解析失败")); } },
      function (err) { reject(new Error(typeof err === "string" ? err : JSON.stringify(err))); }
    );
  });
}
function httpPut(url, headers, body) {
  return new Promise(function (resolve, reject) {
    $task.fetch({ url: url, method: "PUT", headers: headers, body: JSON.stringify(body) }).then(
      function (resp) { try { resolve(JSON.parse(resp.body)); } catch (e) { reject(new Error("JSON解析失败")); } },
      function (err) { reject(new Error(typeof err === "string" ? err : JSON.stringify(err))); }
    );
  });
}

// ═══════════════════════════════════════
// Env
// ═══════════════════════════════════════
function Env(t) {
  return new (function () {
    this.name = t;
    this.startTime = new Date().getTime();
    console.log("\n---------- " + t + " ----------\n");
    this.getdata = function (k) {
      return this.isQx() ? $prefs.valueForKey(k) : this.isSurge() ? $persistentStore.read(k) : "";
    };
    this.setdata = function (v, k) {
      return this.isQx() ? $prefs.setValueForKey(v, k) : this.isSurge() ? $persistentStore.write(v, k) : false;
    };
    this.msg = function (title, subtitle, content) {
      if (this.isQx()) $notify(title, subtitle, content);
      else if (this.isSurge()) $notification.post(title, subtitle, content);
    };
    this.isQx = function () { return typeof $task !== "undefined" && typeof $prefs !== "undefined"; };
    this.isSurge = function () { return typeof $httpClient !== "undefined"; };
    this.done = function (d) {
      console.log("\n" + this.name + " ⏱ " + (new Date().getTime() - this.startTime) / 1e3 + "s\n");
      if (typeof $done !== "undefined") $done(d || {});
    };
  })(t);
}