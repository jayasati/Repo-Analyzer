export type AnalysisDepth = 'framework' | 'structural';

export interface DetectedLanguage {
  name:       string;
  confidence: number; // 0 → 1
}

// ── Framework type ────────────────────────────────────────────────────────────
// Owned here so smell-detector, confidence, and pipeline can all import it
// without creating a circular dependency through language-detector.service.ts.

export type DetectedFramework =
  | 'nestjs' | 'nextjs' | 'angular' | 'express' | 'fastify' | 'koa'
  | 'django' | 'flask' | 'fastapi'
  | 'spring' | 'micronaut' | 'ktor'
  | 'gin' | 'fiber' | 'echo'
  | 'rails' | 'sinatra'
  | 'laravel' | 'symfony'
  | 'actix' | 'axum' | 'rocket'
  | 'vapor'
  | 'phoenix'
  | 'play' | 'akka'
  | 'flutter'
  | 'aspnet';

export type DetectedOrm =
  | 'prisma' | 'typeorm' | 'sequelize' | 'mongoose'
  | 'hibernate' | 'jpa'
  | 'sqlalchemy' | 'django-orm'
  | 'activerecord'
  | 'eloquent'
  | 'diesel' | 'sqlx'
  | 'exposed' | 'ktorm'
  | 'slick' | 'doobie';

export interface DetectionResult {
  languages:     DetectedLanguage[];
  framework?:    DetectedFramework;
  orm?:          DetectedOrm;
  analysisDepth: AnalysisDepth;
}