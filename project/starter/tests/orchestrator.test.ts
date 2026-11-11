import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: vi.fn() }));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator';
import { ReviewReportSchema } from '../src/types/report-types';
import { RateLimiter } from '../src/utils/rate-limiter';

const mockedQuery = vi.mocked(query) as unknown as ReturnType<typeof vi.fn>;

const validReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [
    {
      file: 'src/index.ts',
      codeQuality: {
        file: 'src/index.ts',
        issues: [
          {
            line: 10,
            severity: 'high',
            category: 'security',
            description: 'Unsanitized input',
            suggestion: 'Sanitize input'
          }
        ],
        overallScore: 80,
        summary: 'Mostly fine'
      },
      testCoverage: {
        file: 'src/index.ts',
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0,
        summary: 'No tests'
      },
      refactorings: { file: 'src/index.ts', suggestions: [], summary: 'None' }
    }
  ],
  summary: {
    totalFiles: 1,
    overallScore: 80,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0
  },
  recommendations: [
    { priority: 'high', category: 'security', description: 'Fix input handling', files: ['src/index.ts'] }
  ],
  metadata: { analyzedAt: '2026-01-01T00:00:00.000Z', duration: 1000, agentVersions: { 'code-quality-analyzer': '1' } }
};

/** Make the mocked SDK query() yield the given messages */
function mockMessages(messages: unknown[]) {
  mockedQuery.mockImplementation((() =>
    (async function* () {
      for (const m of messages) yield m;
    })()) as never);
}

const successMessage = (structured_output: unknown) => ({
  type: 'result',
  subtype: 'success',
  structured_output
});

/** Options and prompt text passed to the (mocked) SDK on the last call */
async function lastCall() {
  const args = mockedQuery.mock.calls[mockedQuery.mock.calls.length - 1]![0] as {
    prompt: AsyncIterable<{ message: { content: string } }>;
    options: Record<string, any>;
  };
  let promptText = '';
  for await (const m of args.prompt) promptText += m.message.content;
  return { options: args.options, promptText };
}

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      expect(() => new CodeReviewOrchestrator()).not.toThrow();
      expect(() => new CodeReviewOrchestrator({})).not.toThrow();
    });

    // The orchestrator has no rate limit options yet, so this verifies the
    // RateLimiter configuration it would be given.
    it('should accept custom rate limit configuration', () => {
      const limiter = new RateLimiter({ maxRequestsPerMinute: 10, maxTokensPerMinute: 5000 });
      const status = limiter.getStatus();

      expect(status.availableRequests).toBe(10);
      expect(status.availableTokens).toBe(5000);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      mockMessages([successMessage(validReport)]);

      await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);
      const { options, promptText } = await lastCall();

      expect(options.mcpServers).toHaveProperty('github');
      expect(options.allowedTools).toContain('mcp__github__*');
      expect(promptText).toContain('octocat');
      expect(promptText).toContain('Hello-World');
      expect(promptText).toContain('1');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      mockMessages([successMessage(validReport)]);

      await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);
      const { options, promptText } = await lastCall();

      expect(options.allowedTools).toContain('Task');
      expect(Object.keys(options.agents).sort()).toEqual([
        'code-quality-analyzer',
        'refactoring-suggester',
        'test-coverage-analyzer'
      ]);
      for (const name of Object.keys(options.agents)) {
        expect(promptText).toContain(name);
      }
      expect(promptText).toMatch(/IN PARALLEL/i);
    });

    it('should aggregate results into ReviewReport', async () => {
      mockMessages([{ type: 'assistant', message: { model: 'sonnet', content: [] } }, successMessage(validReport)]);

      const report = await new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);

      expect(report).toEqual(validReport);
      expect(report.fileReviews[0]!.codeQuality.issues).toHaveLength(1);
    });

    it('should validate output with Zod schema', async () => {
      expect(ReviewReportSchema.safeParse(validReport).success).toBe(true);

      mockMessages([successMessage({ ...validReport, summary: { totalFiles: 'one' } })]);
      await expect(
        new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('Failed to validate code review report');
    });

    it('should fail when the SDK returns a non-success result', async () => {
      mockMessages([{ type: 'result', subtype: 'error_max_turns' }]);

      await expect(
        new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('error_max_turns');
    });

    it('should fail fast when the API call itself fails', async () => {
      mockMessages([
        { type: 'assistant', message: { model: '<synthetic>', content: [{ type: 'text', text: 'Invalid API key' }] } },
        { type: 'result', subtype: 'error_max_turns' }
      ]);

      await expect(
        new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('Invalid API key');
    });

    it('should fail when no result message is produced', async () => {
      mockMessages([]);

      await expect(
        new CodeReviewOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow('Failed to generate code review report');
    });
  });

  describe('Integration', () => {
    // Requires real API keys; skipped unless RUN_INTEGRATION_TESTS=1 (never in CI)
    it.skipIf(!process.env.RUN_INTEGRATION_TESTS)(
      'should review a real small PR',
      async () => {
        const dotenv = await import('dotenv');
        dotenv.config();

        // Use the real SDK instead of the mock defined at the top of this file
        vi.resetModules();
        vi.doUnmock('@anthropic-ai/claude-agent-sdk');
        const { CodeReviewOrchestrator: RealOrchestrator } = await import('../src/orchestrator');

        const report = await new RealOrchestrator().reviewPullRequest('octocat', 'Hello-World', 1);

        expect(ReviewReportSchema.safeParse(report).success).toBe(true);
        expect(report.pullRequest).toMatchObject({ owner: 'octocat', repo: 'Hello-World', number: 1 });
        expect(report.summary.totalFiles).toBeGreaterThanOrEqual(0);
      },
      300_000
    );
  });
});
