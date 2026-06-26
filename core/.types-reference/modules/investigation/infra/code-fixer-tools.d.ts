import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
import type { CodeAnalyzerToolDeps } from './code-analyzer-tools.js';
/**
 * Code Fixer agent tools — reuses READ-ONLY tools from code_analyzer.
 * The agent reads source, tree, and diffs, then proposes fixes via its response (not via write tools).
 */
export declare const CODE_FIXER_TOOLS: ToolDefinition[];
export declare function createCodeFixerToolHandler(deps: CodeAnalyzerToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null>;
