import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt';
import { TestCoverageResultSchema } from '../types';
import { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export const testCoverageAnalyzer: AgentDefinition = {
    description: "Analyzes test coverage for the codebase",
    prompt: TEST_COVERAGE_ANALYZER_PROMPT,
    tools: ["Skill"],
    model: "inherit",
    mcpServers: [],
}