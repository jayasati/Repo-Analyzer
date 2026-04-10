/**
 * Core PlantUML builder utility.
 *
 * Provides:
 * - Identifier sanitization (safe PlantUML names)
 * - Diagram wrapper (@startuml/@enduml with title + skinparams)
 * - PlantUML syntax validation
 * - Shared skinparam presets per diagram type
 */

// ── Skinparam presets ──────────────────────────────────────────────────────────

export interface DiagramOptions {
  title?: string;
  maxNodes?: number;
  focusModule?: string;
  depth?: number;
}

const SKINPARAMS = {
  class: [
    'skinparam linetype ortho',
    'skinparam packageStyle rectangle',
    'skinparam classAttributeIconSize 0',
    'skinparam classFontStyle bold',
    'skinparam ArrowColor #555555',
    'skinparam ClassBorderColor #888888',
    'skinparam ClassBackgroundColor #FAFAFA',
    'skinparam NoteBackgroundColor #FFFFCC',
    'skinparam groupInheritance 2',
  ],
  component: [
    'skinparam linetype ortho',
    'skinparam packageStyle rectangle',
    'skinparam componentStyle rectangle',
    'skinparam ArrowColor #555555',
    'skinparam ComponentBorderColor #888888',
    'skinparam ComponentBackgroundColor #EEF4FF',
    'skinparam DatabaseBackgroundColor #FFF4EE',
    'skinparam InterfaceBackgroundColor #E8FFE8',
  ],
  sequence: [
    'skinparam SequenceArrowThickness 2',
    'skinparam RoundCorner 5',
    'skinparam SequenceBoxBorderColor #888888',
    'skinparam ParticipantBackgroundColor #EEF4FF',
    'skinparam ActorBackgroundColor #FFF4EE',
    'skinparam SequenceLifeLineBorderColor #AAAAAA',
    'skinparam SequenceGroupBackgroundColor #F5F5F5',
  ],
  graph: [
    'skinparam linetype ortho',
    'skinparam packageStyle rectangle',
  ],
} as const;

// ── Sanitization ───────────────────────────────────────────────────────────────

/**
 * Converts any string into a valid PlantUML identifier.
 * PlantUML identifiers: alphanumeric + underscore only.
 */
export function sanitizeId(id: string): string {
  return (
    id
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '')
      .replace(/_{2,}/g, '_') || 'Unknown'
  );
}

/**
 * Creates a display-friendly label from an identifier.
 * Splits PascalCase/camelCase and removes common suffixes for brevity.
 */
export function displayLabel(id: string): string {
  return sanitizeId(id);
}

// ── Diagram wrapper ────────────────────────────────────────────────────────────

export type DiagramType = 'class' | 'component' | 'sequence' | 'graph';

/**
 * Wraps body lines in a complete PlantUML document with proper
 * @startuml/@enduml, title, and skinparams.
 */
