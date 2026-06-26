# Investigation Mode Metrics

Reference for the Langfuse/CloudWatch signals emitted by the investigation pipeline. All metrics are recorded via the shared `MetricRecorder` port (Langfuse is the current implementation, traces appear under `metric.<name>` in the Langfuse UI with type + value + tags in metadata).

## Dispatcher-level (all modes)

Emitted from `DispatchInvestigationUseCase` around every mode invocation — covers orchestrator, hypothesis, and debate uniformly.

| Metric | Type | Tags | Emitted when |
|---|---|---|---|
| `investigation.mode_invoked` | counter | `mode` | Dispatcher resolves a mode and before it runs |
| `investigation.mode_duration_ms` | histogram | `mode`, `outcome` (success \| error) | After mode completes or throws |
| `investigation.mode_failed` | counter | `mode` | On throw — pairs with the error histogram for rate dashboards |

## Mode-level (hypothesis + debate only)

Emitted from inside `HypothesisMode` / `DebateMode`. The `mode` tag is always `hypothesis` or `debate`. Orchestrator mode does not emit these — its internal stages are not modeled the same way.

### Reconnaissance

| Metric | Type | Tags | Emitted when |
|---|---|---|---|
| `investigation.recon_fired` | counter | `mode`, `hasAws`, `composioCount` | Recon mini-agent actually runs (skipped for zero-integration tenants) |
| `investigation.recon_cost_usd` | histogram | `mode` | Right after recon completes — tracks USD spent on the pre-seeker step |

### Re-seek fallback

| Metric | Type | Tags | Emitted when |
|---|---|---|---|
| `investigation.reseek_triggered` | counter | `mode` | Judge returns all rulings below threshold and re-seek kicks in |
| `investigation.reseek_improved` | counter | `mode` | Re-seek's new ruling beats the original — counts cases where the fallback actually helped |

### Final result

| Metric | Type | Tags | Emitted when |
|---|---|---|---|
| `investigation.total_cost_usd` | histogram | `mode` | End of run (includes recon + seeker + agents + judge + re-seek) |
| `investigation.hypotheses_count` | gauge | `mode` | End of run — number of hypotheses persisted (3 normally, 5 if re-seek kept) |
| `investigation.winner_score` | histogram | `mode` | When a winner is confirmed (usually terminal) |

## Dashboard recipes

A few queries worth pinning to the team dashboard:

### "How many investigations ran per mode in the last 7d?"
```
count(investigation.mode_invoked) by mode
```

### "Which mode has the highest success rate?"
```
rate(investigation.mode_duration_ms{outcome=success}) / rate(investigation.mode_invoked) by mode
```

### "Is re-seek actually earning its keep?"
```
count(investigation.reseek_improved) / count(investigation.reseek_triggered)
```
A ratio near 0 means the fallback is paying cost without quality gain — consider tuning the threshold or the re-seek prompt. Near 1 means it consistently pulls bad investigations up, keep it.

### "Cost comparison per mode"
```
avg(investigation.total_cost_usd) by mode
p95(investigation.total_cost_usd) by mode
```

### "Winner confidence distribution"
```
histogram(investigation.winner_score) by mode
```
A tight distribution around 80+ is healthy. A bimodal distribution (some high, some ~50) suggests tenants are hitting the re-seek floor a lot.

## Where to add this in Langfuse

Langfuse renders each `trace.name = metric.<name>` as an entry under the project's trace list. Use the filter bar to narrow by metric name, then use the Dashboards feature to aggregate. The `mode` tag is the dimension that most recipes filter / group by.

## Adding a new metric

1. Call `this.deps.metrics?.increment/gauge/histogram('investigation.<name>', value, tags)` from the mode or dispatcher.
2. Always include `mode` in tags if the metric is mode-specific.
3. Default off — `metrics?` is optional in every mode dep so unit tests and
   degraded deploys never need to stub it.
4. Add a row to the tables above so the dashboard team can pick it up.
