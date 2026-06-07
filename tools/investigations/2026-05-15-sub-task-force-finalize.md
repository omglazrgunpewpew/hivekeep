# Sub-task force-finalize investigation

Incident: task `97d4e72b-c2ed-4724-a337-64efcda27bb6` (May 15 2026)
Investigated: 2026-05-15
Constraint: read-only audit, no code change.

## TL;DR

The "12-minute force finalize" is **not** a wall-clock timeout. It is a hard cap of **100 streamText iterations** baked into `executeSubAgent` (the sub-task LLM loop), followed by a **single-shot nudge / fail** sequence. When the loop exits (either by hitting the 100-step ceiling or by the model emitting a step with zero tool calls), the post-loop block at [src/server/services/tasks.ts:1040-1067](src/server/services/tasks.ts#L1040-L1067) injects a "[System] You have not called update_task_status() yet" message and re-enters the loop with `isNudge = true`. If the nudge round still does not flip the task out of `in_progress`, the task is force-failed.

The DB evidence for task 97d4e72b is consistent with hitting the 100-step ceiling: the assistant message persists **exactly 100 tool calls** in its `tool_calls` array, the last of which is `edit_file`, and the message ends mid-thought with `"Now update the rendering to include slug + number:"`, i.e. the model was about to call another tool when the loop terminated.

Twelve minutes is just how long 100 sequential tool-use rounds happen to take with thinking enabled on a refactor of this size, not a configured deadline.

## Section 1: Mechanism map

### 1a. The sub-task LLM loop

Entry point: `executeSubAgent(taskId, isNudge = false)` at [src/server/services/tasks.ts:416](src/server/services/tasks.ts#L416).

Loop scaffolding ([src/server/services/tasks.ts:683-690](src/server/services/tasks.ts#L683-L690)):

```
const maxSteps = hasTools ? (config.tools.maxSteps > 0 ? config.tools.maxSteps : 100) : 1
...
let step = 0
for (; step < maxSteps; step++) {
  if (abortController.signal.aborted) break
  const result = streamText({ ... })
  ...
}
```

`config.tools.maxSteps` is sourced from `TOOLS_MAX_STEPS` env var ([src/server/config.ts:376](src/server/config.ts#L376)). The comment claims `0 = unlimited (capped at 100 internally)`, but in practice the `: 100` fallback **is** the cap when the env var is unset, which is the default in production.

Loop exit conditions ([src/server/services/tasks.ts:825-835](src/server/services/tasks.ts#L825-L835)):

```
if (stepToolCalls.length === 0 || streamError || abortController.signal.aborted) {
  ...
  break
}
```

Three ways out of the loop:
1. `step >= maxSteps` (for-loop condition fails): the 100-iteration ceiling.
2. `stepToolCalls.length === 0`: the model emits a step with text only, no tool calls.
3. `streamError` or `abortController.signal.aborted`: error or external cancel.

There is no wall-clock check anywhere in this loop. `grep "setTimeout\|deadline\|wall.clock"` on `tasks.ts` returns only the inter-Agent response timeout (a different mechanism, scoped to `awaiting_agent_response`), the in-flight `lastCheckpointAt` checkpoint timer, and the `Date.now()` ms stamps. No `setTimeout` is wired around the sub-task LLM stream.

### 1b. Nudge and force-fail

Immediately after the loop, the code re-reads the task row from DB ([src/server/services/tasks.ts:1034](src/server/services/tasks.ts#L1034)) and branches:

- If `status === 'awaiting_agent_response'` (suspended for an inter-Agent reply): return, no nudge.
- If `status === 'in_progress'` (the Agent did not call `update_task_status`): nudge or fail.

The nudge block ([src/server/services/tasks.ts:1042-1067](src/server/services/tasks.ts#L1042-L1067)):

```
if (currentTask && currentTask.status === 'in_progress') {
  if (!isNudge) {
    // First attempt: inject a reminder and re-run one more LLM turn
    await db.insert(messages).values({
      ...
      role: 'user',
      content:
        '[System] You have not called update_task_status() yet. ' +
        'You MUST finalize this task now:\n' +
        '- Call update_task_status("completed", "<summary>") if the task is done.\n' +
        '- Call update_task_status("failed", undefined, "<reason>") if you could not complete it.\n' +
        'Do this immediately.',
      sourceType: 'system',
      ...
    })
    await executeSubAgent(taskId, true)
  } else {
    // Already nudged once: now fail for real
    await resolveTask(taskId, 'failed', undefined, 'Task did not explicitly report completion')
  }
}
```

Important properties:
- The trigger is **status-based**, not turn-count-based or timer-based. Any path that exits the loop while `task.status === 'in_progress'` lands here.
- The first nudge **recursively re-enters** `executeSubAgent` with `isNudge = true`. That recursive invocation gets its own fresh 100-step budget, its own `assistantMessageId`, etc. So a Agent that calls `update_task_status` during the nudge round resolves cleanly.
- The second branch (else) only runs **after the nudge round itself terminates with the task still `in_progress`**. This is one nudge, then fail. No second chance.
- There is **no `stepLimitReached` detection** here, unlike the main-Agent path in [src/server/services/agent-engine.ts:1807-1823](src/server/services/agent-engine.ts#L1807-L1823) where hitting the step cap is treated separately and the turn is closed with a "truncated, ask me to continue" string instead of nudging or failing.

### 1c. What "Forced to finalize early" actually means

The DB row for task 97d4e72b carries the literal error string:

```
Task partially completed but not shippable. Forced to finalize early. WIP committed on branch ...
```

That string is **not** produced by `resolveTask`. The `resolveTask` failure path only writes `'Task did not explicitly report completion'` ([src/server/services/tasks.ts:1066](src/server/services/tasks.ts#L1066)). The actual error text comes from the Agent itself: during the nudge round, the agent obeyed the system message and called `update_task_status("failed", undefined, "<that whole summary>")`. The `update_task_status` tool implementation is at [src/server/tools/subtask-tools.ts:42](src/server/tools/subtask-tools.ts#L42).

So the failure mode is: the agent was making honest progress, the loop ended (most likely at the 100-step cap), the system told the agent "finalize now", and the agent honestly reported "I am not done, here is my WIP". That self-reported failure is what the user sees.

## Section 2: Timing

Sub-task idle timer: **there is none**. The nudge is not gated on a duration. It fires whenever `executeSubAgent` returns control while `task.status === 'in_progress'`.

How long can a sub-task run before the nudge?

- Bounded above by `maxSteps` streamText iterations. With `TOOLS_MAX_STEPS=0` (default), `maxSteps = 100` per `executeSubAgent` invocation ([src/server/services/tasks.ts:683](src/server/services/tasks.ts#L683)).
- Each iteration's duration is whatever the model and tool batch take: thinking time, model latency, tool execution time (bounded only by the underlying tool's behavior).
- No `AbortSignal.timeout`, no scheduled `setTimeout`, no Promise.race wrapping the loop.

Net effect: a refactor that needs 100 sequential edit/read tool calls with thinking will hit the cap. With each round taking 7-8 seconds (model latency + thinking + IO), that is roughly 12 minutes. The 12-minute number is **emergent** from `100 × per-round latency`, not configured.

Configurable knobs:
- `TOOLS_MAX_STEPS` env (read by [src/server/config.ts:376](src/server/config.ts#L376), advertised via [src/server/tools/platform-tools.ts:38](src/server/tools/platform-tools.ts#L38)). Setting it to a higher integer raises the cap. Setting it to `0` keeps the hardcoded fallback of 100.
- That is the only relevant knob.

## Section 3: Evidence from 97d4e72b

DB inspection on the live prod DB (read-only, via SSH to `192.168.1.14`, file `/home/marlburrow/.local/share/hivekeep/hivekeep.db`).

### 3a. Task row

```
id      : 97d4e72b-c2ed-4724-a337-64efcda27bb6
status  : failed
title   : Ticket: Slug projet + numéro de ticket lisible (hivekeep#42, #42, UUID)
created : 1778838820831  (start)
updated : 1778839633053  (final resolve)
elapsed : 812222 ms = 13 min 32 s
error   : "Task partially completed but not shippable. Forced to finalize early. ..." (self-reported by the Agent)
```

### 3b. Messages on this task

Only **four** messages total on the task message stream:

| # | role | source | created_at (ms) | len | tool_calls | preview |
|---|---|---|---|---|---|---|
| 1 | user | system | 1778838820953 | 77 | 0 | "Work on ticket: Slug projet + numero de ticket lisible (hivekeep#42, #42, UUID)" |
| 2 | assistant | agent | 1778838820958 | 2389 | **100** | "Now let me check the active speaker / agent engine context..." |
| 3 | user | system | 1778839550188 | 295 | 0 | "[System] You have not called update_task_status() yet. ..." |
| 4 | assistant | agent | 1778839550247 | 1017 | 6 | "Task finalized as failed (partial WIP). Summary: ..." |

### 3c. Timing analysis

- Gap between first assistant turn and nudge: `1778839550188 - 1778838820958 = 729230 ms ≈ 12 min 9 s`.
- Gap between nudge and final assistant resolution: `1778839550247 - 1778839550188 = 59 ms` (nudge injected, then second executeSubAgent started immediately).
- Final `resolveTask` at `1778839633053`, i.e. `82806 ms ≈ 1 min 23 s` after the nudge round began.

### 3d. Why this most likely hit the 100-step cap, not a "text-only" exit

- The first assistant message stores `json_array_length(tool_calls) = 100`, exactly the cap. Different cap values would produce different counts; matching the cap to the digit is a strong tell.
- The last tool in `tool_calls[99]` is `edit_file`, a write tool that is not concurrencySafe and therefore runs as a solo batch (1 tool call per step). Consecutive `edit_file`s correspond to 1 streamText iteration each, so a tail of `edit_file`s is consistent with the loop counting up by 1 per round.
- The content tail ends on `"Now update the rendering to include slug + number:"`, i.e. a colon, mid-narration before the next intended tool call. The model was clearly about to issue more work, not winding down.
- A "no tool calls this step" exit would normally be preceded by some kind of recap text. There is no recap; just a colon.

Caveat: streamText iterations can emit multiple parallel `tool-call` parts in a single round when several read-only tools are batched. The 100 stored calls therefore do not prove "100 rounds" with certainty; some of those calls could have been parallel reads. The `step + 1` value is logged via `log.info` at [src/server/services/tasks.ts:894](src/server/services/tasks.ts#L894) but that log line is not retained in the DB, so the exact step count for this incident is not directly verifiable post-hoc. See Open Questions.

### 3e. What the agent was doing at the moment of the nudge

Based on the trailing content, the agent was iterating on `prompt-builder.ts` rendering (slug + number) after having already wired the DB columns, the resolver utility, the slug generation in `projects.ts`, and the migration scaffold. The "DONE" / "NOT DONE" breakdown in the agent's self-reported failure message ([the error column of the task row](src/server/services/tasks.ts#L1098-L1145)) lines up with that picture: the foundation pieces were committed on branch `feat/project-slug-ticket-number` (commit `edf17985`), but tool wiring, UI, migration backfill, and tests were still pending. The agent was midway through finishing, not stuck.

## Section 4: Comparison with Claude Code / Claude Agent SDK

I do not have offline access to `@anthropic-ai/claude-agent-sdk` source in this workspace and have not fetched it during this investigation, so this section is partly based on the public API surface (which I have used directly in past sessions) and clearly marked inference. The points below should be re-verified against the actual SDK before being relied upon for a design change.

Surface-level comparison:

| Mechanism | Hivekeep `executeSubAgent` | Claude Agent SDK (`query` / Claude Code) |
|---|---|---|
| Hard iteration cap | `maxSteps` (default 100, env-configurable) | `maxTurns` option (configurable, no hard internal cap baked in) |
| What happens at the cap | Loop exits silently, then nudge, then force-fail | Session ends, returns a result; the SDK does not synthesize a "you must call tool X" prompt |
| Wall-clock timeout | None | None (a session can run as long as the model keeps producing tool calls under `maxTurns`) |
| Required terminal tool | `update_task_status` is mandatory for graceful completion | None; a session is "done" when the model stops emitting tool calls and produces a final text turn |
| Behavior on "no tool call" step | Loop breaks, nudge fires unless status was changed | Treated as a normal end-of-turn |

The structural difference: Claude Code is designed around the **model deciding when to stop**, with `maxTurns` as a budget ceiling and the host process accepting whatever final state the model arrives at. Hivekeep's sub-task path is designed around the **host insisting on a specific terminal tool call** (`update_task_status`) and treating its absence as a failure mode that must be resolved within one extra round.

This insistence is what creates the "premature finalize" failure: the host's interpretation of "you stopped before calling the terminal tool" is "you are stuck"; in reality the model may simply have run out of step budget mid-work and would happily continue if given more steps. The nudge then forces a binary completed/failed choice, and a honest agent picks `failed` because it is not done.

## Section 5: Recommended fix

Goals: stop force-failing sub-tasks that are making real progress; keep the safety net that prevents an in_progress task from hanging forever; do not require operators to tune env vars for every long task.

Three layered options, in increasing scope. They are not mutually exclusive; option A is essentially a prerequisite for B and C to be useful.

### Option A: distinguish "step cap hit" from "model stopped on its own"

Mirror the `stepLimitReached` logic from [src/server/services/agent-engine.ts:1807-1823](src/server/services/agent-engine.ts#L1807-L1823) inside `executeSubAgent`. At loop exit, compute:

```
const stepLimitReached = step >= maxSteps && stepToolCalls.length > 0
```

When `stepLimitReached`:
- Do **not** inject the current "you MUST finalize" nudge.
- Instead, inject a softer message: "You have used your step budget for this round (`maxSteps` rounds). Either call `update_task_status` if you can summarize what you accomplished, or continue from where you left off in the next round; you have one more step budget to either finish the work or report status."
- Re-enter `executeSubAgent` with `isNudge = true` (so the existing one-shot failure guard still applies if the next round also leaves status unchanged).

Tradeoff: one extra round of LLM cost per sub-task that hits the cap. Worth it because the current behavior **loses** that round entirely by forcing a fail.

Files affected: `src/server/services/tasks.ts` only.

### Option B: raise the hidden cap, make it explicit

Change the fallback at [src/server/services/tasks.ts:683](src/server/services/tasks.ts#L683) from a silent `100` to a documented `config.tasks.subAgentMaxSteps` (e.g., default 250) and log a `warn` when the cap is hit so it shows up in observability. The current `TOOLS_MAX_STEPS=0 -> 100` is surprising: the comment in `config.ts` claims "unlimited (capped at 100)" but in practice the cap **is** the limit since most operators never set the env.

Tradeoff: more LLM spend ceiling per task. A non-trivial refactor commonly needs 150-300 tool calls; 100 is too aggressive for sub-tasks specifically (the main-Agent path has the same cap but main-Agent runs are typically shorter conversational turns, not long refactors).

Files affected: `src/server/config.ts` (new `tasks.subAgentMaxSteps` field), `src/server/services/tasks.ts` (read the new field), possibly `src/server/tools/platform-tools.ts` (expose the new env name).

### Option C: add an explicit wall-clock budget per sub-task (optional safety net)

The current code has no upper time bound on a single `executeSubAgent` invocation. If A and B are adopted, a malformed task could in principle keep emitting tool calls for hours. A simple safety net: wrap the loop in an `AbortSignal.timeout(config.tasks.subAgentMaxWallClockMs)` (default ~30 minutes), so a stuck tool call cannot run forever, and a runaway loop cannot exhaust the higher step budget silently. On timeout, fall through to the existing post-loop nudge path so the agent still gets a chance to summarize.

Tradeoff: introduces a wall-clock dimension that does not exist today. Should be tuned generously enough to not re-create the original problem.

Files affected: `src/server/services/tasks.ts`, `src/server/config.ts`.

### Recommended combination

Adopt **A + B**. A alone removes the "honest progress is punished" failure mode; B alone removes the "100 steps is just not enough" root cause. C is optional and would be a future safety net rather than a fix for this incident.

### What I would **not** do

- **Do not just remove the nudge entirely.** The nudge is meaningful when the Agent actually stalls (text-only end-of-turn while still `in_progress`) and the system needs to converge to a known state.
- **Do not switch to "no terminal tool required."** The `update_task_status` contract is load-bearing for downstream signal (await mode result delivery, ticket linkage, async informational message, etc., in `resolveTask` at [src/server/services/tasks.ts:1098-1199](src/server/services/tasks.ts#L1098-L1199)). Removing it would force a guess of the result string and break the ticket reminder flow.
- **Do not change `maxSteps` semantics globally.** Main-Agent turns have different ergonomics from sub-task turns; they should be tunable independently.

## Section 6: Open questions

These could not be answered from the code and DB alone.

1. **Exact step count for 97d4e72b.** The 100 `tool_calls` in the assistant row strongly suggests `step` hit 100, but a streamText iteration can emit multiple parallel tool calls. The authoritative number is logged by [src/server/services/tasks.ts:891-901](src/server/services/tasks.ts#L891-L901) (`Sub-Agent LLM turn completed`, fields `stepCount` and `finishReasons`) but those logs are not persisted to the DB. Check `journalctl` / pino log files on the prod host for the line bearing `taskId=97d4e72b...` if you want the exact step count and the `finishReason` array. If `stepCount=100`, my main hypothesis is confirmed. If much lower, the loop exited via "no tool calls this step" and the diagnosis shifts toward "the model legitimately stopped emitting tools mid-refactor", which is a slightly different problem.
2. **Frequency.** How often does this happen? The current code path will surface this every time a sub-task does more than ~100 sequential tool calls. A quick `SELECT count(*) FROM tasks WHERE status='failed' AND error LIKE '%Forced to finalize early%' OR error LIKE '%did not explicitly report completion%'` over the last N days would establish whether 97d4e72b is one of many or a one-off.
3. **Whether `TOOLS_MAX_STEPS` is set in prod.** I did not read the running container's environment. If it is set to something other than 0, the analysis still holds but the cap is wherever it is set, not 100.
4. **Behavior under thinking-enabled Anthropic models specifically.** The streamText loop processes `reasoning-start`/`reasoning-delta`/`reasoning-end` parts but I did not verify whether a "reasoning-only" step (thinking, no tool, no text) counts as `stepToolCalls.length === 0` and breaks the loop. If yes, that would be a second, independent way to exit the loop prematurely and would warrant separate handling. Worth a focused test.
5. **Whether the `resolveTask('failed', ..., 'Task did not explicitly report completion')` branch has ever actually fired in prod.** The DB I queried showed the Agent's self-reported error string, not that branch's hardcoded one. A `SELECT count(*) FROM tasks WHERE error = 'Task did not explicitly report completion'` would tell us.

---

Read-only audit. No code or DB changes were made. Branch state unchanged.