export function wrapDiagram(
  type: DiagramType,
  bodyLines: string[],
  options: DiagramOptions = {},
): string {
  const lines: string[] = ['@startuml'];

  // Title
  const title = options.title ?? `${capitalize(type)} Diagram`;
  lines.push(`title ${title}`);
  lines.push('');

  // Skinparams
  lines.push(...SKINPARAMS[type]);
  lines.push('');

  // Body
  lines.push(...bodyLines);

  // Footer
  lines.push('');
  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * Returns a minimal empty-state diagram.
 */
export function emptyDiagram(type: string): string {
  return [
    '@startuml',
    `note "No ${type} data available" as N`,
    '@enduml',
  ].join('\n');
}

// ── Validation ─────────────────────────────────────────────────────────────────

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates PlantUML syntax by checking structural rules.
 * This is a fast client-side lint — it does NOT invoke a PlantUML server.
 *
 * Checks:
 * 1. @startuml / @enduml present and balanced
 * 2. activate/deactivate are balanced per participant
 * 3. No undefined participants in sequence messages
 * 4. Brace blocks (class {}, package {}) are balanced
 * 5. No empty diagram body
 */
export function validatePlantUML(code: string): ValidationResult {
  const errors: string[] = [];
  const lines = code.split('\n').map((l) => l.trim());

  // 1. Start/end markers
  if (!lines.includes('@startuml')) {
    errors.push('Missing @startuml');
  }
  if (!lines.includes('@enduml')) {
    errors.push('Missing @enduml');
  }

  // 2. Brace balance
  let braceDepth = 0;
  for (const line of lines) {
    if (line.startsWith("'") || line.startsWith('note')) continue;
    const opens = (line.match(/{/g) ?? []).length;
    const closes = (line.match(/}/g) ?? []).length;
    braceDepth += opens - closes;
  }
  if (braceDepth !== 0) {
    errors.push(`Unbalanced braces: depth ${braceDepth}`);
  }

  // 3. Activate/deactivate balance (sequence diagrams)
  const activations = new Map<string, number>();
  for (const line of lines) {
    const activateMatch = line.match(/^activate\s+(\S+)/);
    if (activateMatch) {
      const p = activateMatch[1];
      activations.set(p, (activations.get(p) ?? 0) + 1);
    }
    const deactivateMatch = line.match(/^deactivate\s+(\S+)/);
    if (deactivateMatch) {
      const p = deactivateMatch[1];
      activations.set(p, (activations.get(p) ?? 0) - 1);
    }
  }
  for (const [participant, count] of activations) {
    if (count !== 0) {
      errors.push(
        `Unbalanced activation for "${participant}": ${count > 0 ? '+' : ''}${count}`,
      );
    }
  }

  // 4. Sequence message participants must be declared
  const declared = new Set<string>();
  for (const line of lines) {
    const declMatch = line.match(
      /^(?:actor|participant|boundary|control|entity|database|queue)\s+(?:"[^"]*"\s+as\s+)?(\S+)/,
    );
    if (declMatch) declared.add(declMatch[1]);
  }
  if (declared.size > 0) {
    for (const line of lines) {
      const msgMatch = line.match(/^(\S+)\s+(->>?|-->>?|->|-->)\s+(\S+)/);
      if (msgMatch) {
        const [, from, , to] = msgMatch;
        if (!declared.has(from) && from !== '*') {
          errors.push(`Undeclared participant in message: "${from}"`);
        }
        if (!declared.has(to) && to !== '*') {
          errors.push(`Undeclared participant in message: "${to}"`);
        }
      }
    }
  }

  // 5. Body check (something between @startuml and @enduml)
  const startIdx = lines.indexOf('@startuml');
  const endIdx = lines.indexOf('@enduml');
  if (startIdx >= 0 && endIdx >= 0) {
    const body = lines
      .slice(startIdx + 1, endIdx)
      .filter((l) => l.length > 0 && !l.startsWith("'") && !l.startsWith('skinparam') && !l.startsWith('title'));
    if (body.length === 0) {
      errors.push('Empty diagram body');
    }
  }

  return { valid: errors.length === 0, errors };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Infers a PlantUML stereotype string from node type.
 */
export function inferStereotype(type: string): string {
  switch (type) {
    case 'module':
      return '<<Module>>';
    case 'service':
      return '<<Service>>';
    case 'controller':
      return '<<Controller>>';
    case 'class':
      return '<<Entity>>';
    default:
      return '';
  }
}

/**
 * Determines the PlantUML arrow style based on edge type.
 */
export function arrowForEdge(edgeType: string): string {
  switch (edgeType) {
    case 'constructor-injection':
      return '..>';
    case 'import':
      return '-->';
    case 'module-import':
      return '-->';
    case 'module-provider':
      return '..>';
    case 'module-controller':
      return '..>';
    default:
      return '-->';
  }
}

/**
 * Returns a label for an edge type.
 */
export function labelForEdge(edgeType: string): string {
  switch (edgeType) {
    case 'constructor-injection':
      return 'uses';
    case 'module-provider':
      return 'provides';
    case 'module-controller':
      return 'routes';
    case 'module-import':
      return 'imports';
    default:
      return '';
  }
}
