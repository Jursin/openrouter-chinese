import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const dictionaryText = readFileSync(new URL("../locales/zh-CN.json", import.meta.url), "utf8");
const dict = JSON.parse(dictionaryText);
const PARTIAL_DICTIONARY = Object.fromEntries(Object.entries(dict).slice(0, 20));
const release = JSON.parse(readFileSync(new URL("../release.config.json", import.meta.url), "utf8"));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const BUILTIN_REVISION = release.dictionaryRevision;
const SCRIPT_VERSION = pkg.version;
const DICTIONARY_ENTRIES = Object.keys(dict).length;
const CACHE_KEY = "openrouter-zh-remote-dictionary-v1";
const NOW = Date.now();
const SOURCES = [
  "https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/locales/zh-CN.online.json",
  "https://cdn.jsdelivr.net/gh/isdoge/openrouter-chinese@main/locales/zh-CN.online.json",
  "https://raw.githubusercontent.com/isdoge/openrouter-chinese/v" + SCRIPT_VERSION + "/locales/zh-CN.online.json",
];
assert.ok(DICTIONARY_ENTRIES >= 1731, "完整词典不得丢失既有覆盖范围");
assert.equal(dict.schemaVersion, undefined, "local dictionary must stay a plain object");
assert.equal(release.legacyVersion, undefined, "local version derives from dictionary date, not config");

const old = readFileSync(new URL("../legacy/archive/src/openrouter-chinese.user.js", import.meta.url), "utf8");
const match = old.match(/^  const EXACT_TEXT = new Map\(\[\r?\n([\s\S]*?)^  \]\);/m);
assert.ok(match, "original dictionary exists");
const recordRx = /^\s*\[("(?:[^"\\]|\\.)*"),\s*("(?:[^"\\]|\\.)*")\],?\s*$/;
const expected = new Map();
for (const line of match[1].split("\n").filter((line) => line.trim())) {
  const record = line.match(recordRx);
  assert.ok(record, "unrecognized original record: " + line);
  expected.set(JSON.parse(record[1]), JSON.parse(record[2]));
}
// 远程词典是原版词典的超集：迁移条目默认保持原值，仅允许下列记录在案的修正。
// 包括：token 专有名词保留英文，以及本轮合并中按上下文/全站术语统一调整的译法。
const DOCUMENTED_OVERRIDES = new Map([
    ["Add credits", "充值额度"],
    ["Last 7 days", "最近 7 天"],
    ["Last 30 days", "最近 30 天"],
    ["Ask anything...", "随便问点什么…"],
    ["Create Artifact...", "创建产物..."],
    ["Select artifact type", "选择产物类型"],
    ["Inactive Models", "未活跃模型"],
    ["Top models on OpenRouter by Artificial Analysis Intelligence Index", "OpenRouter 上按人工分析智能指数排名的热门模型"],
    ["Data sourced from Artificial Analysis", "数据来源：人工分析"],
    ["Longest streak", "最长连续天数"],
  ]);
for (const [key, value] of expected) {
  if (DOCUMENTED_OVERRIDES.has(key)) {
    assert.equal(dict[key], DOCUMENTED_OVERRIDES.get(key), `documented override changed: ${key}`);
    continue;
  }
  assert.equal(dict[key], value, `original translation must be preserved: ${key}`);
}
assert.ok(Object.keys(dict).length > expected.size, "remote dictionary should keep growing beyond the migrated set");

// 词典条目必须落在运行时 parseDictionary 的接受范围内，否则整份词典会被静默丢弃
// （曾出现一条 1056 字符的键令 DICTIONARY_ENTRIES 条词典全部失效）。
for (const [key, value] of Object.entries(dict)) {
  assert.ok(key.trim() && key.length <= 4000, `dictionary key out of runtime range (${key.length}): ${key.slice(0, 60)}`);
  assert.ok(typeof value === "string" && value.trim() && value.length <= 8000,
    `dictionary value out of runtime range (${value.length}): ${key.slice(0, 60)}`);
}
assert.ok(Object.keys(dict).length <= 5000, "dictionary must stay within the runtime entry-count limit");

function envelope(dictionary = dict, revision = BUILTIN_REVISION) {
  return JSON.stringify({ schemaVersion: 1, revision, entries: Object.keys(dictionary).length, dictionary });
}

