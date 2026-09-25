#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
id="${1:-}"
if [[ ! "$id" =~ ^EPIC-[0-9]{3,}$ ]]; then echo 'Usage: scripts/new-epic.sh EPIC-001' >&2; exit 1; fi
if [ -e "epics/$id" ]; then echo 'Epic already exists' >&2; exit 1; fi
# A markdown skill is not executable: load its method, then execute its git fallback.
skill=skills/upstream/superpowers/skills/using-git-worktrees/SKILL.md
if [ ! -f "$skill" ]; then echo 'Run scripts/install-skills.sh first' >&2; exit 1; fi
cat "$skill"
node scripts/check-project.mjs
if [ -n "$(git status --porcelain --untracked-files=normal)" ]; then echo 'Commit the approved project plan and scaffold before creating an epic' >&2; exit 1; fi
if [ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ]; then echo 'Run from the coordination checkout, not another epic worktree' >&2; exit 1; fi
git check-ignore -q .worktrees/probe || { echo '.worktrees must be ignored' >&2; exit 1; }
git worktree add ".worktrees/$id" -b "epic/$id"
(
 cd ".worktrees/$id"
 node scripts/install-native-lock.mjs
 npm test
 mkdir -p "epics/$id/tasks"
 sed "s/EPIC-XXX/$id/g" epics/EPIC-XXX/epic.md.template > "epics/$id/epic.md"
 sed "s/EPIC-XXX/$id/g" epics/EPIC-XXX/epic-plan.md.template > "epics/$id/epic-plan.md"
 sed 's/TASK-XXX/TASK-001/g' epics/EPIC-XXX/tasks/TASK-XXX.md.template > "epics/$id/tasks/TASK-001.md"
)
printf '%s\n' "Worktree .worktrees/$id ready for epic triage. Run scripts/install-skills.sh there before agent work. Implementation remains gated."
