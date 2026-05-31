# OpenClaw Feishu Codex Skill

让飞书里的 OpenClaw 调用本机 OpenAI Codex CLI：

```text
飞书 -> OpenClaw -> /codex -> 本机 Codex CLI -> OpenClaw -> 飞书
```
尽管 Codex 已经推出手机端，用户可以直接在手机上使用 Codex 执行命令，但仍有一部分用户会受到手机网络环境或设备兼容性的影响，例如部分华为手机无法顺畅使用 Codex 客户端。也有一些用户希望把 OpenClaw 作为统一的输入和输出入口。基于这些需求，我开发了这个 skill，让大家可以通过飞书里的 OpenClaw 间接调用本机 Codex，更方便地完成任务。

适合已经完成「飞书 <-> OpenClaw」连接的人，把 Codex 当作 OpenClaw 的本机执行工具使用。

## 前提

- OpenClaw 已经安装，并且飞书端已经能正常和 OpenClaw 对话。
- 本机已安装并登录 `codex` CLI。
- 本机有 Node.js。

检查：

```bash
openclaw --version
codex --version
node --version
```

## 安装方式 A：在本机安装

```bash
git clone https://github.com/drmarkdu-cyber/openclaw-feishu-codex-skill.git
cd openclaw-feishu-codex-skill
bash install.sh
```

## 安装方式 B：把 GitHub 链接发给飞书里的 OpenClaw

把下面这段发给已经连好飞书的 OpenClaw：

```text
请帮我安装这个 OpenClaw skill：
https://github.com/drmarkdu-cyber/openclaw-feishu-codex-skill.git

安装方式：
1. 克隆这个仓库到临时目录
2. 在仓库根目录运行 bash install.sh
3. 安装完成后运行 openclaw skills info codex 检查
4. 告诉我是否能使用 /codex
```

如果你的 OpenClaw 支持执行本机命令，它会把 skill 安装到：

```text
~/.openclaw/workspace/skills/codex
```

## 使用

在飞书里发：

```text
/codex 请检查默认工作台里有哪些文件，并给我一个建议
```

或者：

```text
/codex 帮我写一个 Python 脚本，把 CSV 转成 Excel
```

Codex 的最终结果会回到飞书。完整日志保存在：

```text
~/.openclaw/codex-runs/
```

## 默认工作目录

安装脚本会创建：

```text
~/Documents/Codex/codex-work
```

并写入配置：

```text
~/.openclaw/codex-runner.env
```

默认配置：

```bash
CODEX_RUNNER_WORKSPACE=$HOME/Documents/Codex/codex-work
CODEX_RUNNER_SANDBOX=workspace-write
CODEX_RUNNER_TIMEOUT_SECONDS=900
CODEX_RUNNER_SEARCH=false
CODEX_RUNNER_MODEL=
```

如果你想让 `/codex` 默认操作某个项目，改这一行：

```bash
CODEX_RUNNER_WORKSPACE=/path/to/your/project
```

## 验证

本机检查：

```bash
node ~/.openclaw/workspace/skills/codex/scripts/codex-runner.mjs --print-config
openclaw skills info codex
```

飞书检查：

```text
/codex 请只回复：OpenClaw 已成功调用 Codex
```

## 安全建议

- 默认使用 `workspace-write`，不要一开始就给 Codex 全盘权限。
- 默认工作目录建议是干净工作台，不要直接指向 `~/.openclaw/workspace` 这种包含长期记忆、个人资料和多个子项目的目录。
- 不要把 `.env`、API key、飞书 app secret 放进 Codex 默认工作目录。
- 群聊里使用时，建议 OpenClaw 侧已经设置好允许名单或配对策略。
