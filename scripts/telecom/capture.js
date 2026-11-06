/**
 * 电信凭据捕获（Quantumult X）
 * v1.0.0
 *
 * 抓取点：
 *   1) appgologinsz.189.cn/map/clientXML 请求体 → App Token / uid / TargetId
 *   2) h5.nty.tv189.com/api/* 请求头 → 天翼超高清凭据（cookie 或 token）
 *
 * 数据键：
 *   chinatelecom_accounts  账号数据（内部，自动维护）
 *   chinatelecom_phones    账号列表（展示）
 *   chinatelecom_tv189     天翼超高清凭据（展示）
 */

const $ = new Env("电信Token同步");
const KEY_ACCOUNTS = "chinatelecom_accounts";
const KEY_PHONES = "chinatelecom_phones";
const KEY_TV189 = "chinatelecom_tv189";

!(async () => {
  if (typeof $request === "undefined") {
    $.msg($.name, "⚠️ 重写规则", "打开中国电信 App 或天翼超高清触发");
    $.done({});
    return;
  }
  var url = String($request.url || "");
  if (/h5\.nty\.tv189\.com/.test(url)) captureTV();
  else captureApp();
})().catch(function (e) {
  console.log("❌ 异常: " + (e && e.message ? e.message : String(e)));
  $.done({});
});

// ═══════════════════════════════════════
// 账号存储
// ═══════════════════════════════════════
function loadAccounts() {
  try {
    var a = JSON.parse($.getdata(KEY_ACCOUNTS) || "[]");
    return Array.isArray(a) ? a : [];
  } catch (e) {
    return [];
  }
}

function saveAccounts(accounts) {
  $.setdata(JSON.stringify(accounts), KEY_ACCOUNTS);
  var display = accounts
    .map(function (a, i) {
      var mark = a.token ? "App" : "TV";
      return i + 1 + ". " + (a.label || a.phone || mark) + " (" + (a.time || "") + ")";
    })
    .join("\n");
  $.setdata(display, KEY_PHONES);
}

function nowStr() {
  var d = new Date();
  return (
    d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes())
  );
}

function maskPhone(p) {
  return p && p.length >= 7 ? p.substring(0, 3) + "****" + p.substring(p.length - 4) : p || "";
}

// ═══════════════════════════════════════
// 中国电信 App Token
// ═══════════════════════════════════════
function captureApp() {
  var reqBody = typeof $request !== "undefined" && $request.body ? String($request.body) : "";
  var respBody = typeof $response !== "undefined" && $response.body ? String($response.body) : "";
  var url = typeof $request !== "undefined" && $request.url ? String($request.url) : "";
  var token = "", uid = "", targetId = "", phone = "";

  if (reqBody) {
    var mTok = reqBody.match(/<Token>([^<]+)<\/Token>/i);
    if (mTok) token = mTok[1].trim();
    var mUln = reqBody.match(/<UserLoginName>([^<;]+);?<\/UserLoginName>/i);
    if (mUln) uid = mUln[1].trim();
    var mTgt = reqBody.match(/<TargetId>([^<]+)<\/TargetId>/i);
    if (mTgt) targetId = mTgt[1].trim();
  }

  if (respBody && !token) {
    try {
      var j = JSON.parse(respBody);
      var lr = (j.responseData && j.responseData.data && j.responseData.data.loginSuccessResult) || null;
      if (lr) {
        token = (lr.token || "").toString();
        uid = (lr.userId || "").toString();
      }
    } catch (e) {}
  }

  if (!token) {
    var mAny = (reqBody + " " + respBody).match(/V1\.[0-9A-Za-z+/=_]{40,600}/);
    if (mAny) token = mAny[0];
  }
  if (!token) {
    console.log("ℹ️ 未捕获到 App Token");
    $.done({});
    return;
  }
  if (!phone) {
    var mp = (reqBody + " " + respBody + " " + url).match(
      /(?:phone|mobile|userLoginName|phoneNum|account)=?["':]*?(1\d{10})/i
    );
    if (mp) phone = mp[1];
  }

  var dedupKey = token.substring(0, 32);
  var accounts = loadAccounts();
  var idx = -1;
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].token && accounts[i].token.substring(0, 32) === dedupKey) {
      idx = i;
      break;
    }
  }
  var ts = nowStr();
  if (idx >= 0) {
    accounts[idx].phone = phone || accounts[idx].phone;
    accounts[idx].uid = uid || accounts[idx].uid;
    accounts[idx].targetId = targetId || accounts[idx].targetId;
    accounts[idx].token = token;
    accounts[idx].label = maskPhone(accounts[idx].phone) || ("账号" + token.substring(token.length - 8));
    accounts[idx].time = ts;
    console.log("🔄 更新账号[" + (idx + 1) + "]");
  } else {
    accounts.push({
      dedupKey: dedupKey,
      label: maskPhone(phone) || ("账号" + token.substring(token.length - 8)),
      phone: phone,
      uid: uid,
      targetId: targetId,
      token: token,
      tv189: null,
      time: ts,
    });
    idx = accounts.length - 1;
    console.log("➕ 新增账号[" + accounts.length + "]: " + accounts[idx].label);
  }

  saveAccounts(accounts);
  $.msg($.name, "✅ " + accounts.length + " 个账号", "App Token 已更新: " + accounts[idx].label + " " + ts);
  $.done({});
}

