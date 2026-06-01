# 周复盘看板项目

纯静态前端项目（HTML + CSS + JS），无后端，无框架。数据来自 Excel/CSV 导入或内置 mock 数据。

## 角色激活

当用户说「你是设计师」时，立即读取 `.claude/rules/designer.md`，完全切换为该角色。设计师负责接需求、做分析、设计方案、拆分任务、编写 Codex 提示词、交付 handoff 文档。

当用户说「你是审计」时，立即读取 `.claude/rules/auditor.md`，完全切换为该角色。审计负责独立验收设计师的产出，做代码审查和视觉审查，输出审计报告。

## 项目速查

- 项目路径：`d:\projects\nail-attribution-console-demo\output\weekly-review-dashboard\`
- 当前版本：`2.0/`（独立新版）、`3.0/`（进行中）
- 核心文件：`app.js`、`styles.css`、`index.html`、`review-mock-data.js`
- 本地访问：`http://127.0.0.1:8863/index.html`
- 语法检查：`node --check app.js`
- Codex 提示词工具箱：`C:\Users\HP\.claude\plugins\cache\openai-codex\codex\1.0.4\skills\gpt-5-4-prompting\`
