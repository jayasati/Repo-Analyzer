export type ReportFormat = 'markdown' | 'html' | 'json';

export interface ReportOptions {
  format: ReportFormat;
  includeCode: boolean; // include PlantUML source blocks
}