// ═══════════════════════════════════════
// 天翼超高清凭据（请求头）
// ═══════════════════════════════════════
function captureTV() {
  var h = ($request && $request.headers) || {};
  var url = String(($request && $request.url) || "");
  var cookie = h["Cookie"] || h["cookie"] || "";
  var tok = h["bff-t-id"] || h["Bff-T-Id"] || h["token"] || h["Token"] || "";
  if (!tok && cookie) {
    var m = cookie.match(/(?:^|;\s*)(?:t_id|c_t_id|token)=([^;]+)/);
    if (m) tok = safeDecode(m[1]);
  }
  if (!tok) {
    // 未登录态的公共 cookie 不保存
    if (!/(?:^|;\s*)(?:t_id|c_t_id)=/.test(cookie)) {
      console.log("ℹ️ 未捕获到超高清凭据（未登录请求）");
      $.done({});
      return;
    }
    tok = cookie;
  }

  // 优先保存可完整回放的 Cookie（含登录 cookie 时）
  var type = "token";
  var value = tok;
  if (cookie && /(?:^|;\s*)(?:t_id|c_t_id)=/.test(cookie)) {
    type = "cookie";
    value = cookie;
  } else if (!tok && cookie) {
    type = "cookie";
    value = cookie;
  }

  var dedup = value.substring(0, 40) + "|" + value.length;
  var accounts = loadAccounts();
  var target = null;
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].tv189 && accounts[i].tv189.dedup === dedup) {
      target = accounts[i];
      break;
    }
  }
  var ts = nowStr();
  if (target) {
    target.tv189.value = value;
    target.tv189.type = type;
    target.time = ts;
    console.log("🔄 超高清凭据已存在，更新时间");
  } else {
    var phone = "";
    var mp = (cookie + " " + url).match(/(?:phone|mobile|userName|loginName)=?["':]*?(1\d{10})/i);
    if (mp) phone = mp[1];

    if (accounts.length === 1) target = accounts[0];
    if (!target && phone) {
      for (var j = 0; j < accounts.length; j++) {
        if (accounts[j].phone === phone) { target = accounts[j]; break; }
      }
    }
    if (!target) {
      for (var k = 0; k < accounts.length; k++) {
        if (accounts[k].token && !accounts[k].tv189) { target = accounts[k]; break; }
      }
    }
    if (!target) {
      target = {
        dedupKey: "",
        label: "天翼超高清",
        phone: phone,
        uid: "",
        targetId: "",
        token: "",
        tv189: null,
        time: ts,
      };
      accounts.push(target);
    }
    target.tv189 = { dedup: dedup, type: type, value: value };
    target.time = ts;
    console.log("➕ 超高清凭据已保存 (" + type + ", " + value.length + ")");
  }

  $.setdata((type === "cookie" ? "Cookie：" : "Token：") + value.substring(0, 16) + "…", KEY_TV189);
  saveAccounts(accounts);
  $.msg($.name, "✅ 超高清凭据已捕获", "已写入 BoxJS，可在青龙推送脚本中合并");
  $.done({});
}

// ═══════════════════════════════════════
// 工具
// ═══════════════════════════════════════
function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch (e) {
    return v;
  }
}
function pad(n) {
  return n < 10 ? "0" + n : "" + n;
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