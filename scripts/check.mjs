import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dictionary = JSON.parse(readFileSync(path.join(rootDir, "locales", "zh-CN.json"), "utf8"));
const release = JSON.parse(readFileSync(path.join(rootDir, "release.config.json"), "utf8"));
const pkg = JSON.parse(readFileSync(path.join(rootDir, "package.json"), "utf8"));
const DICTIONARY_ENTRIES = Object.keys(dictionary).length;
assert.ok(DICTIONARY_ENTRIES >= 1731, "完整词典不得丢失既有覆盖范围");
assert.equal(dictionary.schemaVersion, undefined, "the local dictionary must not be an online envelope");

// 本地版版本号 = 词典日期（revision 2026101101 → 26.10.11），与构建脚本保持同一派生规则。
function legacyDateVersion(revision) {
  const text = String(revision);
  return text.slice(2, 4) + "." + text.slice(4, 6) + "." + text.slice(6, 8);
}

const artifacts = [
  { file: "dist/openrouter-chinese.user.js", version: pkg.version, canonical: true },
  { file: "dist/openrouter-chinese-remote.user.js", version: pkg.version },
  { file: "legacy/openrouter-chinese.user.js", version: legacyDateVersion(release.dictionaryRevision), legacy: true },
].map((artifact) => {
  const output = path.join(rootDir, artifact.file);
  assert.equal(existsSync(output), true, `expected ${artifact.file}; run npm run build first`);
  const syntax = spawnSync(process.execPath, ["--check", output], { cwd: rootDir, encoding: "utf8" });
  assert.equal(syntax.status, 0,
    `expected ${artifact.file} syntax check to pass\nstdout:\n${syntax.stdout}\nstderr:\n${syntax.stderr}`);
  const code = readFileSync(output, "utf8");
  assert.match(code, /==UserScript==/);
  assert.match(code, new RegExp(`^//[ \\t]*@version[ \\t]+${artifact.version.replaceAll(".", "\\.")}[ \\t]*\\r?$`, "m"));
  assert.match(code, /@match\s+https:\/\/openrouter\.ai\/\*/);
  if (artifact.legacy) {
    assert.deepEqual([...code.matchAll(/^\/\/\s*@grant[ \t]+([^\r\n]+)/gm)].map((match) => match[1].trim()), ["none"]);
  } else {
    assert.match(code, /^\/\/[ \t]*@name[ \t]+OpenRouter 中文化插件[ \t]*\r?$/m, "online release name must have no suffix");
  }
  const rules = code.match(/^\s*const REGEX_RULES = \[[\s\S]*?^\s*\];/m)?.[0];
  assert.ok(rules, `expected REGEX_RULES in ${artifact.file}`);
  return { ...artifact, code, rules };
});
for (const artifact of artifacts) {
  assert.equal(artifact.rules, artifacts[0].rules, `${artifact.file} must use the same regex rules`);
}