function createLocks() {
  let queue = Promise.resolve();
  return {
    request(name, options, callback) {
      assert.equal(name, "openrouter-zh-dictionary-commit-v1");
      assert.equal(options.mode, "exclusive");
      const result = queue.then(() => callback({ name, mode: options.mode }));
      queue = result.catch(() => {});
      return result;
    },
  };
}

function harness(code, {
  store = new Map(), firstReply = envelope(), replies = [], initialText = "One API for Any Model",
  attributes = { title: "Action menu", placeholder: "API Keys", "aria-label": "Open navigation menu" },
  holdRequests = false, failCacheWrites = false, failCacheReads = false, locks = createLocks(), beforeCacheWrite = null,
} = {}) {
  const node = {
    textContent: initialText,
    parentElement: { tagName: "SPAN", closest() { return null; } },
  };
  const values = new Map(Object.entries(attributes));
  const element = {
    tagName: "INPUT",
    hasAttribute(name) { return values.has(name); },
    getAttribute(name) { return values.get(name) ?? null; },
    setAttribute(name, value) { values.set(name, value); },
  };
  const doc = {
    readyState: "complete",
    title: "API Keys | Settings | OpenRouter",
    body: { querySelectorAll(selector) { return selector === "*" ? [element] : []; } },
    documentElement: { lang: "en" },
    addEventListener() {},
    createTreeWalker(_root, _show, filter) {
      let visited = false;
      return {
        nextNode() {
          if (visited) return null;
          visited = true;
          return filter?.acceptNode(node) === 2 ? null : node;
        },
      };
    },
  };
  let reply = typeof firstReply === "string" ? { body: firstReply } : firstReply;
  let queued = [...replies];
  const requests = [];
  const pending = [];
  const writes = [];
  const timeouts = [];
  const intervals = [];
  const menus = new Map();
  function respond(options, response) {
    if (response.event === "error") options.onerror({});
    else if (response.event === "timeout") options.ontimeout();
    else options.onload({ status: response.status ?? 200, responseText: response.body ?? envelope() });
  }
  const context = {
    document: doc,
    window: { addEventListener() {}, alert() {} },
    history: { pushState() {}, replaceState() {} },
    location: { hostname: "openrouter.ai", pathname: "/settings", search: "" },
    NodeFilter: { SHOW_TEXT: 4, FILTER_REJECT: 2, FILTER_ACCEPT: 1 },
    MutationObserver: class {
      observe() {}
      disconnect() {}
    },
    GM_getValue(key, defaultValue) {
      if (failCacheReads && key === CACHE_KEY) throw new Error("模拟共享缓存读取失败");
      return store.has(key) ? store.get(key) : defaultValue;
    },
    GM_setValue(key, value) {
      writes.push([key, value]);
      if (failCacheWrites && key === CACHE_KEY) throw new Error("simulated cache write failure");
      if (key === CACHE_KEY && beforeCacheWrite) {
        const callback = beforeCacheWrite;
        beforeCacheWrite = null;
        callback();
      }
      store.set(key, value);
    },
    GM_registerMenuCommand(title, callback) { menus.set(title, callback); return menus.size; },
    GM_xmlhttpRequest(options) {
      requests.push(options);
      if (holdRequests) pending.push(options);
      else respond(options, queued.shift() ?? reply);
    },
    requestAnimationFrame(callback) { timeouts.push(callback); },
    setTimeout(callback) { timeouts.push(callback); return timeouts.length; },
    setInterval(callback, ms) { intervals.push({ callback, ms }); return intervals.length; },
    Date: class extends Date { static now() { return NOW; } },
    navigator: { locks },
    URL,
    console: { info() {}, warn() {} },
  };
  vm.runInNewContext(code, context, { filename: "dist/openrouter-chinese.user.js", timeout: 3000 });
  const api = context.window.__openrouterChineseRemote;
  for (const method of ["run", "translate", "refreshDictionary", "getDictionaryStatus"]) {
    assert.equal(typeof api?.[method], "function", `compatible API method ${method} must exist`);
  }
  for (const removed of ["importDictionary", "setAutoUpdate"]) {
    assert.equal(api?.[removed], undefined, `${removed} has been removed from the public API`);
  }
  assert.equal(api.version, SCRIPT_VERSION);
  const status = api.getDictionaryStatus();
  assert.equal(status.version, SCRIPT_VERSION);
  assert.equal(typeof status.revision, "number");
  assert.equal(typeof status.entries, "number");
  assert.equal(typeof status.source, "string");
  assert.equal(status.autoUpdate, undefined, "auto update has been removed");
  // 菜单只有手动更新与状态查看；自动更新与导入 JSON 已按需求移除。
  assert.equal(menus.size, 2, "only manual update and status menus remain");
  for (const label of [/立即更新/, /查看.*状态/]) {
    assert.ok([...menus].some(([title, callback]) => label.test(title) && typeof callback === "function"),
      `expected menu matching ${label}`);
  }
  for (const title of menus.keys()) {
    assert.doesNotMatch(title, /自动|导入/i, `menu must not offer auto update or import: ${title}`);
  }
  return {
    node, doc, element, store, context, api, menus, writes, requestOptions: requests, intervals,
    get requests() { return requests.length; },
    get urls() { return requests.map(({ url }) => { const parsed = new URL(url); parsed.search = ""; return parsed.href; }); },
    get menu() { return [...menus].find(([title]) => /立即更新/.test(title))[1]; },
    setReply(value, status = 200) { reply = typeof value === "string" ? { body: value, status } : value; queued = []; },
    setCacheWriteFailure(value) { failCacheWrites = value; },
    start() {
      // Execute startup, not api.run(): offline translation must not rely on fetch completion.
      timeouts.shift()?.();
    },
    release() {
      holdRequests = false;
      const options = pending.shift();
      assert.ok(options, "expected a held dictionary request");
      respond(options, queued.shift() ?? reply);
    },
  };
}

