import * as fs from 'fs-extra';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import {
  SemanticAnalyzer,
  SemanticResult,
} from '../interfaces/semantic-analyzer.interface';
import { TreeSitterParserService } from '../../parser/tree-sitter-parser.service';
import { DEFAULT_IGNORED_FOLDERS } from '../../shared/constants/ignore-folders';
import {
  EXT_TO_LANGUAGE,
  SupportedLanguage,
} from '../../structural/import-extractor';

// ── Constants ─────────────────────────────────────────────────────────────────

const SUPPORTED_LANGUAGES = new Set([
  'TypeScript',
  'JavaScript',
  'Python',
  'Java',
  'Go',
  'C#',
  'Ruby',
  'PHP',
  'Rust',
  'Kotlin',
  'Swift',
  'Scala',
  'Dart',
  'Elixir',
]);

/** Language name → lowercase key used in registry */
const LANG_NAME_TO_KEY: Readonly<Record<string, string>> = {
  TypeScript: 'typescript',
  JavaScript: 'javascript',
  Python: 'python',
  Java: 'java',
  Go: 'go',
  'C#': 'csharp',
  Ruby: 'ruby',
  PHP: 'php',
  Rust: 'rust',
  Kotlin: 'kotlin',
  Swift: 'swift',
  Scala: 'scala',
  Dart: 'dart',
  Elixir: 'elixir',
};

const PRIMITIVES = new Set([
  // TypeScript / JavaScript
  'string',
  'number',
  'boolean',
  'any',
  'unknown',
  'void',
  'never',
  'object',
  'null',
  'undefined',
  'symbol',
  'bigint',
  // Java / Kotlin / Scala
  'int',
  'float',
  'double',
  'char',
  'byte',
  'long',
  'short',
  'Integer',
  'Float',
  'Double',
  'Long',
  'Short',
  'Boolean',
  'String',
  'List',
  'Map',
  'Set',
  'Array',
  // Go
  'error',
  'bool',
  'int8',
  'int16',
  'int32',
  'int64',
  'uint',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'float32',
  'float64',
  'complex64',
  'complex128',
  'byte',
  'rune',
  // C#
  'var',
  'dynamic',
  'object',
  'Task',
  // Rust
  'i8',
  'i16',
  'i32',
  'i64',
  'i128',
  'isize',
  'u8',
  'u16',
  'u32',
  'u64',
  'u128',
  'usize',
  'f32',
  'f64',
  'str',
  'Self',
]);

// ── Types ─────────────────────────────────────────────────────────────────────

type SemanticNode = { id: string; type: string };
type SemanticEdge = { from: string; to: string; type: string };

// ── Analyzer ──────────────────────────────────────────────────────────────────

@Injectable()
export class TreeSitterAnalyzer implements SemanticAnalyzer {
  private readonly parser = new TreeSitterParserService();

  supports(language: string): boolean {
    return SUPPORTED_LANGUAGES.has(language);
  }

