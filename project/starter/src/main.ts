import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { ReportGenerator } from './utils';
import { CodeReviewOrchestrator } from './orchestrator';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  // TODO: Validate command line arguments
  // - Check if owner, repo, and prStr are provided
  // - Convert prStr to number and validate it's a valid integer
  // - Exit with error message if validation fails

  const prNumber = parseInt(prStr || '', 10);
  if (!owner || !repo || isNaN(prNumber)) {
    console.error('Invalid arguments. Usage: npm run dev <owner> <repo> <pr-number>');
    process.exit(1);
  }

  // TODO: Validate authentication (choose ONE method)
  // Students must have either:
  //   - ANTHROPIC_API_KEY environment variable, OR
  //   - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY for Bedrock
  //
  // If using AWS Bedrock:
  //   - Verify AWS_REGION is set
  //   - Log: "🔐 Using AWS Bedrock authentication"
  // If using Anthropic API:
  //   - Log: "🔐 Using Anthropic API authentication"
  // If neither method is configured:
  //   - Exit with clear error message showing both options

  const useBedrock = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
  if (useBedrock) {
    if (!process.env.AWS_REGION) {
      console.error('AWS_REGION must be set when using AWS Bedrock');
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (process.env.ANTHROPIC_API_KEY) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error('No authentication configured. Set either:\n  - ANTHROPIC_API_KEY, or\n  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (+ AWS_REGION) for Bedrock');
    process.exit(1);
  }

  // TODO: Validate ANTHROPIC_MODEL environment variable
  // This is REQUIRED for both authentication methods
  // - For AWS Bedrock: us.anthropic.claude-sonnet-4-5-20250929-v1:0
  // - For Anthropic API: claude-sonnet-4-5-20250929
  // Exit with error if not set

  if (!process.env.ANTHROPIC_MODEL) {
    console.error('ANTHROPIC_MODEL is required (e.g. claude-sonnet-4-5-20250929)');
    process.exit(1);
  }

  try {
    // TODO: Create orchestrator instance
    // TODO: Call .reviewPullRequest(owner, repo, prNumber);
    // TODO: Generate formatted reports using ReportGenerator
    // Hint: Use ReportGenerator to create Markdown, HTML, and JSON reports
    // Save reports to 'reports/' directory with appropriate filenames

    const orchestrator = new CodeReviewOrchestrator();
    const result = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const generator = new ReportGenerator();
    const reportsDir = path.resolve(process.cwd(), 'reports');
    // e.g. 2026-11-11_12-32-33 (local time)
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const runDir = path.join(reportsDir, timestamp);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'report.md'), generator.generateMarkdownReport(result));
    fs.writeFileSync(path.join(runDir, 'report.html'), generator.generateHTMLReport(result));
    fs.writeFileSync(path.join(runDir, 'report.json'), generator.generateJSONReport(result));
    console.log(`📄 Reports saved to ${runDir}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();