const translationCases = [
  ["API Keys", "API 密钥"],
  ["Create and manage your API keys.", "创建并管理你的 API 密钥。"],
  ["Action menu", "操作菜单"],
  ["Create Workspace", "创建工作区"],
  ["Set spending limits, data privacy rules, and model/provider restrictions for", "为以下对象设置支出限额、数据隐私规则，以及模型/提供商限制："],
  ["API keys in this workspace.", "此工作区中的 API 密钥。"],
  ["Use your own provider API keys on OpenRouter", "在 OpenRouter 上使用你自己的提供商 API 密钥"],
  ["Key Priority and Fallback", "密钥优先级与回退"],
  ["Default Provider Sort", "默认提供商排序"],
  ["Default (balanced)", "默认（平衡）"],
  ["Price (cheapest first)", "价格（最便宜优先）"],
  ["Pin model", "固定模型"],
  ["Suggestions", "建议"],
  ["No presets yet", "还没有预设"],
  ["Configure Web Search", "配置网页搜索"],
  ["Auto (native if supported, otherwise Exa)", "自动（支持时使用原生，否则使用 Exa）"],
  ["Include Domains", "包含域名"],
  ["Exclude Domains", "排除域名"],
  ["Comma-separated. Supports wildcards.", "用英文逗号分隔，支持通配符。"],
  ["Configure PDF Inputs", "配置 PDF 输入"],
  ["PDF Parser Engine", "PDF 解析引擎"],
  ["Cloudflare AI (free, basic)", "Cloudflare AI（免费，基础）"],
  ["Configure Response Healing", "配置响应修复"],
  ["Input & Output Logging", "输入与输出日志"],
  ["Add Destination", "添加目标"],
  ["Video Generation", "视频生成"],
  ["Filter by User, Model, Provider, API Key, or Modality", "按用户、模型、提供商、API 密钥或模态筛选"],
  ["No transactions found", "未找到交易"],
  ["No management keys yet", "还没有管理密钥"],
  ["Zero Data Retention", "零数据保留"],
  ["Allowed Providers", "允许的提供商"],
  ["Enable analytics cookies", "启用分析 Cookie"],
  ["Give your guardrail a name, then configure the policies you want to enforce.", "为护栏命名，然后配置要强制执行的策略。"],
  ["Once saved, you can configure policies, assign members, and manage API keys from the guardrail detail page.", "保存后，你可以在护栏详情页配置策略、分配成员并管理 API 密钥。"],
  ["Guardrails | OpenRouter", "护栏 | OpenRouter"],
  ["API Key | Settings | OpenRouter", "API 密钥 | 设置 | OpenRouter"],
  ["LLM Rankings | OpenRouter", "大语言模型排行榜 | OpenRouter"],
  ["Decision Model Rankings | OpenRouter", "决策模型排行榜 | OpenRouter"],
  ["Batch Rankings | OpenRouter", "批量排行榜 | OpenRouter"],
  ["App & Agent Rankings | OpenRouter", "应用与 Agent 排行榜 | OpenRouter"],
  ["Ori - Use Every Model, Right Where You Are | OpenRouter", "Ori - 使用每一个模型，就在你身边 | OpenRouter"],
  ["Open navigation menu", "打开导航菜单"],
  ["Grey", "灰色"],
  ["Purple", "紫色"],
  ["Default Apr 26, 12:15 PM", "默认 Apr 26, 12:15 PM"],
  ["Short 4/26 12:15pm", "短格式 4/26 12:15pm"],
  ["Relative 3 hours ago", "相对时间 3 hours ago"],
  ["1 key", "1 个密钥"],
  ["2 guardrails", "2 个护栏"],
  ["4 models", "4 个模型"],
  ["38 models matched", "匹配 38 个模型"],
  ["Remaining credits: 0", "剩余额度：0"],
  ["Reset limit", "重置限额"],
  ["Total", "总计"],
  ["Metadata", "元数据"],
  ["Budgets", "预算"],
  ["No budget limits configured.", "未配置预算限制。"],
  ["Budget Policies", "预算策略"],
  ["Set spending limits and rate caps to control usage costs.", "设置支出限额和速率上限，以控制使用成本。"],
  ["Model & Provider Access", "模型与提供商访问"],
  ["4 allowed", "允许 4 个"],
  ["All allowed", "全部允许"],
  ["Prompt Injection", "提示词注入"],
  ["Detect and respond to prompt injection attempts.", "检测并响应提示词注入尝试。"],
  ["Sensitive Info Detection", "敏感信息检测"],
  ["Identify and handle PII, credentials, and personal data.", "识别并处理 PII、凭据和个人数据。"],
  ["Partial", "部分可用"],
  ["Unavailable", "不可用"],
  ["Account Settings", "账号设置"],
  ["models", "模型"],
  ["Expiration times cannot be modified. You must create a new API key to have a new expiration time.", "过期时间无法修改。你必须创建新的 API 密钥才能使用新的过期时间。"],
  ["Prevent this key from being used. You can re-enable it later.", "阻止此密钥被使用。你稍后可以重新启用它。"],
  ["Delete Key", "删除密钥"],
  ["Permanently delete this key. This action cannot be undone.", "永久删除此密钥。此操作无法撤销。"],
  ["N/A", "不适用"],
  ["Clear all", "清空全部"],
  ["Remove newkey", "移除 newkey"],
  ["View supported models", "查看支持的模型"],
  ["Add and configure your API keys. Drag a key by its handle to reorder it within a section or move it between sections.", "添加并配置你的 API 密钥。拖动密钥旁的手柄可在同一分区内重新排序，或移动到其他分区。"],
  ["Prioritized", "优先"],
  ["Attempted in order, before falling back to OpenRouter endpoints.", "会按顺序优先尝试，然后才会回退到 OpenRouter 端点。"],
  ["Add prioritized key", "添加优先密钥"],
  ["Add a prioritized key", "添加一个优先密钥"],
  ["Tried only after attempting OpenRouter endpoints, in order.", "仅会在尝试 OpenRouter 端点之后按顺序使用。"],
  ["Add fallback key", "添加回退密钥"],
  ["Add a fallback key", "添加一个回退密钥"],
  ["Alibaba BYOK | Settings | OpenRouter", "Alibaba BYOK | 设置 | OpenRouter"],
  ["Firecrawl provides web search and scraping capabilities for your OpenRouter requests. When enabled, models can search the web and extract content from URLs during inference.", "Firecrawl 为你的 OpenRouter 请求提供网页搜索和抓取能力。启用后，模型可以在推理过程中搜索网页并从 URL 提取内容。"],
  ["OpenRouter partners with Firecrawl to offer 10,000 free credits (which expire after 3 months). Accepting the Terms of Service below will create a Firecrawl account linked to your email and provision an API key automatically.", "OpenRouter 与 Firecrawl 合作提供 10,000 免费额度（3 个月后过期）。接受下方服务条款后，将自动创建一个与你邮箱绑定的 Firecrawl 账号并配置 API 密钥。"],
  ["Firecrawl offer: 10,000 free credits (expire after 3 months)", "Firecrawl 优惠：10,000 免费额度（3 个月后过期）"],
  ["I accept the", "我接受"],
  ["Firecrawl Terms of Service", "Firecrawl 服务条款"],
  ["I accept the Firecrawl Terms of Service", "我接受 Firecrawl 服务条款"],
  ["Accepting will create a Firecrawl account linked to your email address and apply the offer automatically.", "接受后将创建一个与你邮箱地址绑定的 Firecrawl 账号，并自动应用该优惠。"],
  ["These settings apply as defaults to all your API requests. Individual requests can override these settings using the", "这些设置会作为你所有 API 请求的默认值。单个请求仍可通过"],
  ["parameter, unless you enable \"Prevent overrides\" in the plugin configuration.", "参数覆盖这些设置，除非你在插件配置中启用“阻止覆盖”。"],
  ["These settings apply as defaults to all your API requests. Individual requests can override these settings using the plugins parameter, unless you enable \"Prevent overrides\" in the plugin configuration.", "这些设置会作为你所有 API 请求的默认值。单个请求仍可通过 plugins 参数覆盖这些设置，除非你在插件配置中启用“阻止覆盖”。"],
  ["View plugin documentation", "查看插件文档"],
  ["Pareto Router", "Pareto 路由器"],
  ["Set default coding quality tier for the Pareto code router", "为 Pareto 代码路由器设置默认编码质量档位"],
  ["Toggle Pareto Router", "切换 Pareto 路由器"],
  ["I/O Logging Settings", "I/O 日志设置"],
  ["Save Preset", "保存预设"],
  ["Top Coding Agents", "热门编码 Agent"],
  ["Top", "热门"],
  ["Coding Agents", "编码 Agent"],
  ["Largest public apps and agents", "最大公开应用和 Agent"],
  ["Categories", "分类"],
  ["Input Modalities", "输入模态"],
  ["The Unified Interface For LLMs", "大语言模型的统一接口"],
  ["Logo OpenRouter", "OpenRouter 徽标"],
  ["Personal Personal", "个人"],
  ["Personal 个人", "个人"],
  ["Better", "更低的"],
  ["Better prices, better uptime, no subscriptions.", "更低价格，更高可用性，无需订阅。"],
  [", better", "，更高的"],
  [", no subscriptions.", "，无需订阅。"],
  ["Get API Key", "获取 API 密钥"],
  ["Monthly Tokens", "月度 Token"],
  ["Global Users", "全球用户"],
  ["Weekly Trend", "周趋势"],
  ["Top models by task", "按任务排名的热门模型"],
  ["Image Model Rankings", "图像模型排行榜"],
  ["Introducing Workspaces!", "工作区功能上线！"],
  ["Classifiers", "分类器"],
  ["Upstream Requests", "上游请求"],
  ["Prompt Injection Allowlist", "提示词注入允许列表"],
  ["by", "由"],
  ["active models on", "个活跃模型，来自"],
  ["providers", "个提供商"],
  ["One API for Any Model", "一个 API 适配任意模型"],
  ["Access all major models through a single, unified interface. OpenAI SDK works out of the box.", "通过单一统一接口访问所有主流模型。开箱即用兼容 OpenAI SDK。"],
  ["Browse all", "浏览全部"],
  ["Higher Availability", "更高可用性"],
  ["Reliable AI models via our distributed infrastructure. Fall back to other providers when one goes down.", "通过我们的分布式基础设施稳定访问 AI 模型。当某个提供商不可用时，会自动回退到其他提供商。"],
  ["Price and Performance", "价格与性能"],
  ["Keep costs in check without sacrificing speed. OpenRouter runs at the edge for minimal latency between your users and their inference.", "在不牺牲速度的前提下控制成本。OpenRouter 在边缘运行，尽可能降低用户与推理之间的延迟。"],
  ["Custom Data Policies", "自定义数据策略"],
  ["Protect your organization with fine grained data policies. Ensure prompts only go to the models and providers you trust.", "通过细粒度数据策略保护你的组织。确保提示词只发送给你信任的模型和提供商。"],
  ["View docs", "查看文档"],
  ["Featured Models", "精选模型"],
  ["View all", "查看全部"],
  ["Featured Agents", "精选 Agent"],
  ["Signup", "注册"],
  ["Sign Up", "注册"],
  ["Create an account to get started. You can set up an org for your team later.", "创建账号即可开始使用。之后也可以再为团队创建组织。"],
  ["Buy credits", "购买额度"],
  ["Credits can be used with any model or provider.", "额度可用于任意模型或提供商。"],
  ["Get your API key", "获取你的 API 密钥"],
  ["Create an API key and start making requests.", "创建一个 API 密钥并开始发起请求。"],
  ["Fully OpenAI compatible", "完全兼容 OpenAI"],
  ["Recent Announcements", "最新公告"],
  ["$1 /M input tokens", "$1 / 百万输入 Token"],
  ["$2 /M output tokens", "$2 / 百万输出 Token"],
  ["$1 /M input Token", "$1 / 百万输入 Token"],
  ["$2 /M output Token", "$2 / 百万输出 Token"],
  ["256K context", "256K 上下文"],
  ["Server Tools", "服务器工具"],
  ["Third-party data", "第三方数据"],
  ["Leaderboard", "排行榜"],
  ["Benchmarks | OpenRouter", "基准测试 | OpenRouter"],
  ["No data in this window", "此时间段内无数据"],
  ["No prior data", "无历史数据"],
  ["Total available", "总可用余额"],
  ["Usage summary", "用量概览"],
  ["Cache hit rate", "缓存命中率"],
  ["I confirm that I am 18 years of age or older.", "我确认我已年满 18 岁。"],
  ["Usage data through Aug 31, 2026", "用量数据截至 Aug 31, 2026"],
  ["Toggle Web Search", "切换网页搜索"],
  ["Web Search docs", "网页搜索文档"],
  ["Hide Cached", "隐藏已缓存"],
  ["List view", "列表视图"],
  ["Total available credits: $0.00", "总可用余额：$0.00"],
  ["12.2T tokens", "12.2T Token"],
  ["Each task’s leading models, ranked by share of", "各任务领先模型，按"],
  ["spend", "支出"],
  ["on OpenRouter", "在 OpenRouter 上的份额排名"],
  ["Tools", "工具"],
  ["AI Site Map", "AI 网站地图"],
  ["Subscribe", "订阅"],
  ["Privacy Policy", "隐私政策"],
  ["Join the OpenRouter newsletter", "订阅 OpenRouter 新闻通讯"],
  ["by google", "由 google"],
  ["Pinned", "已固定"],
  ["Decisions", "决策"],
  ["input", "输入"],
  ["output", "输出"],
  ["Batch variant", "批处理变体"],
  ["29.9B tokens", "29.9B Token"],
  ["23.5M characters", "23.5M 个字符"],
  ["$40/M characters", "$40 / 百万字符"],
  ["$0.000031/second", "$0.000031 / 秒"],
  ["Copy: anthropic/claude-haiku-5.5", "复制：anthropic/claude-haiku-5.5"],
  ["Characters transcribed in the last 7 days", "最近 7 天转录的字符数"],
  ["Pricing: High to Low", "价格：从高到低"],
  ["Agentic: Low to High", "Agent 能力：从低到高"],
  ["Oldest", "最早"],
  ["Domain", "领域"],
  ["Author", "作者"],
  ["Change", "更改"],
  ["Share of requests", "请求份额"],
  ["Filter by domain", "按领域筛选"],
  ["Find a model to pin, 3 of 5 pinned", "查找要固定的模型，已固定 3 个，共 5 个"],
  ["1–20 of 60", "1–20 / 60"],
  ["App", "应用"],
  ["Creative Writing", "创意写作"],
  ["All benchmarks", "全部基准测试"],
  ["Most Accurate", "最准确"],
  ["Cost per question", "单题成本"],
  ["10 selected", "已选 10 个"],
  ["Answer: C", "答案：C"],
  ["About the chat playground", "关于聊天演练场"],
  ["New chat", "新建聊天"],
  ["Room settings", "聊天室设置"],
  ["0 rooms", "0 个聊天室"],
  ["Insufficient credits", "额度不足"],
  ["New fusion", "新建融合"],
  ["0 runs", "0 次运行"],
  ["Tools: 2 active", "工具：2 个已启用"],
  ["Fusion options", "融合选项"],
  ["Past", "过去"],
  ["Cost Simulator", "成本模拟器"],
  ["Visit", "访问"],
  ["Daily global rank", "全球日排名"],
  ["OpenRouter Usage", "OpenRouter 用量"],
  ["Sign In", "登录"],
  ["Sign up", "注册"],
  ["Don’t have an account?", "还没有账号？"],
  ["First name", "名字"],
  ["Show password", "显示密码"],
  ["AI Model Benchmarks | OpenRouter", "AI 模型基准测试 | OpenRouter"],
  ["Model Fusion | OpenRouter", "模型融合 | OpenRouter"],
  ["Sign In | OpenRouter", "登录 | OpenRouter"],
  ["Hermes Agent - Top Models & Usage Stats | OpenRouter", "Hermes Agent - 模型与用量排行 | OpenRouter"],
  ["Coding Agents Rankings | OpenRouter", "编码 Agent 排行榜 | OpenRouter"],
  ["GPQA Diamond Leaderboard | OpenRouter", "GPQA Diamond 排行榜 | OpenRouter"],
  ["Dashboard", "仪表盘"],
  ["Sign out", "退出登录"],
  ["Switch account", "切换账号"],
  ["Switch workspace", "切换工作区"],
  ["Theme: System", "主题：跟随系统"],
  ["Dismiss", "关闭"],
  ["New Workspace", "新建工作区"],
  ["Budget used", "已用预算"],
  ["Workspace actions", "工作区操作"],
  ["Key usage", "密钥用量"],
  ["Key limit", "密钥限额"],
  ["Key limit: 0% used of unlimited", "密钥限额：已使用 0%，上限不限"],
  ["Upload", "上传"],
  ["Up to 100 MB", "最大 100 MB"],
  ["Discard new guardrail?", "放弃新建的护栏？"],
  ["Search providers...", "搜索提供商..."],
  ["Show 63 more", "显示另外 63 个"],
  ["Excluded Model List", "排除模型列表"],
  ["Configure server tools and plugins for your workspace.", "为你的工作区配置服务器工具与插件。"],
  ["Settings for Web Search", "网页搜索设置"],
  ["Budgets & data", "预算与数据"],
  ["Webhook signing secret", "Webhook 签名密钥"],
  ["Leave workspace", "离开工作区"],
  ["(optional)", "（可选）"],
  ["vs prev period", "对比上一周期"],
  ["Move right", "向右移动"],
  ["Unknown", "未知"],
  ["Hide Laguna S 2.1", "隐藏 Laguna S 2.1"],
  ["Show only Laguna S 2.1", "只显示 Laguna S 2.1"],
  ["Usage Type", "用量类型"],
  ["Time to First Token", "首个 Token 延迟"],
  ["Finish Reason", "结束原因"],
  ["Report Feedback", "提交反馈"],
  ["Min", "最小"],
  ["Max", "最大"],
  ["Totals", "合计"],
  ["Unset", "未设置"],
  ["Disable Key", "停用密钥"],
  ["Are you sure you want to disable", "确定要停用"],
  ["? You can re-enable it later.", "吗？你稍后可以重新启用。"],
  ["16 days ago", "16 天前"],
  ["Key safety", "密钥安全"],
  ["Model price drop alert", "模型降价提醒"],
  ["Upgrade to Business", "升级到商业版"],
  ["Regional routing", "区域路由"],
  ["Anthropic endpoints that retain data will be disabled.", "将禁用保留数据的 Anthropic 端点。"],
  ["Set a spend limit on 2 keys", "为 2 个密钥设置支出限额"],
  ["Top-up platform fee", "充值平台手续费"],
  ["Top-up platform fee 5.5%.", "充值平台手续费 5.5%."],
  ["1 of 5 workspace in use. Business raises the cap to 1,000.", "1/5 个工作区使用中。商业版将上限提升至 1,000。"],
  ["Manage plan", "管理套餐"],
  ["Workload Identity Federation", "工作负载身份联邦"],
  ["Tools | Settings | OpenRouter", "工具 | 设置 | OpenRouter"],
  ["Files | Workspace | OpenRouter", "文件 | 工作区 | OpenRouter"],
  ["Workspaces | OpenRouter", "工作区 | OpenRouter"],
  ["Security | OpenRouter", "安全 | OpenRouter"],
  ["Notifications | OpenRouter", "通知 | OpenRouter"],
  ["Management Keys | OpenRouter", "管理密钥 | OpenRouter"],
  ["Search models, providers, pages, docs...", "搜索模型、提供商、页面、文档..."],
  ["Popular", "热门"],
  ["Navigate", "导航"],
  ["Search OpenRouter", "搜索 OpenRouter"],
  ["Close search", "关闭搜索"],
  ["Model suggestions", "模型推荐"],
  ["Account email", "账号邮箱"],
  ["Close navigation menu", "关闭导航菜单"],
  ["Model usage data, product updates, and research reports. One email each week.", "模型用量数据、产品更新与研究报告，每周一封邮件。"],
  ["Configure plugins and control which server tools requests may use.", "配置插件，并控制请求可以使用哪些服务器工具。"],
  ["Past 15 Minutes", "过去 15 分钟"],
  ["Past 1 Month", "过去 1 个月"],
  ["Prev Week", "上周"],
  ["This Year", "今年"],
  ["Custom range...", "自定义范围..."],
  ["Timezone", "时区"],
  ["Ranges starting over 30 days ago keep UTC calendar days; only time labels use GMT+8.", "起始时间早于 30 天的区间按 UTC 日历日计算，仅时间标签使用 GMT+8。"],
  ["Open models", "开源模型"],
  ["New & Trending", "新兴与热门"],
  ["context", "上下文"],
  ["Ask anything…", "随便问点什么…"],
  ["Workspaces let you organize API keys, guardrails, and settings.", "工作区用于组织 API 密钥、护栏和设置。"],
  ["Are you sure you want to leave", "确定要离开"],
  ["Ranking", "排行"],
  ["Endpoint", "端点"],
  ["Model details", "模型详情"],
  ["Explore more models", "探索更多模型"],
  ["Ranges starting over", "起始时间在"],
  ["days ago keep UTC calendar days; only time labels use", "天之前的区间按 UTC 日历日计算，仅时间标签使用"],
  ["Claude Sonnet 4.5 - API Pricing & Benchmarks | OpenRouter", "Claude Sonnet 4.5 - API 定价与基准测试 | OpenRouter"],
  ["1 month ago", "1 个月前"],
  ["3 weeks ago", "3 周前"],
  ["Hide Unavailable", "隐藏不可用"],
  ["Reorder Date column", "调整“日期”列顺序"],
  ["Search all models…", "搜索所有模型…"],
  ["Create a password", "创建密码"],
  ["Your password must contain 8 or more characters.", "你的密码至少需要 8 个字符。"],
  ["Use passkey instead", "改用通行密钥登录"],
  ["Verifying your request", "正在验证你的请求"],
  ["Please wait while we verify your request.", "请稍候，我们正在验证你的请求。"],
  ["Arabic", "阿拉伯语"],
  ["Recent sessions", "最近会话"],
  ["Columns", "列"],
  ["Compact", "紧凑"],
  ["Spend over time", "支出随时间变化"],
];

