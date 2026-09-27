#!/bin/sh
# PostToolUse hook: run Prettier on the file Claude just wrote or edited.
# Skips files outside the repo; .prettierignore and unknown file types are skipped by Prettier.
# A Prettier parse error exits 2, which Claude Code feeds back to Claude as feedback.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // empty')
case "$f" in
  "$CLAUDE_PROJECT_DIR"/*) ;;
  *) exit 0 ;;
esac
cd "$CLAUDE_PROJECT_DIR" && exec ./node_modules/.bin/prettier --write --ignore-unknown --log-level warn "$f"
