import { Injectable } from '@nestjs/common';
import { GithubApiService } from './github-api.service';
import { GateResult } from '../gate/gate.types';
import { AppLoggerService } from '../common/logger/app-logger.service';

/** Marker embedded in bot comments so we can find/update them later. */
const BOT_MARKER = '<!-- repo-analyzer-bot -->';

export interface PRCommentPayload {
  owner: string;
  repo: string;
  prNumber: number;
  accessToken: string;
  jobId: string;
  gateResult: GateResult;
  repoUrl: string;
  /** Optional URL to the full analysis report */
  reportUrl?: string;
}

export interface CommitStatusPayload {
  owner: string;
  repo: string;
  sha: string;
  accessToken: string;
  gateResult: GateResult;
  /** Optional URL to the full analysis report */
  reportUrl?: string;
}

@Injectable()
export class GithubIntegrationService {
  constructor(
    private readonly github: GithubApiService,
    private readonly logger: AppLoggerService,
  ) {}

  /**
   * Posts or updates an analysis summary comment on a GitHub PR.
   * If a previous bot comment exists, it updates it instead of creating a new one.
   */
  async postPRComment(payload: PRCommentPayload): Promise<void> {
    const { owner, repo, prNumber, accessToken, gateResult, jobId, reportUrl } =
      payload;

    const body = this.formatPRComment(gateResult, jobId, reportUrl);

    try {
      // Try to find existing bot comment to update
      const existing = await this.github.findBotComment(
        accessToken,
        owner,
        repo,
        prNumber,
        BOT_MARKER,
      );

      if (existing) {
        await this.github.updatePRComment(
          accessToken,
          owner,
          repo,
          existing.id,
          body,
        );
        this.logger.log(
          `Updated PR #${prNumber} comment (${owner}/${repo})`,
          'GithubIntegration',
        );
      } else {
        await this.github.createPRComment(
          accessToken,
          owner,
          repo,
          prNumber,
          body,
        );
        this.logger.log(
          `Posted PR #${prNumber} comment (${owner}/${repo})`,
          'GithubIntegration',
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to post PR comment on ${owner}/${repo}#${prNumber}: ${msg}`,
        'GithubIntegration',
      );
    }
  }

  /**
   * Sets a commit status check based on gate results.
   */
  async setCommitStatus(payload: CommitStatusPayload): Promise<void> {
    const { owner, repo, sha, accessToken, gateResult, reportUrl } = payload;

    const state = gateResult.passed ? 'success' : 'failure';
    const description = gateResult.summary.slice(0, 140);

    try {
      await this.github.createCommitStatus(
        accessToken,
        owner,
        repo,
        sha,
        state,
        description,
        reportUrl,
      );
      this.logger.log(
        `Set commit status ${state} on ${owner}/${repo}@${sha.slice(0, 7)}`,
        'GithubIntegration',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to set commit status on ${owner}/${repo}@${sha.slice(0, 7)}: ${msg}`,
        'GithubIntegration',
      );
    }
  }

  /**
   * High-level: after analysis completes, find open PRs for the branch,
   * post comments and set commit statuses on all of them.
   */
  async notifyPRs(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
    jobId: string,
    gateResult: GateResult,
    reportUrl?: string,
  ): Promise<void> {
    const prs = await this.github
      .findPRsForBranch(accessToken, owner, repo, branch)
      .catch(() => []);

    for (const pr of prs) {
      // Post PR comment
      await this.postPRComment({
        owner,
        repo,
        prNumber: pr.number,
        accessToken,
        jobId,
        gateResult,
        repoUrl: `https://github.com/${owner}/${repo}`,
        reportUrl,
      });

      // Set commit status on the PR head
      await this.setCommitStatus({
        owner,
        repo,
        sha: pr.head.sha,
        accessToken,
        gateResult,
        reportUrl,
      });
    }
  }

  // ── Comment formatting ──────────────────────────────────────────────────

  private formatPRComment(
    gate: GateResult,
    jobId: string,
    reportUrl?: string,
  ): string {
    const icon = gate.passed ? ':white_check_mark:' : ':x:';
    const statusLabel = gate.passed ? 'PASSED' : 'FAILED';
    const lines: string[] = [
      BOT_MARKER,
      `## ${icon} Architecture Gate ${statusLabel} (Grade ${gate.grade})`,
      '',
      gate.summary,
      '',
    ];

    // Metrics table
    if (gate.metrics.length > 0) {
      lines.push('| Metric | Value | Status |');
      lines.push('|--------|-------|--------|');
      for (const m of gate.metrics) {
        const statusIcon =
          m.status === 'pass' ? ':green_circle:' :
          m.status === 'warn' ? ':yellow_circle:' :
          ':red_circle:';
        const delta =
          m.delta != null
            ? ` (${m.delta >= 0 ? '+' : ''}${m.delta})`
            : '';
        lines.push(
          `| ${m.label} | ${m.current}${delta} | ${statusIcon} ${m.status} |`,
        );
      }
      lines.push('');
    }

    // Violations
    if (gate.violations.length > 0) {
      lines.push('### Violations');
      lines.push('');
      for (const v of gate.violations) {
        const icon = v.severity === 'error' ? ':x:' : ':warning:';
        lines.push(`- ${icon} **${v.rule}**: ${v.message}`);
        if (v.suggestion) {
          lines.push(`  > ${v.suggestion}`);
        }
      }
      lines.push('');
    }

    // Footer
    if (reportUrl) {
      lines.push(`[View full report](${reportUrl})`);
    }
    lines.push('');
    lines.push(
      `<sub>Generated by Repo Analyzer | Job \`${jobId.slice(0, 8)}\`</sub>`,
    );

    return lines.join('\n');
  }
}
