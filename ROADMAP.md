# Hivekeep Roadmap

## Status legend

- **Proposed**: planned, not a delivery claim.
- **In progress**: active delivery.
- **Shipped**: released and supported.

All 48 items are **Proposed** unless repository evidence proves otherwise.

## Release sequence

- **A, Never lose the turn, highest priority:** errors, retries, fallback, checkpoints, idempotency, error cards. Provider cycling must ship with checkpoints and idempotency to prevent replaying completed side effects.
- **B, Trust the outcome:** verification, approvals, structured results, rendering, incidents, audit.
- **C, Operate continuously:** health dashboard, smoke tests, local-time scheduling, monitors, wakeups, cron health.
- **D, Control context:** sessions, compaction, dependencies, secrets, migrations, review.
- **E, Scale platform:** policy, environment safety, workflow graphs, replay, config versioning, backup and update controls.
- **F, Optimize/polish:** budgets, quality routing, learning, templates, timeline, self-monitoring.

## Build order

### Reliability and recovery, A then C
1. **Provider fallback/routing** (**Proposed**): route providers and models.  
   - Acceptance direction: observable safe fallback with checkpoints and idempotency.
2. **Error classification** (**Proposed**): normalize failure classes.  
   - Acceptance direction: classifications guide retry and recovery.
3. **Durable checkpoints/resume** (**Proposed**): persist safe progress boundaries.  
   - Acceptance direction: recovery identifies completed and remaining work.
4. **Idempotency** (**Proposed**): prevent duplicate external effects.  
   - Acceptance direction: stable keys guard side-effecting tools.
5. **Provider/model health dashboard** (**Proposed**): expose route health.  
   - Acceptance direction: operators explain route decisions.
6. **Model smoke tests** (**Proposed**): test configured capabilities.  
   - Acceptance direction: failures update health without a user turn.

### Safety and verification, B then E
7. **Native verification gates** (**Proposed**): require completion evidence.  
   - Acceptance direction: test, query, file, or external proof is supported.
8. **Risk approvals** (**Proposed**): require approval for risky actions.  
   - Acceptance direction: action, scope, expiry, and decision are recorded.
9. **Dry-run plans** (**Proposed**): preview actions without effects.  
   - Acceptance direction: validation is distinct from execution.
10. **Environment-aware safety** (**Proposed**): control by target and blast radius.  
   - Acceptance direction: production-like targets have safeguards.
11. **Agent response contracts** (**Proposed**): standardize outcome and progress shapes.  
   - Acceptance direction: callers use stable contracts.

### Results and incidents, A then B
12. **Structured result schemas** (**Proposed**): standardize result states.  
   - Acceptance direction: results carry status, evidence, artifacts, guidance.
13. **Unified rendering** (**Proposed**): render results consistently.  
   - Acceptance direction: equivalent outcomes share semantics.
14. **Incident lifecycle/dedup** (**Proposed**): manage and correlate incidents.  
   - Acceptance direction: repeated failures retain individual evidence.
15. **Actionable error cards** (**Proposed**): provide recovery guidance.  
   - Acceptance direction: cards state cause, retry, inputs, escalation.

### Scheduling and monitoring, C
16. **Local-time DST scheduling** (**Proposed**): schedule correctly in local time.  
   - Acceptance direction: history explains clock transitions.
17. **Non-LLM monitors** (**Proposed**): support deterministic monitoring.  
   - Acceptance direction: monitors are low-cost and auditable.
18. **Event wakeups** (**Proposed**): wake work from trusted events.  
   - Acceptance direction: source context and deduplication are retained.
19. **Cron health/dependencies** (**Proposed**): surface job health and blocks.  
   - Acceptance direction: missed scheduling is diagnosable.

### Observability and context, C then D
20. **Live execution** (**Proposed**): expose active progress and waits.  
   - Acceptance direction: active, waiting, terminal states are distinct.
21. **Typing indicators** (**Proposed**): show truthful response activity.  
   - Acceptance direction: indicators start and stop reliably.
