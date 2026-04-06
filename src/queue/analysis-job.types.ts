export interface AnalysisJobData {
  jobId: string;
  source: string;
  isGitHub: boolean;
  requestedAt: string;
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
