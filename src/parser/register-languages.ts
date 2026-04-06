/// <reference path="../types/tree-sitter-languages.d.ts" />

import TypeScript from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Java from 'tree-sitter-java';
import Go from 'tree-sitter-go';
import CSharp from 'tree-sitter-c-sharp';
import Ruby from 'tree-sitter-ruby';
import Php from 'tree-sitter-php';
import Rust from 'tree-sitter-rust';
import Kotlin from 'tree-sitter-kotlin';
import Swift from 'tree-sitter-swift';
import Scala from 'tree-sitter-scala';
import Dart from 'tree-sitter-dart';
import Elixir from 'tree-sitter-elixir';

import { LanguageRegistry } from './language-registry.service';

export function registerLanguages(registry: LanguageRegistry): void {
  // TypeScript / JavaScript share the same grammar
  registry.register('typescript', TypeScript.typescript);
  registry.register('javascript', TypeScript.tsx); // tsx grammar covers JS too

  registry.register('python', Python);
  registry.register('java', Java);
  registry.register('go', Go);
  registry.register('csharp', CSharp);
  registry.register('ruby', Ruby);
  // tree-sitter-php exposes { php } (the grammar object)
  registry.register('php', (Php as any).php ?? Php);
  registry.register('rust', Rust);
  registry.register('kotlin', Kotlin);
  registry.register('swift', Swift);
  registry.register('scala', Scala);
  registry.register('dart', Dart);
  registry.register('elixir', Elixir);
}
