# 本地版与历史归档

本地版是**纯内置词典**的离线安装：内置完整词典快照，不拉取在线词典，适合无法稳定访问 GitHub 或想完全离线运行的用户。新用户请先阅读[主 README](../README.md#安装)。

> **本地版预计 2026 年 10 月底移除**，之后只保留在线版。在线版与本地版二选一安装，不要同时启用。

## 当前本地版

- 生成文件：`legacy/openrouter-chinese.user.js`。
- 版本号：**词典日期**（如 `26.10.10`），由词典 revision `2026101002` 派生，表示词库截至时间。
- 内置与在线版同源的完整 1957 条词典；没有在线词典也能完成翻译。
- 使用 `@grant none`，翻译运行时不请求在线词典，不提供立即更新、状态查看或 JSON 导入等词典更新管理菜单。
- 更新词典的唯一方式是安装按新日期版本构建的本地版脚本。

## 安装与切换

本地版安装入口（随 `main` 更新）：

```text
https://raw.githubusercontent.com/isdoge/openrouter-chinese/main/legacy/openrouter-chinese.user.js
```

与在线版二选一：

1. 切换前先停用当前脚本，核对管理器中的脚本身份及安装提示。
2. 安装所选入口，刷新页面确认翻译。
3. 如果管理器允许多个入口并存，**只启用一份**，不要让在线版与本地版同时处理页面。

两者缓存身份独立，不承诺自动共享词典缓存。

## 维护规则

`legacy/openrouter-chinese.user.js` 是生成产物，不应手工改词典或维护第二份引擎。

- 唯一共享引擎模板：`src/openrouter-chinese.user.js`。
- 唯一源词典：`locales/zh-CN.json`，plain object。
- 每次词典实际修改后，显式运行 `npm run dictionary:bump`：增加 `dictionaryRevision` 并更新 `dictionarySha256`，本地版日期版本随之从 revision 派生。
- 脚本功能／引擎变更维护 `package.json.version`（在线版版本号），本地版不使用该数字版本。
- 再运行 `npm run build` 统一生成，执行 `npm test` 核对；`build` 不自动改版本／revision，词典变化但未 bump 时应报错。

详细格式、缓存规则与词典迭代流程见 [DICTIONARY.md](../docs/DICTIONARY.md)。

## 历史存档

`legacy/archive/` 用于冻结原本地版 `0.1.10` 和旧在线 `beta.5` 的历史文件：

```text
archive/
├── src/        # 旧源码
├── dist/       # 旧生成产物
├── docs/       # 旧词典预览说明等非私密历史文档
└── scripts/    # 旧浏览器脚本等历史工具
```

旧预览说明只供了解历史方案，不作为当前接口合同。上述归档目录不是继续维护的备用安装入口。

这些历史文件不是当前安装推荐。本轮先保留，后续是否清理另行决定，不在本次变更中删除。公开归档也不得包含真实浏览器验收报告、账号信息或秘密。
