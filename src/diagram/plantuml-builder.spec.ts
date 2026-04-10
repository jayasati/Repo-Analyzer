import {
  sanitizeId,
  wrapDiagram,
  emptyDiagram,
  validatePlantUML,
  inferStereotype,
  arrowForEdge,
  labelForEdge,
} from './plantuml-builder';

describe('plantuml-builder', () => {
  // ── sanitizeId ──────────────────────────────────────────────────────────────

  describe('sanitizeId', () => {
    it('passes through clean identifiers', () => {
      expect(sanitizeId('UserService')).toBe('UserService');
    });

    it('replaces slashes and dots', () => {
      expect(sanitizeId('src/services/UserService.ts')).toBe(
        'src_services_UserService_ts',
      );
    });

    it('strips leading/trailing underscores', () => {
      expect(sanitizeId('__internal__')).toBe('internal');
    });

    it('collapses consecutive underscores', () => {
      expect(sanitizeId('a//b')).toBe('a_b');
    });

    it('returns Unknown for empty input', () => {
      expect(sanitizeId('')).toBe('Unknown');
    });

    it('handles special characters', () => {
      expect(sanitizeId('@nestjs/common')).toBe('nestjs_common');
    });
  });

  // ── wrapDiagram ─────────────────────────────────────────────────────────────

  describe('wrapDiagram', () => {
    it('wraps body with @startuml and @enduml', () => {
      const result = wrapDiagram('class', ['class Foo {}']);
      expect(result).toContain('@startuml');
      expect(result).toContain('@enduml');
      expect(result).toContain('class Foo {}');
    });

    it('includes title', () => {
      const result = wrapDiagram('class', [], { title: 'My Diagram' });
      expect(result).toContain('title My Diagram');
    });

    it('includes skinparams for diagram type', () => {
      const result = wrapDiagram('sequence', []);
      expect(result).toContain('skinparam SequenceArrowThickness');
    });

    it('uses default title when none provided', () => {
      const result = wrapDiagram('component', []);
      expect(result).toContain('title Component Diagram');
    });
  });

  // ── emptyDiagram ────────────────────────────────────────────────────────────

  describe('emptyDiagram', () => {
    it('produces valid @startuml/@enduml with note', () => {
      const result = emptyDiagram('sequence');
      expect(result).toContain('@startuml');
      expect(result).toContain('@enduml');
      expect(result).toContain('No sequence data available');
    });
  });

  // ── validatePlantUML ────────────────────────────────────────────────────────

  describe('validatePlantUML', () => {
    it('validates correct class diagram', () => {
      const code = [
        '@startuml',
        'class Foo {',
        '}',
        '@enduml',
      ].join('\n');
      const result = validatePlantUML(code);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('detects missing @startuml', () => {
      const result = validatePlantUML('class Foo {}\n@enduml');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing @startuml');
    });

    it('detects missing @enduml', () => {
      const result = validatePlantUML('@startuml\nclass Foo {}');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing @enduml');
    });

    it('detects unbalanced braces', () => {
      const code = '@startuml\nclass Foo {\n@enduml';
      const result = validatePlantUML(code);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unbalanced braces'))).toBe(
        true,
      );
    });

    it('detects unbalanced activation', () => {
      const code = [
        '@startuml',
        'participant A',
        'participant B',
        'activate A',
        'A -> B : call',
        '@enduml',
      ].join('\n');
      const result = validatePlantUML(code);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Unbalanced activation')),
      ).toBe(true);
    });

    it('passes balanced activation', () => {
      const code = [
        '@startuml',
        'participant A',
        'participant B',
        'activate A',
        'A -> B : call',
        'deactivate A',
        '@enduml',
      ].join('\n');
      const result = validatePlantUML(code);
      expect(result.valid).toBe(true);
    });

    it('detects undeclared participants in messages', () => {
      const code = [
        '@startuml',
        'participant A',
        'A -> B : call',
        '@enduml',
      ].join('\n');
      const result = validatePlantUML(code);
      expect(result.valid).toBe(false);
      expect(
        result.errors.some((e) => e.includes('Undeclared participant')),
      ).toBe(true);
    });
  });

  // ── inferStereotype ─────────────────────────────────────────────────────────

  describe('inferStereotype', () => {
    it('returns <<Controller>> for controller type', () => {
      expect(inferStereotype('controller')).toBe('<<Controller>>');
    });

    it('returns <<Service>> for service type', () => {
      expect(inferStereotype('service')).toBe('<<Service>>');
    });

    it('returns empty string for unknown type', () => {
      expect(inferStereotype('something')).toBe('');
    });
  });

  // ── arrowForEdge / labelForEdge ─────────────────────────────────────────────

  describe('arrowForEdge', () => {
    it('returns ..> for constructor-injection', () => {
      expect(arrowForEdge('constructor-injection')).toBe('..>');
    });

    it('returns --> for import', () => {
      expect(arrowForEdge('import')).toBe('-->');
    });
  });

  describe('labelForEdge', () => {
    it('returns "uses" for constructor-injection', () => {
      expect(labelForEdge('constructor-injection')).toBe('uses');
    });

    it('returns empty string for import', () => {
      expect(labelForEdge('import')).toBe('');
    });
  });
});