  analyze(projectPath: string): SemanticResult {
    const nodes: SemanticNode[] = [];
    const edges: SemanticEdge[] = [];

    this.walkDir(projectPath, (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const langKey = EXT_TO_LANGUAGE[ext];
      if (!langKey) return;

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.trim()) return;

        this.parser.setLanguage(langKey);
        const tree = this.parser.parse(content);
        this.extractFromTree(tree, langKey, nodes, edges);
      } catch {
        // Skip unparseable files — never let semantic analysis crash the pipeline
      }
    });

    return { nodes, edges };
  }

  // ── Dispatch per language ──────────────────────────────────────────────────

  private extractFromTree(
    tree: any,
    langKey: string,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    switch (langKey) {
      case 'typescript':
      case 'javascript':
        return this.extractTS(tree, nodes, edges);

      case 'python':
        return this.extractPython(tree, nodes, edges);

      case 'java':
        return this.extractJava(tree, nodes, edges);

      case 'go':
        return this.extractGo(tree, nodes, edges);

      case 'csharp':
        return this.extractCSharp(tree, nodes, edges);

      case 'ruby':
        return this.extractRuby(tree, nodes, edges);

      case 'php':
        return this.extractPhp(tree, nodes, edges);

      case 'rust':
        return this.extractRust(tree, nodes, edges);

      case 'kotlin':
        return this.extractKotlin(tree, nodes, edges);

      case 'swift':
        return this.extractSwift(tree, nodes, edges);

      case 'scala':
        return this.extractScala(tree, nodes, edges);

      case 'dart':
        return this.extractDart(tree, nodes, edges);

      case 'elixir':
        return this.extractElixir(tree, nodes, edges);
    }
  }

  // ── TypeScript / JavaScript ────────────────────────────────────────────────
  //
  // Node types in tree: class_declaration, method_definition (constructor),
  // required_parameter, optional_parameter, type_annotation, type_identifier.
  // NestJS naming convention → module / service / controller / class.

  private extractTS(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (this.isClassNode(node.type)) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveNodeTypeByName(name) });
          this.extractConstructorEdgesTS(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private extractConstructorEdgesTS(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      const isConstructor =
        (node.type === 'method_definition' &&
          node.childForFieldName('name')?.text === 'constructor') ||
        node.type === 'constructor_declaration';

      if (isConstructor) {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            const typeName = this.extractTSParamType(param);
            if (typeName && this.isUserType(typeName)) {
              edges.push({
                from: className,
                to: typeName,
                type: 'constructor-injection',
              });
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  private extractTSParamType(param: any): string | null {
    if (
      param.type === 'required_parameter' ||
      param.type === 'optional_parameter'
    ) {
      const typeAnnotation = param.childForFieldName('type');
      if (typeAnnotation) return this.resolveTypeAnnotation(typeAnnotation);
    }
    return null;
  }

  private resolveTypeAnnotation(node: any): string | null {
    if (node.type === 'type_annotation') {
      const inner = node.children.find(
        (c: any) =>
          c.type === 'type_identifier' ||
          c.type === 'predefined_type' ||
          c.type === 'generic_type',
      );
      if (!inner) return null;
      if (inner.type === 'generic_type')
        return inner.childForFieldName('name')?.text ?? null;
      return inner.text.trim();
    }
    if (node.type === 'type_identifier') return node.text.trim();
    return null;
  }

  // ── Python ────────────────────────────────────────────────────────────────
  //
  // Node types: class_definition, function_definition, parameters, identifier.
  // Django: class names ending in View / ViewSet / Model / Form / Serializer.
  // Flask / FastAPI: no class convention — emit function nodes for route handlers.

  private extractPython(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'class_definition') {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolvePythonNodeType(name) });
          this.extractPythonInitEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private extractPythonInitEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      // Find __init__ method
      if (
        node.type === 'function_definition' &&
        node.childForFieldName('name')?.text === '__init__'
      ) {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            // Type-annotated params: name: SomeClass
            if (
              param.type === 'typed_parameter' ||
              param.type === 'typed_default_parameter'
            ) {
              const typeNode = param.children.find(
                (c: any) => c.type === 'type',
              );
              const typeName = typeNode?.text?.trim();
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  private resolvePythonNodeType(name: string): string {
    if (name.endsWith('View') || name.endsWith('ViewSet')) return 'controller';
    if (name.endsWith('Model')) return 'class';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('Serializer') || name.endsWith('Schema')) return 'class';
    if (name.endsWith('App') || name.endsWith('Config')) return 'module';
    return 'class';
  }

  // ── Java ──────────────────────────────────────────────────────────────────
  //
  // Node types: class_declaration, constructor_declaration, formal_parameter,
  // type_identifier.  Spring conventions: @Controller / @Service / @Component.

  private extractJava(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration'
      ) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          const annotations = this.collectJavaAnnotations(node);
          nodes.push({
            id: name,
            type: this.resolveJavaNodeType(name, annotations),
          });
          this.extractJavaConstructorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private collectJavaAnnotations(classNode: any): string[] {
    const annotations: string[] = [];
    for (const child of classNode.children) {
      if (child.type === 'modifiers') {
        for (const mod of child.children) {
          if (mod.type === 'annotation') {
            const name = mod.childForFieldName('name')?.text;
            if (name) annotations.push(name);
          }
        }
      }
    }
    return annotations;
  }

  private resolveJavaNodeType(name: string, annotations: string[]): string {
    if (
      annotations.some((a) =>
        ['Controller', 'RestController', 'RequestMapping'].includes(a),
      )
    )
      return 'controller';
    if (
      annotations.some((a) =>
        ['Service', 'Component', 'Repository'].includes(a),
      )
    )
      return 'service';
    if (
      annotations.some((a) =>
        ['Configuration', 'SpringBootApplication'].includes(a),
      )
    )
      return 'module';
    // Fallback to name convention
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('Config') || name.endsWith('Application'))
      return 'module';
    return 'class';
  }

  private extractJavaConstructorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'constructor_declaration') {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            if (param.type === 'formal_parameter') {
              const typeNode = param.childForFieldName('type');
              const typeName = typeNode?.text?.trim();
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  // ── Go ────────────────────────────────────────────────────────────────────
  //
  // Go has no classes; architectural units are struct types + constructor
  // functions (NewXxx). We emit struct type_spec nodes as 'class' and look
  // for NewXxx functions returning a struct to build injection edges.

  private extractGo(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const structs = new Set<string>();

    // First pass: collect all struct names
    const collectStructs = (node: any) => {
      if (node.type === 'type_spec') {
        const name = node.childForFieldName('name')?.text;
        const typeNode = node.childForFieldName('type');
        if (name && typeNode?.type === 'struct_type') {
          structs.add(name);
          nodes.push({ id: name, type: this.resolveGoNodeType(name) });
        }
      }
      for (const child of node.children) collectStructs(child);
    };
    collectStructs(tree.rootNode);

    // Second pass: find New* constructor functions and extract parameter types
    const collectConstructors = (node: any) => {
      if (node.type === 'function_declaration') {
        const name = node.childForFieldName('name')?.text ?? '';
        if (name.startsWith('New') && structs.has(name.slice(3))) {
          const returnType = name.slice(3);
          const params = node.childForFieldName('parameters');
          if (params) {
            for (const param of params.children) {
              if (param.type === 'parameter_declaration') {
                const typeNode = param.childForFieldName('type');
                const typeName = this.unwrapGoPointer(typeNode?.text?.trim());
                if (typeName && structs.has(typeName)) {
                  edges.push({
                    from: returnType,
                    to: typeName,
                    type: 'constructor-injection',
                  });
                }
              }
            }
          }
        }
      }
      for (const child of node.children) collectConstructors(child);
    };
    collectConstructors(tree.rootNode);
  }

  private resolveGoNodeType(name: string): string {
    if (name.endsWith('Handler') || name.endsWith('Controller'))
      return 'controller';
    if (
      name.endsWith('Service') ||
      name.endsWith('Repository') ||
      name.endsWith('Store')
    )
      return 'service';
    if (
      name.endsWith('Router') ||
      name.endsWith('Server') ||
      name.endsWith('App')
    )
      return 'module';
    return 'class';
  }

  private unwrapGoPointer(type: string | undefined): string | null {
    if (!type) return null;
    return type.startsWith('*') ? type.slice(1) : type;
  }

  // ── C# ────────────────────────────────────────────────────────────────────
  //
  // Node types: class_declaration, constructor_declaration, parameter,
  // type (identifier / generic_name).  ASP.NET: Controller / Service / Repository.

  private extractCSharp(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'class_declaration' ||
        node.type === 'interface_declaration'
      ) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveCSharpNodeType(name) });
          this.extractCSharpConstructorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolveCSharpNodeType(name: string): string {
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (
      name.endsWith('Module') ||
      name.endsWith('Startup') ||
      name.endsWith('Program')
    )
      return 'module';
    return 'class';
  }

  private extractCSharpConstructorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'constructor_declaration') {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            if (param.type === 'parameter') {
              const typeNode = param.childForFieldName('type');
              const typeName = this.unwrapCSharpGeneric(typeNode?.text?.trim());
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  private unwrapCSharpGeneric(type: string | undefined): string | null {
    if (!type) return null;
    // IRepository<User> → User, List<UserService> → UserService
    const match = type.match(/^I?(\w+?)(?:<(\w+)>)?$/);
    if (!match) return type;
    return match[2] ?? match[1]; // prefer the generic arg if present
  }

  // ── Ruby ──────────────────────────────────────────────────────────────────
  //
  // Node types: class, method (initialize). Rails conventions:
  // ApplicationController, ApplicationRecord, ApplicationJob, etc.

  private extractRuby(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'class') {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveRubyNodeType(name) });
          this.extractRubyInitializeEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolveRubyNodeType(name: string): string {
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('Application') || name.endsWith('Engine'))
      return 'module';
    if (name.endsWith('Record') || name.endsWith('Model')) return 'class';
    return 'class';
  }

  private extractRubyInitializeEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'method' &&
        node.childForFieldName('name')?.text === 'initialize'
      ) {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            // Ruby has no type annotations — only emit edges for CamelCase identifiers
            const name =
              param.childForFieldName('name')?.text ?? param.text?.trim();
            if (name && /^[A-Z]/.test(name) && this.isUserType(name)) {
              edges.push({
                from: className,
                to: name,
                type: 'constructor-injection',
              });
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  // ── PHP ───────────────────────────────────────────────────────────────────
  //
  // Node types: class_declaration, method_declaration (__construct),
  // simple_parameter, named_type.

  private extractPhp(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'class_declaration') {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolvePhpNodeType(name) });
          this.extractPhpConstructorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolvePhpNodeType(name: string): string {
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('ServiceProvider') || name.endsWith('Kernel'))
      return 'module';
    return 'class';
  }

  private extractPhpConstructorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'method_declaration' &&
        node.childForFieldName('name')?.text === '__construct'
      ) {
        const params = node.childForFieldName('parameters');
        if (params) {
          for (const param of params.children) {
            if (
              param.type === 'simple_parameter' ||
              param.type === 'promoted_property_parameter'
            ) {
              const typeNode = param.childForFieldName('type');
              const typeName = typeNode?.text?.trim();
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  // ── Rust ──────────────────────────────────────────────────────────────────
  //
  // Rust has structs + impl blocks with new() functions.
  // Actix/Axum handlers are functions, not classes; we emit struct nodes.

  private extractRust(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const structs = new Set<string>();

    const collectStructs = (node: any) => {
      if (node.type === 'struct_item') {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          structs.add(name);
          nodes.push({ id: name, type: this.resolveRustNodeType(name) });
        }
      }
      for (const child of node.children) collectStructs(child);
    };
    collectStructs(tree.rootNode);

    const collectImpls = (node: any) => {
      if (node.type === 'impl_item') {
        const typeName = node.childForFieldName('type')?.text;
        if (!typeName || !structs.has(typeName)) {
          for (const child of node.children) collectImpls(child);
          return;
        }
        // Look for pub fn new(...)
        for (const child of node.children) {
          if (
            child.type === 'function_item' &&
            child.childForFieldName('name')?.text === 'new'
          ) {
            const params = child.childForFieldName('parameters');
            if (params) {
              for (const param of params.children) {
                if (param.type === 'parameter') {
                  const typeNode = param.childForFieldName('type');
                  const raw = typeNode?.text?.trim();
                  const depName = this.unwrapRustType(raw);
                  if (depName && structs.has(depName)) {
                    edges.push({
                      from: typeName,
                      to: depName,
                      type: 'constructor-injection',
                    });
                  }
                }
              }
            }
          }
          collectImpls(child);
        }
      } else {
        for (const child of node.children) collectImpls(child);
      }
    };
    collectImpls(tree.rootNode);
  }

  private resolveRustNodeType(name: string): string {
    if (name.endsWith('Handler') || name.endsWith('Controller'))
      return 'controller';
    if (
      name.endsWith('Service') ||
      name.endsWith('Repository') ||
      name.endsWith('Store')
    )
      return 'service';
    if (
      name.endsWith('App') ||
      name.endsWith('Server') ||
      name.endsWith('Router')
    )
      return 'module';
    return 'class';
  }

  private unwrapRustType(raw: string | undefined): string | null {
    if (!raw) return null;
    // &SomeType  →  SomeType
    // Arc<SomeType>  →  SomeType
    // Box<dyn SomeType>  →  SomeType
    return (
      raw
        .replace(/^[&*]+/, '') // strip leading & or *
        .replace(/^(?:Arc|Rc|Box|Mutex|RwLock)<(?:dyn\s+)?(\w+).*>$/, '$1')
        .replace(/^dyn\s+/, '')
        .trim() || null
    );
  }

  // ── Kotlin ────────────────────────────────────────────────────────────────
  //
  // Very similar to Java; primary constructor params are declared in the
  // class header, not a separate constructor body.

  private extractKotlin(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'class_declaration' ||
        node.type === 'object_declaration'
      ) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveNodeTypeByName(name) });
          this.extractKotlinPrimaryCtorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private extractKotlinPrimaryCtorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    // Primary constructor lives directly in class_declaration children
    for (const child of classNode.children) {
      if (child.type === 'primary_constructor') {
        const params = child.childForFieldName('class_parameters') ?? child;
        for (const param of params.children) {
          if (param.type === 'class_parameter') {
            const typeRef = param.childForFieldName('type');
            const typeName = typeRef?.text?.trim();
            if (typeName && this.isUserType(typeName)) {
              edges.push({
                from: className,
                to: typeName,
                type: 'constructor-injection',
              });
            }
          }
        }
        return;
      }
    }
  }

  // ── Swift ─────────────────────────────────────────────────────────────────
  //
  // Node types: class_declaration, protocol_declaration, init_declaration,
  // parameter (with type_annotation).

  private extractSwift(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'class_declaration' ||
        node.type === 'struct_declaration'
      ) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveSwiftNodeType(name) });
          this.extractSwiftInitEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolveSwiftNodeType(name: string): string {
    if (name.endsWith('Controller') || name.endsWith('ViewController'))
      return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('App') || name.endsWith('Module')) return 'module';
    return 'class';
  }

  private extractSwiftInitEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'init_declaration') {
        const params = node.childForFieldName('function_value_parameters');
        if (params) {
          for (const param of params.children) {
            if (param.type === 'function_value_parameter') {
              const typeAnnotation = param.childForFieldName('type_annotation');
              const typeName = typeAnnotation?.text
                ?.replace(/^:\s*/, '')
                .trim();
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  // ── Scala ─────────────────────────────────────────────────────────────────
  //
  // Primary constructor params are in the class definition itself.
  // Node types: class_definition, object_definition, class_parameters,
  // class_parameter, type (simple_type / generic_type).

  private extractScala(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'class_definition' ||
        node.type === 'object_definition' ||
        node.type === 'trait_definition'
      ) {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveNodeTypeByName(name) });
          this.extractScalaCtorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private extractScalaCtorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    for (const child of classNode.children) {
      if (child.type === 'class_parameters') {
        for (const param of child.children) {
          if (param.type === 'class_parameter') {
            const typeNode = param.childForFieldName('param_type');
            const typeName = typeNode?.text?.trim();
            if (typeName && this.isUserType(typeName)) {
              edges.push({
                from: className,
                to: typeName,
                type: 'constructor-injection',
              });
            }
          }
        }
      }
    }
  }

  // ── Dart ──────────────────────────────────────────────────────────────────
  //
  // Node types: class_declaration, constructor_signature, formal_parameter_list,
  // normal_formal_parameter.

  private extractDart(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'class_declaration') {
        const name = node.childForFieldName('name')?.text;
        if (name) {
          nodes.push({ id: name, type: this.resolveDartNodeType(name) });
          this.extractDartCtorEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolveDartNodeType(name: string): string {
    if (
      name.endsWith('Widget') ||
      name.endsWith('Screen') ||
      name.endsWith('Page')
    )
      return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    if (name.endsWith('App') || name.endsWith('Module')) return 'module';
    return 'class';
  }

  private extractDartCtorEdges(
    classNode: any,
    className: string,
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (node.type === 'constructor_signature') {
        const params =
          node.childForFieldName('formals') ??
          node.children.find((c: any) => c.type === 'formal_parameter_list');
        if (params) {
          for (const param of params.children) {
            if (param.type === 'normal_formal_parameter') {
              const typeNode = param.childForFieldName('type');
              const typeName = typeNode?.text?.trim();
              if (typeName && this.isUserType(typeName)) {
                edges.push({
                  from: className,
                  to: typeName,
                  type: 'constructor-injection',
                });
              }
            }
          }
        }
        return;
      }
      for (const child of node.children) visit(child);
    };
    visit(classNode);
  }

  // ── Elixir ────────────────────────────────────────────────────────────────
  //
  // Elixir has no classes. Architectural units are modules (defmodule).
  // Phoenix: Router, Controller, Channel, Live.
  // We emit one node per defmodule, type inferred from name + 'use' macro.

  private extractElixir(
    tree: any,
    nodes: SemanticNode[],
    edges: SemanticEdge[],
  ): void {
    const visit = (node: any) => {
      if (
        node.type === 'call' &&
        node.childForFieldName('target')?.text === 'defmodule'
      ) {
        const args = node.childForFieldName('arguments');
        const nameNode = args?.children.find((c: any) => c.type === 'alias');
        const name = nameNode?.text;
        if (name) {
          const nodeType = this.resolveElixirNodeType(node);
          nodes.push({ id: name, type: nodeType });
          this.extractElixirUseEdges(node, name, edges);
        }
      }
      for (const child of node.children) visit(child);
    };
    visit(tree.rootNode);
  }

  private resolveElixirNodeType(moduleNode: any): string {
    // Look for 'use Phoenix.Controller' / 'use Phoenix.LiveView' etc inside the module body
    let found = 'module';
    const search = (node: any) => {
      if (
        node.type === 'call' &&
        node.childForFieldName('target')?.text === 'use'
      ) {
        const arg =
          node.childForFieldName('arguments')?.children[0]?.text ?? '';
        if (arg.includes('Controller') || arg.includes('Router')) {
          found = 'controller';
          return;
        }
        if (arg.includes('GenServer') || arg.includes('Agent')) {
          found = 'service';
          return;
        }
      }
      for (const child of node.children) search(child);
    };
    search(moduleNode);
    return found;
  }

  private extractElixirUseEdges(
    moduleNode: any,
    moduleName: string,
    edges: SemanticEdge[],
  ): void {
    // emit edges for any aliased module that is used (injected via use/import)
    const search = (node: any) => {
      if (
        node.type === 'call' &&
        ['alias', 'import', 'use'].includes(
          node.childForFieldName('target')?.text ?? '',
        )
      ) {
        const arg = node
          .childForFieldName('arguments')
          ?.children[0]?.text?.trim();
        if (arg && arg !== moduleName && /^[A-Z]/.test(arg)) {
          edges.push({
            from: moduleName,
            to: arg,
            type: 'constructor-injection',
          });
        }
      }
      for (const child of node.children) search(child);
    };
    search(moduleNode);
  }

  // ── Shared helpers ────────────────────────────────────────────────────────

  /**
   * Classify a class name using the naming conventions shared across
   * TypeScript (NestJS), Kotlin (Spring/Ktor), and Scala.
   */
  private resolveNodeTypeByName(name: string): string {
    if (name.endsWith('Module')) return 'module';
    if (name.endsWith('Controller')) return 'controller';
    if (name.endsWith('Service') || name.endsWith('Repository'))
      return 'service';
    return 'class';
  }

  private isClassNode(type: string): boolean {
    return (
      type === 'class_declaration' ||
      type === 'class' ||
      type === 'class_definition'
    );
  }

  private isUserType(name: string): boolean {
    return (
      !PRIMITIVES.has(name) &&
      !PRIMITIVES.has(name.toLowerCase()) &&
      /^[A-Z]/.test(name)
    );
  }

  // ── Directory walker ──────────────────────────────────────────────────────

  private walkDir(dirPath: string, callback: (filePath: string) => void): void {
    let items: string[];
    try {
      items = fs.readdirSync(dirPath);
    } catch {
      return;
    }

    for (const item of items) {
      if (DEFAULT_IGNORED_FOLDERS.includes(item)) continue;
      const fullPath = path.join(dirPath, item);
      try {
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) this.walkDir(fullPath, callback);
        else callback(fullPath);
      } catch {
        continue;
      }
    }
  }
}
