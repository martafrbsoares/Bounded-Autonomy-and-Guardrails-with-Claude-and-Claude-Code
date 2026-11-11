import { ReviewReport, ReviewReportJSONSchema, ReviewReportSchema } from './types/report-types';
import { query, AgentDefinition } from "@anthropic-ai/claude-agent-sdk";
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt';
import { mcpServersConfig } from './config/mcp.config';
import { codeQualityAnalyzer, refactoringSuggester, testCoverageAnalyzer } from './agents';

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {

}

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {

  constructor(options: OrchestratorOptions = {}) {
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {

    const subagents: Record<string, AgentDefinition> = {
      "code-quality-analyzer": codeQualityAnalyzer,
      "test-coverage-analyzer": testCoverageAnalyzer,
      "refactoring-suggester": refactoringSuggester,
    };
    
    for await (const message of query({
      prompt: buildOrchestratorPrompt(owner, repo, prNumber),
      options: {
        allowedTools: ["Task", "mcp__github__*"],
        mcpServers: { github: mcpServersConfig.github },
        agents: subagents,
        model: process.env.ANTHROPIC_MODEL || "sonnet",
        outputFormat: {
          type: "json_schema",
          schema: ReviewReportJSONSchema,
        },
        maxTurns: 15,
      },
    })) {
      // Synthetic assistant messages are produced by the SDK when the API call itself failed
      // (e.g. invalid API key); fail fast instead of looping until max turns.
      if (message.type === "assistant" && message.message.model === "<synthetic>") {
        const text = message.message.content
          .map((block: { type: string; text?: string }) => (block.type === "text" ? block.text : ""))
          .join(" ")
          .trim();
        throw new Error(`Claude API call failed: ${text || "unknown error"}`);
      }

      if (message.type === "result" && message.subtype === "success" && message.structured_output) {
        const result = ReviewReportSchema.safeParse(message.structured_output);
        if (result.success) {
          return result.data;
        } else {
          throw new Error("Failed to validate code review report");
        }
      } else if (message.type === "result") {
        throw new Error(`Code Review failed: ${message.subtype} `);
      }
    }

     throw new Error("Failed to generate code review report");
  }
}
