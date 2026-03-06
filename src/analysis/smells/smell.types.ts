export type SmellType =
  | "god-module"
  | "hub-dependency"
  | "dead-module"
  | "circular-dependency";

export interface ArchitectureSmell {
  type: SmellType;
  message: string;
  severity: "low" | "medium" | "high";
  module?: string;
}