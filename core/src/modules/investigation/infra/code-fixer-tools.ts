import { CODE_ANALYZER_TOOLS, createCodeAnalyzerToolHandler } from './code-analyzer-tools.js';
import type { ToolDefinition } from '../../../shared/application/ports/agent-runner.port.js';
/**
 * Code Fixer agent tools — reuses READ-ONLY tools from code_analyzer.
 * The agent reads source, tree, and diffs, then proposes fixes via its response (not via write tools).
 */
export const CODE_FIXER_TOOLS = CODE_ANALYZER_TOOLS.filter((t) => ['code_read_file', 'code_get_tree', 'code_get_commit_diff', 'code_get_recent_commits', 'code_get_repo_info'].includes(t.name));
export function createCodeFixerToolHandler(deps: import('./code-analyzer-tools.js').CodeAnalyzerToolDeps): (name: string, input: Record<string, unknown>) => Promise<string | null> {
    return createCodeAnalyzerToolHandler(deps);
}
