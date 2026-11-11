import { mcpServersConfig } from '../config/mcp.config';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt';
import { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export const refactoringSuggester: AgentDefinition = {
    description: "Suggests code refactoring improvements based on best practices",
    prompt: REFACTORING_SUGGESTER_PROMPT,
    tools: ["Skill","mcp__eslint__lint-files"],
    model: "inherit",
    mcpServers: [ { eslint: mcpServersConfig.eslint },],
}