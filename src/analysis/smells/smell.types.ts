export interface ArchitectureSmell {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  module?: string;
}