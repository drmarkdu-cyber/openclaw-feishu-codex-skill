#!/usr/bin/env bash
set -euo pipefail

repo_url="${1:-${OPENCLAW_CODEX_SKILL_REPO:-}}"
tmp_dir=""

cleanup() {
  if [ -n "$tmp_dir" ] && [ -d "$tmp_dir" ]; then
    rm -rf "$tmp_dir"
  fi
}
trap cleanup EXIT

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source_dir="$script_dir"

if [ ! -f "$source_dir/skills/codex/SKILL.md" ]; then
  if [ -z "$repo_url" ]; then
    echo "ERROR: Run from the repository root, or pass a GitHub repo URL:" >&2
    echo "  bash install.sh https://github.com/OWNER/REPO.git" >&2
    exit 64
  fi
  tmp_dir="$(mktemp -d)"
  git clone --depth 1 "$repo_url" "$tmp_dir/repo"
  source_dir="$tmp_dir/repo"
fi

if [ ! -f "$source_dir/skills/codex/SKILL.md" ]; then
  echo "ERROR: skills/codex/SKILL.md not found in $source_dir" >&2
  exit 66
fi

openclaw_home="${OPENCLAW_HOME:-$HOME/.openclaw}"
workspace="${OPENCLAW_WORKSPACE:-$openclaw_home/workspace}"
skill_dir="$workspace/skills/codex"
config_file="${CODEX_RUNNER_CONFIG:-$openclaw_home/codex-runner.env}"
default_codex_workspace="${CODEX_RUNNER_WORKSPACE:-$HOME/Documents/Codex/codex-work}"
default_output_dir="${CODEX_RUNNER_DEFAULT_OUTPUT_DIR:-$default_codex_workspace/tmp_codex}"

mkdir -p "$workspace/skills" "$openclaw_home/codex-runs" "$default_codex_workspace" "$default_output_dir"
rm -rf "$skill_dir"
cp -R "$source_dir/skills/codex" "$skill_dir"
chmod +x "$skill_dir/scripts/codex-runner.mjs"

if [ ! -f "$config_file" ]; then
  cat > "$config_file" <<EOF
# Default project directory for Feishu/OpenClaw /codex tasks.
CODEX_RUNNER_WORKSPACE=$default_codex_workspace
CODEX_RUNNER_DEFAULT_OUTPUT_DIR=$default_output_dir

# Codex safety/runtime defaults.
CODEX_RUNNER_SANDBOX=workspace-write
CODEX_RUNNER_TIMEOUT_SECONDS=900
CODEX_RUNNER_SEARCH=false
CODEX_RUNNER_PROXY=

# Optional: pin a Codex model. Leave empty to use your Codex default.
CODEX_RUNNER_MODEL=
EOF
else
  if ! grep -q '^CODEX_RUNNER_WORKSPACE=' "$config_file"; then
    printf '\nCODEX_RUNNER_WORKSPACE=%s\n' "$default_codex_workspace" >> "$config_file"
  fi
  if ! grep -q '^CODEX_RUNNER_DEFAULT_OUTPUT_DIR=' "$config_file"; then
    printf 'CODEX_RUNNER_DEFAULT_OUTPUT_DIR=%s\n' "$default_output_dir" >> "$config_file"
  fi
  if ! grep -q '^CODEX_RUNNER_PROXY=' "$config_file"; then
    printf 'CODEX_RUNNER_PROXY=\n' >> "$config_file"
  fi
fi

cat > "$default_codex_workspace/README.md" <<'EOF'
# Codex Workbench

Default workspace for Feishu `/codex` tasks routed through OpenClaw.

Use it for temporary tasks, coding experiments, generated outputs, and safe scratch work.
EOF

echo "Installed OpenClaw /codex skill."
echo "Skill: $skill_dir"
echo "Config: $config_file"
echo "Default workspace: $default_codex_workspace"
echo "Default output dir: $default_output_dir"
echo
echo "Test in Feishu/OpenClaw:"
echo '  /codex 请只回复：OpenClaw 已成功调用 Codex'