for (const artifact of artifacts) {
  const { translate, context, api, gmCalls } = loadTranslator(artifact.code, artifact);
  if (artifact.legacy) {
    await api.refreshDictionary(true);
    assert.equal(gmCalls.length, 0, "legacy manual refresh must not call GM APIs");
    // 本地版内置完整快照，不联网；在线版词典为空、启动时拉外置 JSON。
    assert.equal(api.getDictionaryStatus().entries, DICTIONARY_ENTRIES);
    for (const [sourceText, expected] of translationCases) {
      assert.equal(translate(sourceText), expected, `${artifact.file}: expected translation for ${sourceText}`);
    }
    for (const [sourceText, expected] of Object.entries(dictionary)) {
      assert.equal(translate(sourceText), expected, `${artifact.file}: built-in entry ${sourceText}`);
    }
  } else {
    // 在线版不内置词典：空词典下敏感文本与正则规则仍生效，词条翻译由外置词典负责。
    assert.equal(api.getDictionaryStatus().entries, 0);
  }
  for (const text of ["sk-or-v1-ce2...fe3", "isdoge@qq.com", "openai/gpt-5", "https://openrouter.ai/models", "abcdefghijklmnop1234"]) {
    assert.equal(translate(text), text, `${artifact.file}: sensitive text must stay untouched`);
  }
  for (const text of ["tokens", "Token", "37.6T tokens", "37.6T Token"]) {
    assert.match(translate(text), /\btokens?\b/i, `${artifact.file}: tokens must remain English`);
    assert.doesNotMatch(translate(text), /令牌/);
  }
  api.run();
  assert.equal(gmCalls.length, 0, "translation must not call forbidden GM APIs");
  assert.equal(context.document.documentElement.lang, "zh-CN");
  const { api: homeApi } = loadTranslator(artifact.code, { ...artifact, pathname: "/", title: "OpenRouter" });
  assert.equal(typeof homeApi.run, "function");
}


