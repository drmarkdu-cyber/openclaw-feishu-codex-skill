---
name: codex
description: Feishu/OpenClaw shortcut for running local OpenAI Codex CLI tasks. Use when the user invokes "/codex ..." from Feishu/OpenClaw to delegate a task to local Codex and return the result to the chat.
user-invocable: true
disable-model-invocation: true
metadata:
  openclaw:
    os: ["darwin", "linux"]
    requires:
      bins: ["codex", "node"]
---

# Codex Bridge

When the user invokes `/codex ...`, run the bundled wrapper exactly once:

```bash
printf '%s' "<user task>" | node "$HOME/.openclaw/workspace/skills/codex/scripts/codex-runner.mjs"
```

Then return the wrapper output to the user.

Rules:

- Do not run `codex` or `codex exec` directly. The wrapper handles Codex version differences, workspace config, logs, and output formatting.
- Do not call the wrapper more than once for one user request unless the user explicitly asks to retry.
- Treat the user task as plain text input to the wrapper, not as a shell command.
- Return the wrapper output as-is. Do not add your own diagnosis about Codex sandbox limits unless the wrapper explicitly reports a sandbox failure.
- If the wrapper reports failure, return its error summary and log path.
- The default project directory is configured in `$HOME/.openclaw/codex-runner.env`.
- If the user asks Codex to create a quick script or temporary output without naming a folder, the wrapper directs Codex to use `$CODEX_RUNNER_WORKSPACE/tmp_codex`.
