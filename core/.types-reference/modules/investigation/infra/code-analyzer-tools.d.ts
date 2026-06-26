import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { ICodeKnowledgeRepository } from '../../code-intelligence/domain/code-knowledge.repository.js';
import type { ICodeRepository } from '../../../shared/application/ports/code-repository.port.js';
import type { TenantId } from '../../../shared/domain/value-objects.js';
export declare const CODE_ANALYZER_TOOLS: ToolDefinition[];
export interface CodeAnalyzerToolDeps {
    codeKnowledgeRepo: ICodeKnowledgeRepository;
    codeRepo?: ICodeRepository;
    tenantId: TenantId;
}
export declare function createCodeAnalyzerToolHandler(deps: CodeAnalyzerToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null>;