// 运行白名单：模型详情页 /<provider>/<model> 与登录注册页均需放行，内容路径需拦截
{
  const { api, context } = loadTranslator(artifacts[0].code, artifacts[0]);
  const allowedPaths = [
    "/",
    "/anthropic/claude-sonnet-4.5",
    "/openai/gpt-4o",
    "/x-ai/grok-4-fast",
    "/google/gemini-3.5-flash",
    "/models",
    "/models?category=chat",
    "/workspaces/default/activity",
    "/settings/profile",
    "/sign-in",
    "/sign-up",
    "/sign-up/protect-check",
    "/ori",
    "/discover",
    "/compare",
    "/apps/openclaw/",
  ];
  for (const pathname of allowedPaths) {
    context.location.pathname = pathname;
    assert.equal(api.isAllowedPath(), true, `expected allowed path: ${pathname}`);
  }
  const deniedPaths = [
    "/blog/some-post",
    "/docs/quickstart",
    "/legal/privacy",
    "/providers/anthropic",
    "/pricing",
    "/api/v1/models",
    "/enterprise",
  ];
  for (const pathname of deniedPaths) {
    context.location.pathname = pathname;
    assert.equal(api.isAllowedPath(), false, `expected denied path: ${pathname}`);
  }
}
console.log(`基础回归通过：${artifacts.length} 类产物，本地版 ${DICTIONARY_ENTRIES} 条内置词典，在线版外置词典，同一正则引擎，本地版无 GM 调用。`);