22. **Sessions** (**Proposed**): manage durable task and conversation boundaries.  
   - Acceptance direction: scope and linkage are inspectable.
23. **Context/compaction health** (**Proposed**): measure pressure and retention.  
   - Acceptance direction: warnings precede continuity risk.
24. **Compaction fallback/quality** (**Proposed**): preserve source access on weak compaction.  
   - Acceptance direction: quality failures have safe fallback.

### Lifecycle and dependencies, D
25. **Secret lifecycle** (**Proposed**): manage rotation, expiry, access, revocation.  
   - Acceptance direction: affected integrations are known first.
26. **Blast-radius views** (**Proposed**): show change consumers and risk.  
   - Acceptance direction: dependencies are visible before change.
27. **Provider/model migration** (**Proposed**): make controlled transitions.  
   - Acceptance direction: compatibility, rollback, comparison are supported.
28. **Model review workflow** (**Proposed**): review model changes.  
   - Acceptance direction: evidence and approval precede rollout.

### Governance, B then E
29. **Audit trail** (**Proposed**): record actions and outcomes.  
   - Acceptance direction: entries are attributable and linked to evidence.
30. **Approval ledger** (**Proposed**): retain risky-action approvals.  
   - Acceptance direction: approvals are searchable by scope and expiry.
31. **Policy-as-code** (**Proposed**): review and test policy configuration.  
   - Acceptance direction: policy evaluates before action with history.
32. **Data governance** (**Proposed**): control retention, access, locality, handling.  
   - Acceptance direction: data classes have enforcement points.

### Platform and DX, E
33. **Cancellation semantics** (**Proposed**): make cancellation safe.  
   - Acceptance direction: completed effects and cleanup are reported.
34. **Replay harness** (**Proposed**): reproduce controlled executions.  
   - Acceptance direction: simulation stays separate from live effects.
35. **Agent config versioning** (**Proposed**): version instructions, tools, permissions.  
   - Acceptance direction: changes are reviewable and reversible.
36. **Staged updates** (**Proposed**): roll out changes progressively.  
   - Acceptance direction: pause and rollback are supported.
37. **Backup/DR** (**Proposed**): test restore and recovery.  
   - Acceptance direction: objectives and drills are documented.
38. **Plugin/tool trust** (**Proposed**): establish extension provenance and isolation.  
   - Acceptance direction: access and trust basis are assessable.

### Workflow and collaboration, E
39. **Workflow graphs** (**Proposed**): model dependency graphs.  
   - Acceptance direction: nodes, edges, retries, approvals are visible.
40. **Projects/tickets/incidents as context** (**Proposed**): attach work objects.  
   - Acceptance direction: status and history are directly available.
41. **Handoff packages** (**Proposed**): transfer goals, evidence, decisions, next steps.  
   - Acceptance direction: recipients continue safely.
42. **User/group permissions** (**Proposed**): apply role and group controls.  
   - Acceptance direction: effective access is inspectable.

### Optimization and polish, F
43. **Budgets** (**Proposed**): control cost, time, tokens, and tools.  
   - Acceptance direction: consumption and exhaustion are visible.
44. **Quality routing** (**Proposed**): route by quality, latency, cost, risk.  
   - Acceptance direction: decisions are explainable.
45. **Operational learning** (**Proposed**): capture reusable operational lessons.  
   - Acceptance direction: lessons are reviewed and reusable.
46. **Templates** (**Proposed**): provide reusable workflow and policy patterns.  
   - Acceptance direction: templates include safe defaults.
47. **Searchable timeline** (**Proposed**): unify turns, jobs, approvals, incidents, changes.  
   - Acceptance direction: users navigate to evidence.
48. **Platform self-monitoring** (**Proposed**): monitor availability, queues, dependencies, control plane.  
   - Acceptance direction: degradation yields recovery paths.

## Principles

- Preserve order, later work builds on earlier guarantees.
- Keep Release A focused on preventing lost work and duplicate side effects.
- Update status only with delivery evidence.
