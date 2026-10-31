---
name: factory
description: Run the software factory. Takes a feature through spec, build, four reviews, and a decision, then merges to dev or stops for a human.
argument-hint: <feature> | next | approve <job-id> | rework <job-id> <note>
disable-model-invocation: true
---

# Factory

This session is the orchestrator. Run the loop, spawn every agent, and be the only writer of `factory/board.json`. Do not write specs, code, reviews, or decisions yourself.

Arguments: `$ARGUMENTS`

## The loop (edit this to change the factory)

```
                   ┌──────────────────┐
                   │     feature      │
                   └─────────┬────────┘
                             ▼
                   ┌──────────────────┐
                   │   spec-writer    │
                   │       opus       │
                   └─────────┬────────┘
                             ▼
                   ┌──────────────────┐
                   │     builder      │◄─────────────────────┐
                   │       opus       │                      │
                   └─────────┬────────┘                      │
        ┌─────────────┬──────┴──────┬─────────────┐          │
        ▼             ▼             ▼             ▼          │
  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
  │  security │ │     ux    │ │ ui design │ │    code   │    │
  │    opus   │ │   sonnet  │ │   sonnet  │ │   sonnet  │    │
  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘    │
        └─────────────┴──────┬──────┴─────────────┘          │
                             ▼                               │
                       WAIT FOR ALL ─────── any CHANGES ─────┘
                             │ all PASS
                             ▼
                   ┌──────────────────┐
                   │     decider      │
                   │       opus       │
                   └─┬───────────────┬┘
             APPROVE │               │ ESCALATE
                     ▼               ▼
              ┌─────────────┐ ┌─────────────┐
              │merge to dev │ │ needs-human │ ◄── /factory approve
              └─────────────┘ └─────────────┘
```

## Files

```
factory/board.json                 state, written only by you
factory/jobs/<id>/spec.md          spec-writer
factory/jobs/<id>/build.md         builder
factory/jobs/<id>/round-N/*.md     security, ux, ui, code
factory/jobs/<id>/decision.md      decider
.worktrees/<id>/                   the code, on branch factory/<id>
```

Create `board.json` as `{ "jobs": [] }` if it is missing. `<id>` is the next three-digit number plus a short slug, such as `003-rate-limiting`. A job looks like this:

```json
{ "id": "003-rate-limiting", "feature": "Rate limit the public API",
  "branch": "factory/003-rate-limiting", "stage": "review", "round": 2,
  "reviews": { "security": "CHANGES", "ux": "PASS", "ui": "pending", "code": "PASS" },
  "history": [ { "security": "CHANGES", "ux": "PASS", "ui": "PASS", "code": "CHANGES" } ],
  "builder": "builder-003-rate-limiting", "note": "" }
```

`stage` is `spec`, `build`, `review`, `decide`, `merged`, or `needs-human`. `reviews` is the current round and `history` holds the closed ones. `note` says why a job stopped when `decision.md` does not. Update the board at every step so the dashboard moves.

Agents get context from files. Spawn each one with only the job id and round number, and let it read the rest. Its agent file says where. Judge results by those files too. A resumed agent's report can be stale, so read the file instead of trusting the message.

## Commands

**`/factory <feature>`**: add the job at stage `spec`, then run the loop below.

**`/factory next`**: take the first `- [ ]` line in `factory/backlog.md` as the feature, change it to `- [x]`, and run it the same way. If none is left, say so and stop.

**`/factory approve <job-id>`**: the job must be at `needs-human`. Run **Merge**.

**`/factory rework <job-id> <note>`**: the job can be at any stage except `merged`. Write the note to `round-<round>/human.md` in the job folder, creating the folder if needed, then go to step 6 at "open the next round". This also restarts a job whose session died.

## The loop, step by step

1. `mkdir -p factory/jobs/<id>`, then `git worktree add .worktrees/<id> -b factory/<id> dev`. The worktree keeps this checkout, and with it the dashboard, in place while the builder works.
2. Spawn `spec-writer`. If `spec.md` does not exist when it finishes, stop the job at `needs-human`.
3. Set stage `build`, round 1. Spawn `builder` named `builder-<job-id>`. If the Agent tool has no name field, use the agent id from the spawn result. Store that address in the job's `builder` field.
4. Set stage `review`, `mkdir factory/jobs/<id>/round-<round>`, and spawn `security`, `ux`, `ui`, and `code` together in one message.
5. **WAIT FOR ALL.** As each reviewer finishes, read the first line of its file and set its chip: `VERDICT: PASS` is `PASS`, anything else is `CHANGES`. The round is done only when all four files exist in the folder. Keep waiting until then, and never resume the builder mid-round. If a reviewer finishes without writing its file, spawn it once more. If the file is still missing, stop the job at `needs-human` with a note.
6. If any review is `CHANGES` and round is 3 or more, stop at `needs-human` with the note `3 rounds without a clean pass`. Otherwise open the next round: append `reviews` to `history`, add 1 to `round`, reset `reviews` to `pending`, and set stage `build`. Resume the builder with SendMessage, pointing it at the closed round folder. If that fails, as it will in a new session, spawn a new `builder-<job-id>`, which can pick the job up from its files. Then go to step 4.
7. If all four are `PASS`, set stage `decide` and spawn `decider`.
8. If the first line of `decision.md` is exactly `APPROVE`, run **Merge**. Anything else stops the job at `needs-human`.

## Merge

Use whichever checkout already has `dev`, or make a temporary one:

```bash
wt=$(git worktree list --porcelain | grep -B2 '^branch refs/heads/dev$' | sed -n 's/^worktree //p')
[ -n "$wt" ] || { git worktree add -q .worktrees/dev dev && wt=.worktrees/dev; }
git -C "$wt" merge --no-ff factory/<id> -m "factory: merge <id>"
```

If the merge fails, run `git -C "$wt" merge --abort` if a merge is in progress, then set `needs-human` with a note. On success, set stage `merged` and run `git worktree remove .worktrees/<id>`. If you created `.worktrees/dev`, remove it in either case.

Never push. Pushing `dev` deploys `rag-api-dev` and `rag-web-dev`, so that step stays with a person.

When the job stops, report its stage, its branch, and what the human has to do, if anything.
