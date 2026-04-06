export type SmellType =
  | 'god-module' // module with too many outgoing deps
  | 'hub-dependency' // module depended on by too many others
  | 'dead-module' // module with no incoming or outgoing deps
  | 'circular-dependency' // cycle between modules
  | 'unstable-abstraction' // abstract module with high instability
  | 'god-file' // single file with too many imports
  | 'package-tangle' // bidirectional dependency between packages
  | 'deep-hierarchy' // module chain deeper than threshold
  | 'scattered-functionality'; // same concept split across too many modules

export interface ArchitectureSmell {
  type: SmellType;
  message: string;
  severity: 'low' | 'medium' | 'high';
  module?: string;
  details?: Record<string, unknown>;
}
