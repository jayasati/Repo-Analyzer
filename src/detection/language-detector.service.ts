import { Injectable } from '@nestjs/common';
import { FileNode } from '../shared/types/file-node.type';
import { DetectionResult, DetectedLanguage } from './detection-result.type';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DetectedFramework =
  // TypeScript / JavaScript
  | 'nestjs' | 'nextjs' | 'angular' | 'express' | 'fastify' | 'koa'
  // Python
  | 'django' | 'flask' | 'fastapi'
  // Java / Kotlin
  | 'spring' | 'micronaut' | 'ktor'
  // Go
  | 'gin' | 'fiber' | 'echo'
  // Ruby
  | 'rails' | 'sinatra'
  // PHP
  | 'laravel' | 'symfony'
  // Rust
  | 'actix' | 'axum' | 'rocket'
  // Swift
  | 'vapor'
  // Elixir
  | 'phoenix'
  // Scala
  | 'play' | 'akka'
  // Dart
  | 'flutter'
  // .NET
  | 'aspnet';

export type DetectedOrm =
  | 'prisma' | 'typeorm' | 'sequelize' | 'mongoose'       // JS/TS ORMs
  | 'hibernate' | 'jpa'                                    // Java
  | 'sqlalchemy' | 'django-orm'                            // Python
  | 'activerecord'                                         // Ruby
  | 'eloquent'                                             // PHP
  | 'diesel' | 'sqlx'                                      // Rust
  | 'exposed' | 'ktorm'                                    // Kotlin
  | 'slick' | 'doobie';                                    // Scala

// ── Fingerprint declarations ───────────────────────────────────────────────────
//
// A fingerprint matches when ANY of its file path signals is found in the
// scanned tree. Order matters: more specific frameworks must come before
// broader ones (e.g. nestjs before express) because we return the first match.

interface FrameworkFingerprint {
  framework: DetectedFramework;
  /** At least one of these file path substrings must exist in the tree */
  fileSignals: string[];
  /** At least one of these package name strings must exist in package.json / build files */
  packageSignals?: string[];
}

interface OrmFingerprint {
  orm: DetectedOrm;
  fileSignals: string[];
  packageSignals?: string[];
}

// Listed in specificity order (most specific first)
const FRAMEWORK_FINGERPRINTS: FrameworkFingerprint[] = [
  // ── TypeScript / JavaScript ────────────────────────────────────────────────
  {
    framework: 'nestjs',
    fileSignals: ['app.module.ts', 'main.ts'],
    packageSignals: ['@nestjs/core', '@nestjs/common'],
  },
  {
    framework: 'nextjs',
    fileSignals: ['next.config.js', 'next.config.ts', 'next.config.mjs', 'pages/_app', 'app/layout.tsx'],
    packageSignals: ['next'],
  },
  {
    framework: 'angular',
    fileSignals: ['angular.json', 'app.module.ts'],
    packageSignals: ['@angular/core'],
  },
  {
    framework: 'fastify',
    fileSignals: [],
    packageSignals: ['fastify'],
  },
  {
    framework: 'koa',
    fileSignals: [],
    packageSignals: ['koa'],
  },
  {
    framework: 'express',
    fileSignals: ['app.js', 'server.js', 'index.js'],
    packageSignals: ['express'],
  },

  // ── Python ────────────────────────────────────────────────────────────────
  {
    framework: 'django',
    fileSignals: ['manage.py', 'settings.py', 'urls.py', 'wsgi.py', 'asgi.py'],
    packageSignals: ['Django', 'django'],
  },
  {
    framework: 'fastapi',
    fileSignals: [],
    packageSignals: ['fastapi'],
  },
  {
    framework: 'flask',
    fileSignals: ['app.py', 'wsgi.py'],
    packageSignals: ['Flask', 'flask'],
  },

  // ── Java / Kotlin ─────────────────────────────────────────────────────────
  {
    framework: 'micronaut',
    fileSignals: ['micronaut-cli.yml', 'application.yml'],
    packageSignals: ['io.micronaut'],
  },
  {
    framework: 'spring',
    fileSignals: ['pom.xml', 'build.gradle', 'application.properties', 'application.yml'],
    packageSignals: ['spring-boot', 'org.springframework'],
  },
  {
    framework: 'ktor',
    fileSignals: ['Application.kt'],
    packageSignals: ['io.ktor'],
  },

  // ── Go ────────────────────────────────────────────────────────────────────
  {
    framework: 'fiber',
    fileSignals: [],
    packageSignals: ['github.com/gofiber/fiber'],
  },
  {
    framework: 'echo',
    fileSignals: [],
    packageSignals: ['github.com/labstack/echo'],
  },
  {
    framework: 'gin',
    fileSignals: [],
    packageSignals: ['github.com/gin-gonic/gin'],
  },

  // ── Ruby ──────────────────────────────────────────────────────────────────
  {
    framework: 'rails',
    fileSignals: ['Gemfile', 'config/routes.rb', 'app/controllers', 'app/models'],
    packageSignals: ['rails'],
  },
  {
    framework: 'sinatra',
    fileSignals: ['Gemfile'],
    packageSignals: ['sinatra'],
  },

  // ── PHP ───────────────────────────────────────────────────────────────────
  {
    framework: 'laravel',
    fileSignals: ['artisan', 'app/Http/Controllers', 'routes/web.php'],
    packageSignals: ['laravel/framework'],
  },
  {
    framework: 'symfony',
    fileSignals: ['symfony.lock', 'config/services.yaml', 'src/Kernel.php'],
    packageSignals: ['symfony/framework-bundle'],
  },

  // ── Rust ──────────────────────────────────────────────────────────────────
  {
    framework: 'actix',
    fileSignals: ['Cargo.toml'],
    packageSignals: ['actix-web'],
  },
  {
    framework: 'axum',
    fileSignals: ['Cargo.toml'],
    packageSignals: ['axum'],
  },
  {
    framework: 'rocket',
    fileSignals: ['Cargo.toml', 'Rocket.toml'],
    packageSignals: ['rocket'],
  },

  // ── Swift ─────────────────────────────────────────────────────────────────
  {
    framework: 'vapor',
    fileSignals: ['Package.swift'],
    packageSignals: ['vapor'],
  },

  // ── Elixir ────────────────────────────────────────────────────────────────
  {
    framework: 'phoenix',
    fileSignals: ['mix.exs', 'lib/endpoint.ex', 'lib/router.ex'],
    packageSignals: ['phoenix'],
  },

  // ── Scala ─────────────────────────────────────────────────────────────────
  {
    framework: 'akka',
    fileSignals: ['build.sbt'],
    packageSignals: ['akka'],
  },
  {
    framework: 'play',
    fileSignals: ['build.sbt', 'conf/routes'],
    packageSignals: ['com.typesafe.play'],
  },

  // ── Dart / Flutter ────────────────────────────────────────────────────────
  {
    framework: 'flutter',
    fileSignals: ['pubspec.yaml', 'lib/main.dart'],
    packageSignals: ['flutter'],
  },

  // ── .NET ──────────────────────────────────────────────────────────────────
  {
    framework: 'aspnet',
    fileSignals: ['Program.cs', 'Startup.cs', 'appsettings.json', '.csproj'],
    packageSignals: ['Microsoft.AspNetCore'],
  },
];

