# Eduaccess Builder handoff

Written by: Codex

Read [BUILDER_START_HERE](https://github.com/brihow11/builder-start-here/blob/main/BUILDER_START_HERE.md) in full from main first, at every session start,
after compaction, and on `builder start here` (any case). Record Read-SHA. Then
read `AGENTS.md` and local product documentation. Canonical section:
`S-EDUACCESS`. Use canonical `tools/bsh.py` and its current CLI help.

## Current source wiring

This public repository contains a generic pointer to private canonical BSH;
no private BSH status, business logs, credentials or contact data is copied here.
AGENTS and Builder files were absent on prior main; this PR creates their startup
wiring and attribution check. No app route/content or hosting configuration is
changed, and no manual deployment is performed.

## Verification and next execution

- Startup/compaction/phrase rules, claims, append-only requests and end-of-session
  status/log/release duties are in `AGENTS.md`.
- `docs/BUILDER_START_HERE.md` points to the sole shared front door; any older
  body is retained unchanged as history.
- `.github/workflows/written-by.yml` checks the PR body and every PR commit for
  exact Codex/Howie/Ranger/Barnabas attribution. Required-check settings must
  include `Written-by attribution` for branch-policy enforcement.
- Read canonical current status before further product work. Record merged PRs
  and checks in canonical BSH; release this wiring claim after the merge receipt.
  Shared writer access is only proven by an actual read and merged write from
  the actor's own authenticated path.
