/**
 * Resolves the active OSS LLM connector endpoint (AC-059).
 */
import {
  DEEPSEEK_CONTEXT_WINDOW_TOKENS,
  ORNITH_CONTEXT_WINDOW_TOKENS,
  type LlmConnectorId,
  type LlmConnectorOption,
  type LlmConnectorProfile,
} from '../../domain/llm-connector.entity.js';
import { config } from '../../config/index.js';
import { resolveActiveInvestigationLlmProfileEndpoint } from '../../../modules/oss/infra/resolve-investigation-llm-profile.js';
import { getActiveLlmConnectorId } from './oss-llm-connector-store.js';

export interface ResolvedLlmEndpoint {
  /** Legacy enum id or custom Investigation LLM profile UUID (AC-086). */
  connectorId: string;
  profileId?: string;
  label?: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  contextWindowTokens: number;
  credentialsConfigured?: boolean;
}

function hasCredential(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0 && value !== 'local');
}

function ornithProfile(): LlmConnectorProfile {
  return {
    id: 'ornith',
    label: 'Ornith 9B (local llama.cpp)',
    baseUrl: config.llm.ornithBaseUrl,
    model: config.llm.ornithModel,
    contextWindowTokens: ORNITH_CONTEXT_WINDOW_TOKENS,
    credentialsConfigured: true,
  };
}

function deepseekOpencodeProfile(): LlmConnectorProfile {
  return {
    id: 'deepseek-opencode',
    label: 'DeepSeek V4 Flash (OpenCode Go)',
    baseUrl: config.llm.opencodeBaseUrl,
    model: config.llm.opencodeModel,
    contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
    credentialsConfigured: hasCredential(config.llm.opencodeApiKey),
  };
}

function deepseekNimProfile(): LlmConnectorProfile {
  return {
    id: 'deepseek-nim',
    label: 'DeepSeek V4 Flash (NVIDIA NIM)',
    baseUrl: config.llm.nimBaseUrl,
    model: config.llm.nimModel,
    contextWindowTokens: DEEPSEEK_CONTEXT_WINDOW_TOKENS,
    credentialsConfigured: hasCredential(config.llm.nimApiKey),
  };
}

export function listLlmConnectorOptions(): LlmConnectorOption[] {
  return [ornithProfile(), deepseekOpencodeProfile(), deepseekNimProfile()].map((p) => ({
    id: p.id,
    label: p.label,
    model: p.model,
    contextWindowTokens: p.contextWindowTokens,
    credentialsConfigured: p.credentialsConfigured,
  }));
}

export function getLlmConnectorProfile(id: LlmConnectorId): LlmConnectorProfile {
  switch (id) {
    case 'deepseek-opencode':
      return deepseekOpencodeProfile();
    case 'deepseek-nim':
      return deepseekNimProfile();
    default:
      return ornithProfile();
  }
}

export async function getActiveLlmConnectorProfile(): Promise<LlmConnectorProfile> {
  const id = await getActiveLlmConnectorId();
  return getLlmConnectorProfile(id);
}

export async function resolveActiveLlmEndpoint(tenantId?: string): Promise<ResolvedLlmEndpoint> {
  if (tenantId) {
    const custom = await resolveActiveInvestigationLlmProfileEndpoint(tenantId);
    if (custom) return custom;
  }

  const profile = await getActiveLlmConnectorProfile();
  const apiKey =
    profile.id === 'deepseek-opencode'
      ? config.llm.opencodeApiKey
      : profile.id === 'deepseek-nim'
        ? config.llm.nimApiKey
        : config.llm.ornithApiKey;
  return {
    connectorId: profile.id,
    label: profile.label,
    baseUrl: profile.baseUrl,
    model: profile.model,
    apiKey,
    contextWindowTokens: profile.contextWindowTokens,
    credentialsConfigured: profile.credentialsConfigured,
  };
}

export function connectorEvidenceLabel(connectorId: string): string {
  switch (connectorId) {
    case 'deepseek-opencode':
      return 'deepseek-opencode';
    case 'deepseek-nim':
      return 'deepseek-nim';
    case 'ornith':
      return 'local';
    default:
      return connectorId;
  }
}