// ORM fingerprints
const ORM_FINGERPRINTS: OrmFingerprint[] = [
  { orm: 'prisma',      fileSignals: ['schema.prisma'],                         packageSignals: ['@prisma/client'] },
  { orm: 'typeorm',     fileSignals: [],                                         packageSignals: ['typeorm'] },
  { orm: 'sequelize',   fileSignals: [],                                         packageSignals: ['sequelize'] },
  { orm: 'mongoose',    fileSignals: [],                                         packageSignals: ['mongoose'] },
  { orm: 'hibernate',   fileSignals: ['hibernate.cfg.xml'],                     packageSignals: ['hibernate'] },
  { orm: 'sqlalchemy',  fileSignals: [],                                         packageSignals: ['sqlalchemy', 'SQLAlchemy'] },
  { orm: 'django-orm',  fileSignals: ['models.py'],                             packageSignals: ['Django'] },
  { orm: 'activerecord',fileSignals: ['Gemfile'],                                packageSignals: ['activerecord'] },
  { orm: 'eloquent',    fileSignals: ['app/Models'],                            packageSignals: ['laravel/framework'] },
  { orm: 'diesel',      fileSignals: ['Cargo.toml'],                            packageSignals: ['diesel'] },
  { orm: 'sqlx',        fileSignals: ['Cargo.toml'],                            packageSignals: ['sqlx'] },
  { orm: 'exposed',     fileSignals: ['build.gradle'],                          packageSignals: ['org.jetbrains.exposed'] },
  { orm: 'slick',       fileSignals: ['build.sbt'],                             packageSignals: ['com.typesafe.slick'] },
];

// ── Extension → language name map ─────────────────────────────────────────────
const EXT_TO_LANGUAGE_NAME: Readonly<Record<string, string>> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript',
  '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript', '.cjs': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.cs': 'C#',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.rs': 'Rust',
  '.kt': 'Kotlin', '.kts': 'Kotlin',
  '.swift': 'Swift',
  '.scala': 'Scala', '.sc': 'Scala',
  '.dart': 'Dart',
  '.ex': 'Elixir', '.exs': 'Elixir',
  '.c': 'C', '.h': 'C',
  '.cpp': 'C++', '.cc': 'C++', '.cxx': 'C++', '.hpp': 'C++',
};

// ── Updated DetectionResult type ──────────────────────────────────────────────
// (also update detection-result.type.ts to match)

@Injectable()
export class LanguageDetectorService {

  // ── Public API ──────────────────────────────────────────────────────────────

