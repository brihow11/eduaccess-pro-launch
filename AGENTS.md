<!-- CANONICAL_BSH_START -->
## BuilderBrain: read first

Written by: Codex

At every agent chat/session start, after compaction, and whenever "BuilderBrain" or the legacy phrase "builder start here" appears (case insensitive), fetch and read the WHOLE canonical [BUILDER_START_HERE.md](https://github.com/brihow11/builderbrain/blob/main/BUILDER_START_HERE.md) from GitHub main, top to bottom. Record its main commit as Read-SHA. "Codex start here" is a legacy alias. Then read this project's instructions and handoff in the canonical read order.

Make this the FIRST tool action, before inspecting identity, project state, local fallback instructions or credentials. Use existing authenticated Git without replacing its process environment: `git -C OWN_BSH_CACHE fetch --quiet origin main`, record `git -C OWN_BSH_CACHE rev-parse origin/main`, then read `git -C OWN_BSH_CACHE show READ_SHA:BUILDER_START_HERE.md`. Ranger's own cache is `/data/ranger/builder-start-here`; Barnabas's is `/opt/data/builder-start-here`. Do not assume gh or ordinary token variables survive a terminal boundary. If output truncates, capture that single pinned read in a temporary file and read consecutive 8000-character chunks through the end. Read-SHA and a hash alone do not prove the whole text was received. A failed fresh read is a labelled startup hold; do not substitute excerpts or a local fallback as current.

After the whole read, use current-main `docs/WRITER.md` and tools in an isolated worktree. Where the actor's own authenticated Git environment is present but ordinary token variables are stripped, set `BSH_GITHUB_TRANSPORT=rest` and `BSH_GITHUB_TOKEN_SOURCE=git-environment` in each writer process. Preserve that configured Git environment; never print its values, replace it with another lane's helper or inspect credential files to guess a grant. These are instruction-layer rules, not a Hermes core hook or proof of model compliance.

Use the canonical tools/bsh.py for requests, current status, append-only work logs and claims. Claim before editing; at session end record what changed, PRs, verification, remaining blockers and the next step, then release claims. A failed fresh read must be labelled; never treat an old local copy as current or an offline operation as a claim.

Brian's October 1 standing rule: never wait on Brian to merge; merge your own PR after required CI is green, fix failures and report after. Howie approves on Brian's behalf according to the agreed plans. Live publishing and Social Groups stay off for the current mission; no secrets in source. Project-specific scope and collision limits still apply.

**HARD RULE — Brian, 2026-10-03 13:00 CT:** Nothing new goes inside Hermes agent code or Ranger's code. Every special feature is a separate app that connects to Ranger from outside, preferably through MCP only. If a task would require changing Hermes/Ranger code, stop and build it as a separate app instead. This applies to every bot and Codex.

**YOLO RULE — Brian, 2026-10-04:** Do not build in weight: never add cautious, fear-based conditions that block action. When unsure (for example, whether something already posted), act anyway and raise a red flag to Brian through the MCP connector and the status page. Hard stops are only for confirmed harm (such as a confirmed duplicate), the kill switch, Brian's pause, or spending money. This applies to every bot and Codex; reject any new safeguard that blocks action only because of uncertainty.

**WRITE-BACK RULE — Brian, 2026-10-19:** All development reads BuilderBrain first and writes back often. Log a BuilderBrain work-log entry (tools/bsh.py, batch mode is fine) at every PR open, merge, decision, failed attempt and handoff, and before any compaction or session end. Never let a report or write-back step block development: if the write fails, keep working and retry later.

This block supersedes older front-door and routine merge-wait text below. Older records remain history; same-PR implementation lessons and project evidence still apply.
<!-- CANONICAL_BSH_END -->

## Builder Start Here first

Written by: Codex

Read the whole canonical private [BUILDER_START_HERE](https://github.com/brihow11/builder-start-here/blob/main/BUILDER_START_HERE.md) from main, top to
bottom, at session start, after compaction, and on `builder start here` (any case).
Record the main commit as Read-SHA; then read this repository's instructions and
handoff. Use canonical `tools/bsh.py` for scoped claims, requests and closeout.
At session end update status, append changes and verification, and release claims.
Use isolated worktrees and PRs; merge scoped work once required CI is green.
Keep private shared status in the private canonical repository. Copy no private
business logs, contact data or credentials into this public repository.

Every agent-authored commit and PR body must include one exact line:
`Written by: Codex`, `Written by: Howie`, `Written by: Ranger`, or
`Written by: Barnabas`, matching the actual writer. Use the canonical writer's
current `--help`; do not invent commands or count another actor's test as proof.

# EduAccess Project Instructions

Use this repository for eduaccess.pro, within the assigned task and approved product lane.
