#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
case "${1:-}" in ""|--offline) ;; *) echo "Usage: scripts/init-project.sh [--offline]" >&2; exit 1;; esac
if [ ! -f project/project-plan.md ]; then cp project/project-plan.md.template project/project-plan.md; fi
if [ "${1:-}" != --offline ]; then
  npm ci --ignore-scripts
  bash scripts/install-skills.sh
fi
printf '%s\n' 'Start here: EM fills project/project-plan.md. See docs/workflow.md.'
