#!/bin/sh
# PreToolUse hook on Bash: blocks `git commit` when the change touches files that
# the "Keeping docs current" map in CLAUDE.md ties to docs, unless the commit
# message carries a `Docs-Checked:` trailer saying which docs were audited.
input=$(cat)
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
cwd=$(printf '%s' "$input" | jq -r '.cwd // empty')

# Only commits; `git commit` may sit anywhere in a compound command.
printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git([[:space:]]+-C[[:space:]]+[^[:space:]]+)?[[:space:]]+commit([[:space:]]|$)' || exit 0
printf '%s' "$cmd" | grep -q 'Docs-Checked:' && exit 0

cd "${cwd:-$CLAUDE_PROJECT_DIR}" 2>/dev/null || exit 0
# The map's patterns are root-relative, and `git ls-files` prints cwd-relative paths.
root=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
cd "$root" || exit 0

# Everything that may end up in the commit: staged, unstaged and untracked,
# since `git add ... && git commit` stages only after this hook runs.
changed=$( {
  git diff --cached --name-only
  git diff --name-only
  git ls-files --others --exclude-standard
} | sort -u)

hits=$(printf '%s\n' "$changed" | grep -E \
  -e '(^|/)package\.json$' \
  -e '^pnpm-workspace\.yaml$' \
  -e '^docker-compose\.ya?ml$' \
  -e '(^|/)\.env\.example$' \
  -e '^apps/api/src/config/' \
  -e '^apps/api/prisma/(schema\.prisma|migrations/)' \
  -e '^apps/[^/]+/src/main\.ts$' \
  -e '\.module\.ts$' \
  -e '\.controller\.ts$' \
  -e '/dto/' \
  -e '\.guard\.ts$' \
  -e '(^|/)(eslint\.config\.[cm]?js|\.prettierrc[^/]*|\.prettierignore|tsconfig[^/]*\.json|vitest\.config[^/]*|nest-cli\.json|next\.config\.[^/]+|prisma[^/]*\.config\.ts)$' \
  -e '^\.claude/(settings\.json|hooks/)' \
  -e '^skills-lock\.json$' \
  -e '^\.mcp\.json$')

[ -z "$hits" ] && exit 0

reason=$(printf 'Docs check: this commit touches files that CLAUDE.md > "Keeping docs current" maps to docs:\n%s\n\nFor each file, open every doc its row names and make it match the code (add what is missing, delete what is no longer true). Then commit again with a trailer in the message listing what you checked, e.g.\n  Docs-Checked: README (endpoints, scripts), apps/api/CLAUDE.md (modules)\nor, if nothing needed changing,\n  Docs-Checked: none needed, <why>' "$(printf '%s\n' "$hits" | sed 's/^/  - /')")

jq -n --arg r "$reason" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
