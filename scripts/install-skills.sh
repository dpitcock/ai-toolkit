#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in ""|--update) ;; *) echo 'Usage: scripts/install-skills.sh [--update]' >&2; exit 1;; esac
mkdir -p skills/upstream
for repo in superpowers agent-skills; do
  if [ "$repo" = superpowers ]; then owner=obra; else owner=addyosmani; fi
  dest="skills/upstream/$repo"
  if [ ! -d "$dest/.git" ]; then git clone "https://github.com/$owner/$repo.git" "$dest"; fi
  if [ -n "$(git -C "$dest" status --porcelain)" ]; then echo "Refusing to replace edits in $dest" >&2; exit 1; fi
  if [ "${1:-}" = --update ]; then
    git -C "$dest" fetch origin main
    git -C "$dest" checkout --detach origin/main
  elif [ -f "skills/$repo.ref" ]; then
    ref="$(cat "skills/$repo.ref")"
    git -C "$dest" cat-file -e "$ref^{commit}" 2>/dev/null || git -C "$dest" fetch origin "$ref"
    git -C "$dest" checkout --detach "$ref"
  fi
  git -C "$dest" rev-parse HEAD > "skills/$repo.ref"
done
# Use upstream's multi-agent installer; keep the checkout for shared references/personas.
npx --yes skills add ./skills/upstream/agent-skills --agent codex claude-code cline --skill interview-me idea-refine planning-and-task-breakdown constraint-driven-development incremental-implementation code-review-and-quality security-and-hardening git-workflow-and-versioning shipping-and-launch --yes
node scripts/link-skills.mjs
printf '%s\n' 'Local skills ready. Complete native Superpowers installation for Claude/Codex: docs/installation.md. Commit skills/*.ref after review.'