function loadTranslator(code, overrides = {}) {
  const timers = [];
  const gmCalls = [];
  const forbiddenGM = () => { gmCalls.push("forbidden GM call"); throw new Error("GM API must not be called in this test"); };
  const context = {
    console: { info() {}, warn() {} },
    location: {
      hostname: "openrouter.ai",
      pathname: overrides.pathname ?? "/workspaces",
    },
    history: {
      pushState() {},
      replaceState() {},
    },
    window: null,
    document: {
      title: overrides.title ?? "Guardrails | OpenRouter",
      readyState: "complete",
      body: {
        querySelectorAll() {
          return [];
        },
      },
      documentElement: {},
      createTreeWalker() {
        return {
          nextNode() {
            return null;
          },
        };
      },
      addEventListener() {},
    },
    NodeFilter: {
      SHOW_TEXT: 4,
      FILTER_REJECT: 2,
      FILTER_ACCEPT: 1,
    },
    MutationObserver: class {
      constructor() {}
      observe() {}
      disconnect() {}
    },
    requestAnimationFrame(callback) {
      callback();
    },
    GM_getValue: overrides.legacy ? forbiddenGM : (key, defaultValue) => defaultValue,
    GM_setValue: overrides.legacy ? forbiddenGM : () => {},
    GM_registerMenuCommand: overrides.legacy ? forbiddenGM : () => {},
    // 在线版启动时会拉取外置词典（离线夹具直接失败即可）；本地版不得有任何 GM 网络调用。
    GM_xmlhttpRequest: overrides.legacy ? forbiddenGM : (options) => options.onerror?.({}),
    setTimeout(callback) { timers.push(callback); return timers.length; },
    setInterval() {},
    URL,
  };
  context.window = { addEventListener() {} };
  context.globalThis = context;

  vm.runInNewContext(code, context, { filename: overrides.file ?? "openrouter-chinese.user.js", timeout: 3000 });
  // Exercise the actual scheduled startup rather than translating through run() first.
  for (const callback of timers.splice(0)) callback();

  const api = context.window.__openrouterChinese ?? context.window.__openrouterChineseRemote;
  for (const method of ["run", "translate", "refreshDictionary", "getDictionaryStatus"]) {
    assert.equal(typeof api?.[method], "function", `expected public API method ${method}`);
    if (!overrides.legacy) assert.equal(typeof context.window.__openrouterChineseRemote?.[method], "function");
    if (overrides.canonical) assert.equal(typeof context.window.__openrouterChinese?.[method], "function");
  }
  assert.equal(api.version, overrides.version);
  const status = api.getDictionaryStatus();
  assert.equal(status.version, overrides.version);
  assert.equal(status.revision, release.dictionaryRevision);
  assert.equal(typeof status.source, "string");
  assert.equal(typeof status.entries, "number");
  assert.equal(typeof status.autoUpdate, "undefined", "auto update has been removed");
  assert.equal(gmCalls.length, 0, "startup and status must not call forbidden GM APIs");
  return { translate: api.translate, context, api, gmCalls };
}
