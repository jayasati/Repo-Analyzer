/**
 * import-extractor.ts
 *
 * Extracts import/dependency paths from source files.
 * Supports 20 languages. Each language section is self-contained
 * so patterns are easy to audit and extend.
 *
 * IMPORTANT: every RegExp is created fresh per call (no shared lastIndex).
 */

// ── Language tag union ────────────────────────────────────────────────────────
export type SupportedLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'go'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'rust'
  | 'kotlin'
  | 'swift'
  | 'scala'
  | 'dart'
  | 'elixir'
  | 'c'
  | 'cpp'
  | 'unknown';

// ── Extension → language map (used by callers that detect by file path) ───────
export const EXT_TO_LANGUAGE: Readonly<Record<string, SupportedLanguage>> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.go': 'go',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.rs': 'rust',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.swift': 'swift',
  '.scala': 'scala',
  '.sc': 'scala',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
};

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Extracts all import paths from the given source content.
 *
 * @param content  Raw file content as a string.
 * @param language Optional hint for more accurate extraction.
 *                 When omitted the function tries all pattern groups.
 */
export function extractImports(
  content: string,
  language: SupportedLanguage = 'unknown',
): string[] {
  const results = new Set<string>();

  const add = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      // Recreate the RegExp each call to reset lastIndex
      const re = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const val = match[1]?.trim();
        if (val) results.add(val);
      }
    }
  };

  switch (language) {
    case 'typescript':
    case 'javascript':
      add(PATTERNS.ts);
      break;

    case 'python':
      add(PATTERNS.python);
      break;

    case 'java':
      add(PATTERNS.java);
      break;

    case 'go':
      add(PATTERNS.go);
      break;

    case 'csharp':
      add(PATTERNS.csharp);
      break;

    case 'ruby':
      add(PATTERNS.ruby);
      break;

    case 'php':
      add(PATTERNS.php);
      break;

    case 'rust':
      add(PATTERNS.rust);
      break;

    case 'kotlin':
      add(PATTERNS.kotlin);
      break;

    case 'swift':
      add(PATTERNS.swift);
      break;

    case 'scala':
      add(PATTERNS.scala);
      break;

    case 'dart':
      add(PATTERNS.dart);
      break;

    case 'elixir':
      add(PATTERNS.elixir);
      break;

    case 'c':
    case 'cpp':
      add(PATTERNS.c_cpp);
      break;

    default:
      // Unknown language — run all pattern groups.
      // Less accurate but still catches the most common styles.
      for (const group of Object.values(PATTERNS)) {
        add(group);
      }
  }

  return Array.from(results);
}

// ── Pattern library ───────────────────────────────────────────────────────────
//
// Each group is an array of RegExp objects.
// Capture group 1 must always be the import path / module identifier.
// Patterns are intentionally kept narrow to avoid false positives.

