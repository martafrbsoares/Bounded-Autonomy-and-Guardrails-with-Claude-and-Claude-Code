import { mcpServersConfig } from '../config/mcp.config';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt';
import { AgentDefinition } from "@anthropic-ai/claude-agent-sdk";

export const codeQualityAnalyzer: AgentDefinition = {
    description: "Analyzes code quality based on best practices and security considerations",
    prompt: CODE_QUALITY_ANALYZER_PROMPT,
    tools: ["Skill", "javascript-best-practices"],
    model: "inherit",
    mcpServers: [{ github: mcpServersConfig.github },],
}