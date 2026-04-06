/**
 * WHY this matters for correctness, not just speed:
 *
 * If node_modules is scanned, the PackageGraphService will extract
 * package names from library internals and produce bogus architecture
 * edges. vendor/ in Go/PHP, __pycache__ in Python, target/ in Rust/Java,
 * and .venv in Python all have the same problem.
 *
 * Security: .git/hooks can contain arbitrary executables — never read them.
 */
export const DEFAULT_IGNORED_FOLDERS: ReadonlyArray<string> = [
  // JS / TS
  'node_modules',
  '.pnp',
  '.yarn',

  // Build outputs
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '.svelte-kit',

  // Go
  'vendor',

  // Python
  '__pycache__',
  '.venv',
  'venv',
  '.tox',
  'site-packages',

  // Java / Kotlin / Scala
  'target',
  '.gradle',
  '.mvn',

  // Rust
  'target', // also covers Rust target/

  // .NET
  'obj',
  'bin',
  'packages',

  // Ruby
  '.bundle',

  // PHP
  'vendor', // also covers PHP composer vendor/

  // Flutter/Dart
  '.dart_tool',
  '.pub-cache',

  // IDE / VCS / OS
  '.git',
  '.idea',
  '.vscode',
  '.DS_Store',

  // Tooling caches
  '.cache',
  '.tmp',
  'coverage',
  '.nyc_output',

  // Generated / lock dirs
  'generated',
  '__generated__',
];
