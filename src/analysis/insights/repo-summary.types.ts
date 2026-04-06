export interface RepoSummary {
  project: string;

  language?: string;

  framework?: string;

  files: number;

  dependencies: number;

  modules: number;

  cycles: number;

  smells: number;

  architectureScore: number;
}