const PATTERNS: Readonly<Record<string, RegExp[]>> = {
  // ─── TypeScript / JavaScript ───────────────────────────────────────────────
  // Covers: ES static imports, dynamic imports, CommonJS require,
  //         export … from, re-exports, side-effect imports.
  ts: [
    // import ... from 'path'  (named, default, type, namespace)
    /import\s+(?:type\s+)?(?:[\w*{},\s]+\s+from\s+)?['"]([^'"]+)['"]/g,

    // export { ... } from 'path'
    /export\s+(?:type\s+)?(?:[\w*{},\s]+\s+)?from\s+['"]([^'"]+)['"]/g,

    // const x = require('path')  /  require('path')
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,

    // import('path') — dynamic import
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ],

  // ─── Python ───────────────────────────────────────────────────────────────
  // Covers: from x import y, import x, import x.y.z
  // Captures the module path (dotted or plain), not the symbol.
  python: [
    // from module.sub import name
    /^\s*from\s+([.\w]+)\s+import\s+/gm,

    // import module  /  import module.sub
    /^\s*import\s+([\w.]+)/gm,
  ],

  // ─── Java ─────────────────────────────────────────────────────────────────
  // import com.example.Foo;
  // import static com.example.Util.*;
  java: [/^\s*import\s+(?:static\s+)?([\w.]+(?:\.\*)?)\s*;/gm],

  // ─── Go ───────────────────────────────────────────────────────────────────
  // import "fmt"
  // import ( "fmt" \n "github.com/gin-gonic/gin" )
  // import alias "pkg"
  go: [
    // single-line: import "path"  or  import alias "path"
    /^\s*import\s+(?:[\w.]+\s+)?["']([^"']+)["']/gm,

    // multi-line block: each line inside import (...)
    /^\s*(?:[\w.]+\s+)?["']([^"']+)["']/gm,
  ],

  // ─── C# ───────────────────────────────────────────────────────────────────
  // using System;
  // using System.Collections.Generic;
  // using static System.Math;
  // global using Foo.Bar;
  csharp: [/^\s*(?:global\s+)?using\s+(?:static\s+)?([\w.]+)\s*;/gm],

  // ─── Ruby ─────────────────────────────────────────────────────────────────
  // require 'active_record'
  // require_relative './user'
  // include ActiveRecord::Base  (mixin — captures the module constant)
  ruby: [
    /^\s*require\s+['"]([^'"]+)['"]/gm,
    /^\s*require_relative\s+['"]([^'"]+)['"]/gm,
    /^\s*autoload\s+:\w+\s*,\s*['"]([^'"]+)['"]/gm,
    /^\s*include\s+([\w:]+)/gm,
    /^\s*extend\s+([\w:]+)/gm,
  ],

  // ─── PHP ──────────────────────────────────────────────────────────────────
  // use App\Http\Controllers\Controller;
  // use App\Models\User as UserModel;
  // require_once __DIR__.'/path.php';
  php: [
    // PSR-4 use statement (most important for architecture)
    /^\s*use\s+([\w\\]+)(?:\s+as\s+\w+)?\s*;/gm,

    // use function / use const
    /^\s*use\s+(?:function|const)\s+([\w\\]+)\s*;/gm,

    // require / include variants
    /(?:require|include)(?:_once)?\s*\(?['"]([^'"]+)['"]\)?/gm,
  ],

  // ─── Rust ─────────────────────────────────────────────────────────────────
  // use std::collections::HashMap;
  // use crate::models::User;
  // use super::config;
  // extern crate serde;
  rust: [
    // use path::to::item (with optional 'pub')
    /^\s*(?:pub\s+)?use\s+([\w:]+(?:::\{[^}]+\})?)/gm,

    // extern crate name
    /^\s*extern\s+crate\s+(\w+)/gm,

    // mod declarations (intra-crate, still a dependency)
    /^\s*(?:pub\s+)?mod\s+(\w+)\s*;/gm,
  ],

  // ─── Kotlin ───────────────────────────────────────────────────────────────
  // import com.example.User
  // import com.example.*
  // import kotlin.collections.List
  kotlin: [/^\s*import\s+([\w.]+(?:\.\*)?)/gm],

  // ─── Swift ────────────────────────────────────────────────────────────────
  // import Foundation
  // import UIKit
  // import MyFramework.MyModule  (@_implementationOnly import also supported)
  swift: [/^\s*(?:@_implementationOnly\s+)?import\s+([\w.]+)/gm],

  // ─── Scala ────────────────────────────────────────────────────────────────
  // import scala.collection.mutable.Map
  // import scala.collection.{List, Map}
  // import com.example._
  scala: [/^\s*import\s+([\w.]+(?:\._|\.\{[^}]+\})?)/gm],

  // ─── Dart ─────────────────────────────────────────────────────────────────
  // import 'dart:core';
  // import 'package:flutter/material.dart';
  // import '../models/user.dart' as user;
  // export 'src/foo.dart';
  // part 'src/bar.dart';
  dart: [
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    /^\s*export\s+['"]([^'"]+)['"]/gm,
    /^\s*part\s+['"]([^'"]+)['"]/gm,
  ],

  // ─── Elixir ───────────────────────────────────────────────────────────────
  // import MyApp.Router
  // alias MyApp.User
  // use Phoenix.Controller
  // require Logger
  elixir: [
    /^\s*import\s+([\w.]+)/gm,
    /^\s*alias\s+([\w.]+)/gm,
    /^\s*use\s+([\w.]+)/gm,
    /^\s*require\s+([\w.]+)/gm,
  ],

  // ─── C / C++ ──────────────────────────────────────────────────────────────
  // #include <stdio.h>
  // #include "myheader.h"
  c_cpp: [/#include\s+[<"]([^>"]+)[>"]/g],
};
