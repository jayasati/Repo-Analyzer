export interface AnalysisJobData {
  jobId: string;
  source: string;
  isGitHub: boolean;
  requestedAt: string;
  branch?: string;
  subdir?: string;
  /** PR number (set when triggered by pull_request webhook) */
  prNumber?: number;
  /** PR head commit SHA (for commit status updates) */
  prHeadSha?: string;
}

export type JobStatus =
  | 'queued'
  | 'cloning'
  | 'scanning'
  | 'analyzing'
  | 'complete'
  | 'failed';

export interface JobProgressEvent {
  jobId: string;
  status: JobStatus;
  message: string;
  progress: number; // 0–100
}
