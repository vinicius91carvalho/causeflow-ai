/**
 * Scenario injector for the open-source local runtime (AC-050).
 *
 * In the previous AWS-based runtime, this module injected log events and
 * metrics into CloudWatch to set up the environment for E2E investigation
 * scenarios. In the OSS runtime, the investigation agents are fully stubbed
 * (via DeterministicAgentRunner / DeterministicLLMClient) — the scenario is
 * configured by calling `harness.stubAgent.setAgentResponse()` and
 * `harness.stubLLM.setScenario()` in the test itself.
 *
 * These functions are kept as no-ops for API compatibility, so existing E2E
 * tests (pipeline-oom, pipeline-latency, etc.) continue to compile and run
 * without modification. No AWS SDK is imported.
 */

export interface ScenarioContext {
  tenantId: string;
  serviceName: string;
  timestamp: Date;
}

export async function injectOOMScenario(_ctx: ScenarioContext): Promise<void> {
  // No-op in OSS runtime.
  // Scenario data is pre-configured via stubAgent.setAgentResponse() and
  // stubLLM.setScenario() in the E2E test itself.
}

export async function injectLatencySpike(_ctx: ScenarioContext): Promise<void> {
  // No-op in OSS runtime.
}

export async function injectCascadingFailure(
  _ctx: ScenarioContext,
  _services?: string[],
): Promise<void> {
  // No-op in OSS runtime.
}