  detect(fileTree: FileNode): DetectionResult {
    const { extMap, allPaths, packageFileContent } = this.collectFileInfo(fileTree);

    const languages   = this.detectLanguages(extMap);
    const framework   = this.detectFramework(allPaths, packageFileContent);
    const orm         = this.detectOrm(allPaths, packageFileContent);
    const analysisDepth = framework ? 'framework' : 'structural';

    return { languages, framework, orm, analysisDepth };
  }

  // ── File tree traversal ──────────────────────────────────────────────────────

  private collectFileInfo(root: FileNode): {
    extMap: Record<string, number>;
    allPaths: string[];
    packageFileContent: string;
  } {
    const extMap: Record<string, number> = {};
    const allPaths: string[] = [];
    let packageFileContent = '';

    const visit = (node: FileNode) => {
      if (node.type === 'file') {
        allPaths.push(node.path);

        // Collect extension counts for language detection
        const ext = this.getExtension(node.path);
        if (ext) extMap[ext] = (extMap[ext] ?? 0) + 1;

        // Collect package manifest content for framework detection
        if (this.isPackageManifest(node.path)) {
          try {
            const fs = require('fs-extra');
            const content = fs.readFileSync(node.path, 'utf-8');
            packageFileContent += '\n' + content;
          } catch {
            // skip unreadable manifests
          }
        }
      }
      node.children?.forEach(visit);
    };

    visit(root);
    return { extMap, allPaths, packageFileContent };
  }

  // ── Language detection ───────────────────────────────────────────────────────

  private detectLanguages(extMap: Record<string, number>): DetectedLanguage[] {
    const total = Object.values(extMap).reduce((a, b) => a + b, 0) || 1;

    // Aggregate counts by language name (multiple extensions may map to same language)
    const langCounts: Record<string, number> = {};
    for (const [ext, count] of Object.entries(extMap)) {
      const lang = EXT_TO_LANGUAGE_NAME[ext];
      if (lang) langCounts[lang] = (langCounts[lang] ?? 0) + count;
    }

    return Object.entries(langCounts)
      .map(([name, count]) => ({
        name,
        confidence: Number((count / total).toFixed(2)),
      }))
      .filter(l => l.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // ── Framework detection ──────────────────────────────────────────────────────

  private detectFramework(
    allPaths: string[],
    packageFileContent: string,
  ): DetectedFramework | undefined {
    const normalizedPaths = allPaths.map(p => p.replace(/\\/g, '/'));

    for (const fp of FRAMEWORK_FINGERPRINTS) {
      const fileMatch = fp.fileSignals.some(signal =>
        normalizedPaths.some(p => p.includes(signal))
      );

      const packageMatch = fp.packageSignals?.some(signal =>
        packageFileContent.includes(signal)
      ) ?? false;

      // A match requires either a file signal OR a package signal to fire.
      // For frameworks with no fileSignals (e.g. gin, fiber) only packageSignals matter.
      const hasFileSignals = fp.fileSignals.length > 0;
      const hasPackageSignals = (fp.packageSignals?.length ?? 0) > 0;

      if (hasFileSignals && hasPackageSignals) {
        if (fileMatch || packageMatch) return fp.framework;
      } else if (hasFileSignals) {
        if (fileMatch) return fp.framework;
      } else if (hasPackageSignals) {
        if (packageMatch) return fp.framework;
      }
    }

    return undefined;
  }

  // ── ORM detection ────────────────────────────────────────────────────────────

  private detectOrm(
    allPaths: string[],
    packageFileContent: string,
  ): DetectedOrm | undefined {
    const normalizedPaths = allPaths.map(p => p.replace(/\\/g, '/'));

    for (const fp of ORM_FINGERPRINTS) {
      const fileMatch = fp.fileSignals.some(signal =>
        normalizedPaths.some(p => p.includes(signal))
      );
      const packageMatch = fp.packageSignals?.some(signal =>
        packageFileContent.includes(signal)
      ) ?? false;

      if (fileMatch || packageMatch) return fp.orm;
    }

    return undefined;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private isPackageManifest(filePath: string): boolean {
    const name = filePath.replace(/\\/g, '/').split('/').pop() ?? '';
    return [
      'package.json',       // JS/TS
      'requirements.txt',   // Python
      'Pipfile',            // Python
      'pyproject.toml',     // Python
      'pom.xml',            // Java/Kotlin/Scala
      'build.gradle',       // Java/Kotlin
      'build.gradle.kts',   // Kotlin
      'build.sbt',          // Scala
      'go.mod',             // Go
      'Cargo.toml',         // Rust
      'Gemfile',            // Ruby
      'composer.json',      // PHP
      'Package.swift',      // Swift
      'pubspec.yaml',       // Dart
      'mix.exs',            // Elixir
      'mix.lock',           // Elixir
      '.csproj',            // C#
      'micronaut-cli.yml',  // Micronaut
    ].includes(name) || name.endsWith('.csproj') || name.endsWith('.fsproj');
  }

  private getExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot === -1 ? '' : filePath.slice(lastDot).toLowerCase();
  }
}