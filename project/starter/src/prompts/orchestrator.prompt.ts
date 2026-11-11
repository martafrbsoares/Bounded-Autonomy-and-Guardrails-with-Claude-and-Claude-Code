export async function* buildOrchestratorPrompt(owner: string, repo: string, prNumber: number) {
    yield {
        type: "user" as const,
        message: { role: "user" as const, content: 
        `
            You are an code review orchestrator. Your goal is to coordinate multiple subagents to analyze and improve
            the code.

            You have access to three subagents via the Task tool:
            - code-quality-analyzer: Analyzes code quality
            - test-coverage-analyzer: Analyzes test coverage
            - refactoring-suggester: Suggests code refactorings to improve quality and maintainability

            ...

            WORKFLOW:
            1. Fetch PR data using GitHub MCP tools. The owner is ${owner} and the repository is ${repo}. The pull
            request number is ${prNumber}.
            2. Use code-quality-analyzer to analyze code quality, use test-coverage-analyzer to analyze test coverage
            and use refactoring-suggester to suggest code refactorings. The subagents cannot access GitHub, so include
            the PR description, changed file names and diffs/file contents directly in each Task prompt.
            Important: run these agents IN PARALLEL!
            3. Aggregate the results from all subagents and compile a comprehensive code review briefing. The report 
            should conform to the schema of ReviewReportSchema.

            ...

            Return the briefing as structured JSON.
        `
        },
        parent_tool_use_id: null,
        session_id: "code-review-session",
    };
}