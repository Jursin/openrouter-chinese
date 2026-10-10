<!-- badges -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-√-green.svg)](https://www.tampermonkey.net/)

# OpenRouter 中文化插件

在浏览器端将 OpenRouter 首页、工作区、排行榜、模型、聊天和账号设置等页面的常见界面文案翻译为简体中文。

[安装在线版](https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/dist/openrouter-chinese.user.js)
｜
[安装本地版](https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/legacy/openrouter-chinese.user.js)
｜
[问题反馈](https://github.com/isdoge/openrouter-chinese/issues)

> **本地版（纯内置词典快照）预计 2026 年 10 月底移除**，之后只保留在线版。在线版与本地版二选一安装，不要同时启用。

## 安装

### 1. 安装 Tampermonkey

- Chrome / Edge：[Chrome Web Store](https://chromewebstore.google.com/search/tampermonkey)
- 官网：[tampermonkey.net](https://www.tampermonkey.net/)

### 2. 二选一安装

| | 在线版 | 本地版 |
| --- | --- | --- |
| **安装入口** | [main 更新链](https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/dist/openrouter-chinese.user.js) | [main 本地版](https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/legacy/openrouter-chinese.user.js) |
| **词典** | 不内置，启动时从 GitHub（jsDelivr 镜像兜底）拉取外置词典并缓存 | 内置完整词典快照，不联网 |
| **词典更新** | 手动：脚本菜单「立即更新中文词典」；每次启动也会拉取一次 | 无（更新词典需升级脚本） |
| **版本号** | 数字（如 1.0.1），只在脚本源码变化时递增 | 词典日期（如 26.10.10），表示词库截至时间 |
| **适合** | 希望持续拿到词典补充的大多数用户 | 无法稳定访问 GitHub、或想完全离线运行的用户 |
| **状态** | 长期维护 | **预计 2026 年 10 月底移除** |

在线版脚本很小（词典外置）；首次安装如遇 GitHub 不可达，页面保持英文，联网后自动或手动更新即可。`Token` / `tokens` 保持英文，不翻译为"令牌"。

### 3. 刷新 OpenRouter 页面

打开或刷新 `https://openrouter.ai/` 下的目标页面即可使用。

## 脚本菜单（在线版）

- **立即更新中文词典**：手动拉取最新词典。
- **查看词典状态**：显示脚本版本、词典版本（日期式 revision）、来源与条数。

## 功能

- 翻译首页、工作区、排行榜、模型、聊天、Fusion、Labs、Apps、Discover、Compare、Ori 等页面的常见文案，覆盖按钮、表格、输入框占位、下拉菜单、提示浮层和模态框。
- 兼容 React 动态渲染：路由切换、弹层打开和异步内容加载后自动重翻译，避免误翻模型 ID、URL、邮箱和 API Key 等内容。
- 词典只做静态 JSON 请求，多来源回退（raw → jsDelivr → 版本标签快照），失败不影响已加载词典。

## 安全与边界

- 不是 OpenRouter 官方项目，也不是浏览器扩展商店插件；需要 Tampermonkey 等用户脚本管理器。
- 仅处理页面显示文案，词典更新只下载静态 JSON；**不调用 OpenRouter API，不读取 cookie，不收集或上传 API Key、token、账号信息或页面内容，不修改账号真实数据**。
- JSON 只作为词典数据解析，不执行其中的代码。
- 网站文案与结构变化后可能仍有英文残留，欢迎反馈。

## 截图

| 首页 | 工作区 |
| --- | --- |
| <img src="docs/home.webp" alt="OpenRouter 首页" width="100%"> | <img src="docs/workspaces.webp" alt="OpenRouter 工作区" width="100%"> |

| 设置 | 模型 |
| --- | --- |
| <img src="docs/settings.webp" alt="OpenRouter 设置" width="100%"> | <img src="docs/models.webp" alt="OpenRouter 模型页" width="100%"> |

| 应用 | 排行榜 |
| --- | --- |
| <img src="docs/apps.webp" alt="OpenRouter 应用页" width="100%"> | <img src="docs/rankings.webp" alt="OpenRouter 排行榜" width="100%"> |

## 目录

```text
├── src/
│   └── openrouter-chinese.user.js            # 唯一共享引擎模板
├── locales/
│   ├── zh-CN.json                            # 唯一源词典：plain object
│   └── zh-CN.online.json                     # 构建生成的在线 envelope
├── release.config.json                       # revision / 词典指纹
├── scripts/
│   ├── build.mjs                             # 生成所有脚本与在线词典
│   └── check.mjs                             # 仓库校验入口
├── dist/
│   └── openrouter-chinese.user.js            # 在线版安装产物（词典外置）
├── legacy/
│   ├── openrouter-chinese.user.js            # 本地版安装产物（内置词典，预计 10 月底移除）
│   ├── archive/                             # 历史存档
│   └── README.md
├── docs/
│   └── DICTIONARY.md                        # 词典格式与维护说明
├── LICENSE
└── package.json                             # 在线版版本号
```

`legacy/archive/` 只用于历史保留，不是推荐安装入口。生成产物不要手工维护。

## 开发与贡献

```sh
npm run dictionary:bump  # 仅词典实际变化时显式运行：递增 revision（本地版日期版本随之更新）
npm run build            # 生成在线版、本地版及在线词典
npm test                 # 执行仓库校验
```

词典未变化时跳过 `dictionary:bump`；`build` 本身不改版本或 revision，词典变化却未迭代配置时应报错。

欢迎提 Issue 或 PR。补翻译建议按以下顺序：

1. 确认英文残留的页面位置与文案；反馈中不要包含账号信息、余额、API Key、cookie 或 token。
2. 在 **`locales/zh-CN.json`** 中补充或修正词条，不再把词典写进 `src/`；运行时行为修改才进入唯一引擎模板。
3. 修改词典后显式运行 `npm run dictionary:bump`，递增 `dictionaryRevision` 并更新 `dictionarySha256`，按[词典文档](docs/DICTIONARY.md#词典维护流程)重新构建与校验。
4. 核对生成产物一致，再提交不含私密信息的 PR。真实浏览器验收报告不得进入公开仓库、PR 或 Release。

## 许可

[MIT](LICENSE)

## 致谢

本项目由 [Codex](https://github.com/openai/codex) 辅助完成翻译词典编写、运行时逻辑和构建脚本。