async function flush() {
  for (let i = 0; i < 32; i++) await Promise.resolve();
}

const artifacts = ["../dist/openrouter-chinese.user.js", "../dist/openrouter-chinese-remote.user.js"];
for (const artifact of artifacts) {
  const code = readFileSync(new URL(artifact, import.meta.url), "utf8");
  assert.match(code, /^\/\/[ \t]*@name[ \t]+OpenRouter 中文化插件[ \t]*\r?$/m);
  assert.equal(code.match(/^\/\/[ \t]*@version[ \t]+([^\s]+)[ \t]*\r?$/m)?.[1], SCRIPT_VERSION);
  assert.match(code, /@grant\s+GM_xmlhttpRequest/);
  assert.match(code, /@connect\s+raw\.githubusercontent\.com/);
  assert.match(code, /@connect\s+cdn\.jsdelivr\.net/);
  if (artifact.endsWith("openrouter-chinese-remote.user.js")) {
    assert.match(code, /^\/\/[ \t]*@namespace[ \t]+https:\/\/github\.com\/isdoge\/openrouter-chinese\/remote-dictionary-preview[ \t]*\r?$/m,
      "the old online installation namespace must be retained");
  }
  // 在线版不内置词典：脚本本体不得携带完整快照。
  assert.doesNotMatch(code, /"Skip to content": "跳到内容"/, "online artifact must not embed the full dictionary");

  // 无缓存首装：请求挂起时页面保持英文，三个来源全部尝试后仍不误翻。
  const offline = harness(code, { firstReply: { event: "error" }, holdRequests: true });
  offline.start();
  assert.equal(offline.node.textContent, "One API for Any Model", "no builtin dictionary: text stays before reply");
  // 正则规则不依赖词典，标题仍是可译的；词典词条（如 placeholder）在空词典下保持英文。
  assert.equal(offline.doc.title, "API 密钥 | 设置 | OpenRouter");
  assert.equal(offline.element.getAttribute("placeholder"), "API Keys");
  assert.equal(offline.api.getDictionaryStatus().entries, 0);
  if (artifact.endsWith("/openrouter-chinese.user.js")) {
    for (const method of ["run", "translate", "refreshDictionary", "getDictionaryStatus"]) {
      assert.equal(typeof offline.context.window.__openrouterChinese?.[method], "function");
    }
    assert.equal(offline.context.window.__openrouterChinese.version, SCRIPT_VERSION);
  }
  await flush();
  offline.release();
  await flush();
  assert.equal(offline.requests, 3, "DNS failures must exhaust all three sources");
  assert.deepEqual(offline.urls, SOURCES);
  for (const request of offline.requestOptions) assert.equal(request.timeout, 8000);
  assert.equal(offline.node.textContent, "One API for Any Model");
  assert.equal(offline.api.getDictionaryStatus().entries, 0);
  assert.equal(offline.store.has(CACHE_KEY), false);
  assert.equal(
    offline.intervals.filter(({ ms }) => ms !== 1000).length, 0,
    "no dictionary polling intervals: only the 1s route poll may exist");

  // 手动更新：成功后词典生效并缓存；再点立即更新会重新请求（无冷却）。
  const h = harness(code, { firstReply: envelope() });
  h.start();
  assert.equal(h.node.textContent, "One API for Any Model");
  await flush();
  assert.equal(h.requests, 1, "startup fetches the dictionary once");
  assert.equal(h.node.textContent, dict["One API for Any Model"], "startup reply applies dictionary");
  assert.equal(h.doc.title, "API 密钥 | 设置 | OpenRouter", "title translates after dictionary load");
  assert.equal(h.element.getAttribute("placeholder"), "API 密钥");
  const initialCache = JSON.parse(h.store.get(CACHE_KEY));
  assert.equal(initialCache.schemaVersion, 1);
  assert.equal(initialCache.revision, BUILTIN_REVISION);
  assert.equal(initialCache.entries, Object.keys(initialCache.dictionary).length);
  assert.equal(initialCache.entries, DICTIONARY_ENTRIES);

  const changed = {
    ...dict,
    "One API for Any Model": "远程热更新已生效",
    "API Keys | Settings | OpenRouter": "标题热更新已生效",
    "Action menu": "菜单热更新已生效",
    "API Keys": "热更新 API 密钥",
  };
  h.setReply(envelope(changed, BUILTIN_REVISION + 1));
  assert.equal(await h.menu(), true, "manual menu forces an update");
  await flush();
  assert.equal(h.node.textContent, "远程热更新已生效", "must retranslate from English source");
  assert.equal(h.doc.title, "标题热更新已生效", "title must retain its English source");
  assert.equal(h.element.getAttribute("title"), "菜单热更新已生效");
  assert.equal(h.element.getAttribute("placeholder"), "热更新 API 密钥", "attributes must retain English source");
  assert.equal(h.requests, 2, "manual update always issues a fresh request (no cooldown)");

  for (const [label, replyFailure] of [
    ["bad JSON", { body: "{invalid-json" }],
    ["HTTP failure", { status: 503 }],
    ["same revision with different dictionary", { body: envelope({ ...changed, "One API for Any Model": "同版本篡改" }, BUILTIN_REVISION + 1) }],
    ["older revision", { body: envelope(dict) }],
  ]) {
    const before = h.requests;
    const saved = h.store.get(CACHE_KEY);
    h.setReply(replyFailure);
    assert.equal(await h.menu(), false, `${label} is not a successful refresh`);
    assert.equal(h.requests, before + 3, `${label} must try every source`);
    assert.equal(h.node.textContent, "远程热更新已生效", `${label} must retain last valid dictionary`);
    assert.equal(h.doc.title, "标题热更新已生效");
    assert.equal(h.element.getAttribute("placeholder"), "热更新 API 密钥");
    assert.equal(h.store.get(CACHE_KEY), saved, `${label} must not replace cache`);
    assert.equal(h.api.getDictionaryStatus().revision, BUILTIN_REVISION + 1);
  }
  // 上面 "same revision with different dictionary" 已覆盖签名锚定后的同版本篡改拒绝：
  // h 此时已加载 BUILTIN_REVISION+1 的 changed 词典，currentSignature 已锚定。

  // 重开页面：缓存立即生效，无需等待网络。
  const restored = harness(code, { store: new Map(h.store), firstReply: { event: "error" } });
  restored.start();
  assert.equal(restored.node.textContent, "远程热更新已生效", "cache must translate before any network reply");
  assert.equal(restored.doc.title, "标题热更新已生效");
  await flush();
  assert.equal(restored.requests, 3, "startup still refreshes once even with cache");

  // 缓存损坏或过旧：回退到空词典，不误翻，重新拉取可恢复。
  for (const cached of [undefined, "{broken", "{}", "[]", envelope(dict, BUILTIN_REVISION - 1)]) {
    const store = new Map();
    if (cached !== undefined) store.set(CACHE_KEY, cached);
    const recovering = harness(code, { store });
    recovering.start();
    assert.equal(recovering.node.textContent, "One API for Any Model");
    await flush();
    assert.equal(recovering.requests, 1, "missing/invalid/stale cache must be refetched");
    assert.equal(recovering.api.getDictionaryStatus().revision, BUILTIN_REVISION);
  }

  // 多路来源最小单元测试：每一种无效主源都必须进入镜像，而非只在 404 时回退。
  const candidate = envelope({ ...PARTIAL_DICTIONARY, "One API for Any Model": "候选来源覆盖" }, BUILTIN_REVISION + 1);
  const failures = [
    ["HTTP 404", { status: 404 }],
    ["HTTP 503", { status: 503 }],
    ["DNS", { event: "error" }],
    ["timeout", { event: "timeout" }],
    ["malformed JSON", { body: "{broken" }],
    ["plain-object remote JSON", { body: dictionaryText }],
    ["old revision", { body: envelope(dict, BUILTIN_REVISION - 1) }],
    ["unsafe revision", { body: envelope(dict, Number.MAX_SAFE_INTEGER + 1) }],
    ["fractional revision", { body: envelope(dict, BUILTIN_REVISION + 0.5) }],
    ["wrong schema", { body: JSON.stringify({ ...JSON.parse(candidate), schemaVersion: 2 }) }],
    ["wrong entries count", { body: JSON.stringify({ ...JSON.parse(candidate), entries: DICTIONARY_ENTRIES }) }],
  ];
  for (const [label, failure] of failures) {
    const fallback = harness(code, { replies: [failure, { body: candidate }] });
    fallback.start();
    await flush();
    assert.equal(fallback.requests, 2, `${label} must fall back to the mirror`);
    assert.deepEqual(fallback.urls, SOURCES.slice(0, 2));
    assert.equal(fallback.node.textContent, "候选来源覆盖", `${label}: valid next source must apply`);
    assert.equal(fallback.api.getDictionaryStatus().revision, BUILTIN_REVISION + 1);
    for (const request of fallback.requestOptions) {
      assert.equal(request.timeout, 8000, "each source has an 8000ms timeout");
      assert.equal(request.method, "GET");
    }
  }
  const tagged = harness(code, { replies: [{ event: "error" }, { body: "{broken" }, { body: candidate }] });
  tagged.start();
  await flush();
  assert.equal(tagged.requests, 3, "two failed sources must reach the version-tagged snapshot");
  assert.deepEqual(tagged.urls, SOURCES);
  assert.equal(tagged.node.textContent, "候选来源覆盖");
  const allFailed = harness(code, { replies: [{ status: 503 }, { event: "error" }, { event: "timeout" }] });
  allFailed.start();
  await flush();
  assert.equal(allFailed.requests, 3);
  assert.deepEqual(allFailed.urls, SOURCES);
  assert.equal(allFailed.node.textContent, "One API for Any Model");
  assert.equal(allFailed.store.has(CACHE_KEY), false);

  // 缓存写入失败：词典不生效也不落盘（旧版本行为：内存生效但不落盘；现在统一为不生效），
  // 手动重试在写入恢复后成功。
  const writeFailure = harness(code, {
    firstReply: envelope({ ...PARTIAL_DICTIONARY, "One API for Any Model": "持久化重试成功" }, BUILTIN_REVISION + 1), failCacheWrites: true,
  });
  writeFailure.start();
  await flush();
  assert.equal(writeFailure.requests, 1);
  assert.equal(writeFailure.store.has(CACHE_KEY), false);
  assert.equal(writeFailure.writes.some(([key]) => key === CACHE_KEY), true, "write attempt happened");
  assert.equal(writeFailure.api.translate("One API for Any Model"), "One API for Any Model",
    "failed persistence must not apply the dictionary");
  writeFailure.setCacheWriteFailure(false);
  assert.equal(await writeFailure.menu(), true, "manual retry persists the dictionary");
  assert.equal(writeFailure.api.translate("One API for Any Model"), "持久化重试成功");
  assert.equal(JSON.parse(writeFailure.store.get(CACHE_KEY)).revision, BUILTIN_REVISION + 1);

  // 不支持 Web Locks 时拒绝不安全的缓存写入，词典不应用（与写入失败一致）。
  const noLocks = harness(code, { locks: null });
  noLocks.start();
  await flush();
  assert.equal(noLocks.store.has(CACHE_KEY), false, "no Web Locks means no unsafe cache write");
  assert.equal(noLocks.node.textContent, "One API for Any Model");

  // 动态内容在词典更新后重新翻译；站点改动源文本不冻死。
  const dynamic = harness(code, {});
  dynamic.start();
  await flush();
  dynamic.node.textContent = "Create Workspace";
  dynamic.element.setAttribute("placeholder", "Create Workspace");
  dynamic.doc.title = "Guardrails | OpenRouter";
  dynamic.api.run();
  assert.equal(dynamic.node.textContent, "创建工作区");
  assert.equal(dynamic.element.getAttribute("placeholder"), "创建工作区", "site-mutated attributes must rederive their source");
  assert.equal(dynamic.doc.title, "护栏 | OpenRouter", "site-mutated title must rederive its source");
  dynamic.setReply(envelope({ ...PARTIAL_DICTIONARY, "Create Workspace": "动态属性热更新" }, BUILTIN_REVISION + 1));
  assert.equal(await dynamic.api.refreshDictionary(), true);
  assert.equal(dynamic.node.textContent, "动态属性热更新");
  assert.equal(dynamic.element.getAttribute("placeholder"), "动态属性热更新");

  // 保留英文规范化冻死回归，但使用非 token 夹具，避免违背 tokens 保持英文的合同。
  const frozen = harness(code, {
    firstReply: envelope({ ...dict, "Normalization source": "Normalization target", "Normalization target": "规范化完成" }, BUILTIN_REVISION + 1),
    initialText: "Normalization source", attributes: { placeholder: "Normalization source" },
  });
  frozen.start();
  await flush();
  assert.equal(frozen.node.textContent, "Normalization target", "normalization should apply once");
  assert.equal(frozen.element.getAttribute("placeholder"), "Normalization target");
  frozen.node.textContent = "Normalization target";
  frozen.element.setAttribute("placeholder", "Normalization target");
  frozen.api.run();
  assert.equal(frozen.node.textContent, "规范化完成", "normalized English text must not freeze its source");
  assert.equal(frozen.element.getAttribute("placeholder"), "规范化完成", "normalized English attributes must not freeze");
  frozen.api.run();
  assert.equal(frozen.node.textContent, "规范化完成", "normalization must remain stable");
  assert.equal(frozen.element.getAttribute("placeholder"), "规范化完成");

  const ready = harness(code, {});
  ready.start();
  await flush();
  const { translate } = ready.api;
  assert.equal(translate("Tools: 8 active"), "工具：8 个已启用");
  assert.equal(translate("Show 63 more"), "显示另外 63 个");
  assert.equal(translate("Key limit: 0% used of unlimited"), "密钥限额：已使用 0%，上限不限");
  assert.equal(translate("37.6T Token"), "37.6T Token", "token 是专有名词，不译成令牌");
  assert.equal(translate("37.6T tokens"), "37.6T Token");
  assert.equal(translate("Token"), "Token", "standalone Token must stay English");
  assert.equal(translate("tokens"), "Token");
  // 排行榜/Apps/Ori 页新增规则（真实浏览器采集）
  assert.equal(translate("1.11M requests"), "1.11M 次请求");
  assert.equal(translate("875,253 subrequests"), "875,253 次子请求", "subrequests rule must precede requests");
  assert.equal(translate("58.0% of Hebrew spend"), "占希伯来语支出的 58.0%", "category must be translated too");
  assert.equal(translate("16.2% of Arts & entertainment spend"), "占艺术与娱乐支出的 16.2%");
  assert.equal(translate("11.0% of all spend"), "占总支出 11.0%");
  assert.equal(translate("Domain · 19.6% of all spend"), "领域 · 占总支出 19.6%");
  assert.equal(translate("739 tok/s"), "739 Token/秒");
  assert.equal(translate("$0.75/M"), "$0.75/百万");
  assert.equal(translate("Find a model to pin, 0 of 5 pinned"), "查找要固定的模型，已固定 0 个，共 5 个");
  assert.equal(translate("gemini-3-pro · via OpenRouter"), "gemini-3-pro · 通过 OpenRouter");
  assert.equal(translate("Ranked at #50 in Academia category"), "在学术分类中排名第 50", "category name translated recursively");
  assert.equal(translate("$20/M characters"), "$20/百万字符");
  assert.equal(translate("193M characters"), "193M 个字符");
  assert.equal(translate("1.46B tokens"), "1.46B Token", "B (billions) suffix must be accepted");
  assert.equal(translate("37.6T Token"), "37.6T Token");
  assert.equal(translate("2,895% — Change in subrequests in the last week from the previous period"),
    "2,895% — 本周子请求数相对上一周期的变化");
  // 模型名本体保留，"(batch)" 是请求类型后缀（词典 Batch=批量），随界面一起译
  assert.equal(translate("Claude Sonnet 5.5 (batch): 875,253 subrequests this week"),
    "Claude Sonnet 5.5（批量）：本周 875,253 个子请求", "model name stays, batch suffix and metric translated");
  // 有意保留英文的专有名词
  for (const safe of ["Amazon Bedrock", "gemini-3-pro", "claude-sonnet-5", "openai/gpt-5", "anthropic/claude-opus-latest"]) {
    assert.equal(translate(safe), safe, `must stay untouched: ${safe}`);
  }
  assert.equal(translate("Set a spend limit on 1 key"), "为 1 个密钥设置支出限额");
  assert.equal(translate("Set a spend limit on 12 keys"), "为 12 个密钥设置支出限额");
  assert.equal(translate("Review 1 key without expiration"), "复查 1 个无过期时间的密钥");
  assert.equal(translate("Review 7 keys without expiration"), "复查 7 个无过期时间的密钥");
  assert.equal(translate("Actions for newkey"), "newkey 的操作");
  assert.equal(translate("Remove 1 unused key"), "移除 1 个闲置密钥");
  assert.equal(translate("Remove 3 unused keys"), "移除 3 个闲置密钥");
  assert.equal(translate("Unused 90+ days"), "90 天以上未使用");
  assert.equal(translate("1 of 1 keys"), "第 1 个，共 1 个密钥");
  assert.equal(translate("of 12 keys"), "共 12 个密钥");
  assert.equal(translate("Security | OpenRouter"), "安全 | OpenRouter");
  assert.equal(translate("sk-or-v1-abc"), "sk-or-v1-abc", "API keys must stay untouched");
  assert.equal(translate("openai/gpt-5"), "openai/gpt-5", "model ids must stay untouched");
  for (const [key, value] of [
    ["Dashboard", "仪表盘"],
    ["Tools", "工具"],
    ["Dismiss", "关闭"],
    ["Security", "安全"],
    ["Switch account", "切换账号"],
    ["Author", "作者"],
    ["New chat", "新建聊天"],
    ["Upload", "上传"],
    ["Routers", "路由器"],
    ["Finish Reason", "结束原因"],
    ["Key safety", "密钥安全"],
    ["IP allowlist", "IP 白名单"],
    ["No spend limit", "无支出上限"],
    ["View keys", "查看密钥"],
    ["Never used or idle 90+ days", "从未使用或闲置超过 90 天"],
    ["Safe to remove", "可安全移除"],
    ["Recommendations", "建议"],
    ["Enforce a maximum key lifetime", "强制密钥最长有效期"],
    ["Open privacy settings", "打开隐私设置"],
    ["Security settings", "安全设置"],
    ["Search by name, label, or owner", "按名称、标签或负责人搜索"],
    ["Inactivity", "闲置情况"],
    ["Filter keys", "筛选密钥"],
    ["Sort by", "排序方式"],
    ["Sort ascending", "升序排列"],
    ["Sort descending", "降序排列"],
    ["A leaked key could spend without a cap.", "密钥泄露后可能无上限支出。"],
    ["Keys that stay valid until they are removed.", "这些密钥在被移除前一直有效。"],
    ["No requests in the last 90 days.", "最近 90 天没有任何请求。"],
    ["Idle keys with little or no lifetime usage.", "闲置且累计用量极少或为零的密钥。"],
    ["Any activity", "任何活动"],
    ["Risk", "风险"],
    ["Last used", "上次使用"],
    ["Lifetime usage", "累计用量"],
    ["No limit or expiry", "无限额、无过期时间"],
    ["Select all visible keys", "选择所有可见密钥"],
    ["Show management keys", "显示管理密钥"],
    ["Set limit", "设置限额"],
    ["Archive", "归档"],
    ["Copy owner list", "复制负责人列表"],
    ["Never used", "从未使用"],
  ]) {
    assert.equal(dict[key], value, `dictionary entry added: ${key}`);
    assert.equal(translate(key), value, `translate must apply new entry: ${key}`);
  }
  console.log(`${artifact.slice(3)} 回归通过：外置词典 ${DICTIONARY_ENTRIES} 条，启动拉取、三源回退、缓存、手动菜单、热更新、属性与标题。`);
}
console.log(`在线版回归通过：${artifacts.length} 个产物；网络与存储均为单元测试模拟，不冒充真实浏览器验收。`);
