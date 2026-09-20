# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## 项目概览

百度贴吧自动签到 —— 一个基于 TypeScript 的命令行脚本，仅凭 `BDUSS` Cookie 即可为用户名下所有已关注的贴吧自动签到。项目没有服务端、没有测试框架，是由 GitHub Actions 驱动的定时任务。运行时目标为 Node 16（`commonjs`、`target: es2016`），唯一运行时依赖为 `axios`。

## 常用命令

`npm ci`：按 lockfile 安装精确版本依赖，CI 使用的方式；本地开发用 `npm install` 亦可。

`npm run build`：用 `tsc` 将 `src/**/*.ts` 编译到 `dist/`。编译成功前，`dist/` 下的任何内容都无法正确运行，因为生产环境执行的就是编译产物。

`npm run dev`：通过 `ts-node` 直接运行 `src/index.ts`，跳过构建，适合边改边调试。

`npm run start`：先构建再运行 `dist/index.js`，即真实调用线上接口的签到流程。

`npm test`：先构建再运行 `dist/local-test.js`，它会先加载本地 `.env`（可从 `.env.example` 复制并填入 `BDUSS`），再以更小的批量参数调用同一主流程。

本项目没有独立的测试运行器、linter，也没有单测命令；`npm test` 只是一次本地冒烟运行，并非单元测试套件。

## 环境变量

`BDUSS` 是唯一必填变量（百度登录 Cookie）。可调参数：`BATCH_SIZE`（默认 20）、`BATCH_INTERVAL` 毫秒（默认 1000）、`MAX_RETRIES`（默认 3）、`RETRY_INTERVAL` 毫秒（默认 5000）、`ENABLE_NOTIFY`（默认 false）。通知渠道按对应 key 是否配置而启用：`SERVERCHAN_KEY`、`BARK_KEY`、`TG_BOT_TOKEN` + `TG_CHAT_ID`、`DINGTALK_WEBHOOK`（可选 `DINGTALK_SECRET`）、`WECOM_KEY`、`PUSHPLUS_TOKEN`，可同时配置多个渠道。`.env` 已被 gitignore；CI 中这些值来自 GitHub Secrets。

## 架构

### 数据 / 控制流

全部流程由 `src/index.ts` 中一个立即执行的异步函数统一编排，顺序为：读取并校验 `BDUSS` → `login()`（校验 Cookie 并取回用户 id）→ `getTiebaList()`（获取已关注的贴吧）→ `getTbs()`（签到令牌）→ 把贴吧列表分块并发签到、块间等待 → 对失败项重试 → `summarizeResults()` / `formatSummary()` → 按条件 `sendNotification()`。任何抛出的错误都会被顶层捕获，择机通知，并以退出码 1 结束；`finally` 块始终打印总执行耗时。

### 模块职责

- `src/apiService.ts` —— 与 `tieba.baidu.com` 的全部 HTTP 交互（`login`、`getTiebaList`、`getTbs`、`signTieba`）。每个请求都包在私有的 `withRetry` 辅助函数里；它是唯一了解百度 URL、请求头与 Cookie 处理的模块。
- `src/dataProcessor.ts` —— 纯函数模块，把原始接口返回整理为统一结果。`processSignResult` 是「百度错误码 → `{ success, message }`」映射的唯一真源；`summarizeResults` / `formatSummary` 负责聚合成报告文本。
- `src/notify.ts` —— `sendNotification(summary)` 根据已配置的渠道分发报告，每个渠道由各自的 `send*` 函数实现；返回是否至少有一个渠道发送成功。
- `src/utils.ts` —— 无状态工具函数：查询串构造、设备 id 生成、带时区的日期格式化、`maskTiebaName`（在日志中对贴吧名脱敏）。
- `src/types/*.ts` —— 按模块拆分的类型定义（`apiService`、`dataProcessor`、`notify`、`utils`），经 `src/types/index.ts` 统一导出。
- `src/local-test.ts` —— 极薄的封装：加载 dotenv，在未设置时填入小批量默认值，随后导入 `./index`。

### `dist/` 契约

`dist/` 被有意纳入版本控制（见 `.gitignore` 中的注释），而非被忽略。任何推送到 `main` 且触及 `src/**`、`tsconfig.json` 或 `package.json` 的提交，都会触发 `.github/workflows/build.yml` 执行 `npm ci && npm run build`，随后强制 `git add` `dist/` 并以 `github-actions[bot]` 身份回提交。签到工作流从不构建，而是直接运行已提交的 `node dist/index.js`。因此：务必只改 `src/` 并重新构建，让已提交的 `dist/` 保持同步；手动改 `dist/` 会被 CI 覆盖。

### 双层重试

重试在两个互相独立的层级上存在，这点很容易混淆：

1. **传输层**（`apiService.ts` 内的 `withRetry`）：固定倍数的指数退避且有明确上限，作用于每一次单独的 HTTP 调用；遇到 4xx 会提前放弃，但 429（限流）例外，会使用翻倍延迟。
2. **应用层**（`index.ts` 中的重试循环）：每个批次结束后，仍失败的贴吧会最多重试 `MAX_RETRIES` 次，间隔为 `RETRY_INTERVAL`。若后续某次成功，会把先前写入 `signResults` 的失败记录 splice 掉，以保证最终汇总正确。

### 错误码映射

`processSignResult` 将 `no === 0` 视为真正签到成功，`no === 1101` 视为「已签到」（与新增签到分开计数），并对特定错误码（`2150040` 需要验证码、`1011` 未加入该吧/等级不够、`1102` 签到过快、`1010` 目录出错）判定为失败。其余情况归入通用失败，并把原始错误码保留在 `info` 中。

### 通知策略

通知刻意保持克制：成功场景下，仅当 `ENABLE_NOTIFY=true` **且**至少有一个贴吧签到失败时才发送。在顶层 catch 中，BDUSS/登录类错误会强制触发通知，即使 `ENABLE_NOTIFY` 为 false，以保证 Cookie 失效绝不会悄无声息。

## 注意事项

- 注意区分「已签到」（`1101`）与一次新的成功签到 —— 计数与汇总对二者分别处理。
- `js-backup/` 存放旧版纯 JavaScript 实现，已在 `tsconfig.json` 中排除，仅供参照，运行时不使用。
- 工作流的 cron 表达式使用 UTC，而日志同时打印 UTC 与 `Asia/Shanghai` 时间；修改定时时请留意。
- `keep-alive.yml` 每月更新一次 `.github/last_activity.md`；`sync-upstream.yml` 仅在 fork 仓库中运行（受 `github.repository != 'chiupam/tieba'` 保护），在上游仓库中不生效。
