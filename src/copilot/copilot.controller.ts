// ── src/copilot/copilot.controller.ts ────────────────────────────────────────

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CopilotService, PREDEFINED_QUERIES } from './copilot.service';
import { GraphQueryEngine } from './graph-query.engine';
import { AnalysisCacheService } from '../cache/analysis-cache.service';
import { SourceContextService } from './source-context.service';

class AskDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question!: string;

  @IsOptional()
  @IsString()
  mode?: 'freeform' | 'predefined';
}

class SourcePackDto {
  @IsOptional()
  paths?: string[];

  @IsOptional()
  includeImportClosure?: boolean;

  @IsOptional()
  importDepth?: number;

  @IsOptional()
  maxTotalBytes?: number;

  @IsOptional()
  maxFileBytes?: number;

  @IsOptional()
  maxFiles?: number;
}

class SourceTreeDto {
  @IsOptional()
  maxEntries?: number;
}

@ApiTags('copilot')
@Controller('copilot')
export class CopilotController {
  constructor(
    private readonly copilot: CopilotService,
    private readonly graphQuery: GraphQueryEngine,
    private readonly cache: AnalysisCacheService,
    private readonly sourceContext: SourceContextService,
  ) {}

  /** List the canned quick-action queries */
  @Get('queries')
  @ApiOperation({ summary: 'List predefined architecture queries' })
  listQueries() {
    return PREDEFINED_QUERIES;
  }

  /**
   * POST /copilot/:jobId/ask
   *
   * Ask Claude any architecture question about a completed analysis.
   * Example questions:
   *   "Why is my system hard to scale?"
   *   "Show all modules violating clean architecture"
   *   "Which service should I split first?"
   */
  @Post(':jobId/ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Ask an architecture question about a completed analysis',
  })
  async ask(@Param('jobId') jobId: string, @Body() dto: AskDto) {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found`);
    return this.copilot.ask(result, dto);
  }

  /**
   * POST /copilot/:jobId/query
   *
   * Rule-based graph queries — no LLM, instant response.
   * Supports structured queries:
   *   { "type": "violations", "layer": "infrastructure" }
   *   { "type": "dependents", "module": "auth" }
   *   { "type": "path", "from": "api", "to": "database" }
   */
  @Post(':jobId/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Run a structured graph query (no LLM, instant)' })
  async query(
    @Param('jobId') jobId: string,
    @Body() dto: Record<string, string>,
  ) {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found`);
    return this.graphQuery.run(result, dto);
  }

  /**
   * GET /copilot/:jobId/explain
   *
   * Auto-generate a full system explanation — no question needed.
   * Like "git log --oneline" but for architecture.
   */
  @Get(':jobId/explain')
  @ApiOperation({ summary: 'Auto-generate a plain-English system overview' })
  async explain(@Param('jobId') jobId: string) {
    const result = await this.cache.get(jobId);
    if (!result) throw new NotFoundException(`Job ${jobId} not found`);
    return this.copilot.ask(result, {
      question:
        'Give me a plain-English overview of this codebase: its structure, main concerns, biggest risks, and the top 3 things to improve.',
    });
  }

  /**
   * POST /copilot/:jobId/source-pack
   *
   * Returns raw source code contents for the requested repo-relative paths.
   * Used by the UI LLM chat to provide in-module context (e.g. src/auth/**).
   */
  @Post(':jobId/source-pack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Build a bounded source-code context pack' })
  async sourcePack(@Param('jobId') jobId: string, @Body() dto: SourcePackDto) {
    return this.sourceContext.buildSourcePack(jobId, {
      paths: Array.isArray(dto.paths) ? dto.paths : [],
      includeImportClosure: Boolean(dto.includeImportClosure),
      importDepth: dto.importDepth,
      maxTotalBytes: dto.maxTotalBytes,
      maxFileBytes: dto.maxFileBytes,
      maxFiles: dto.maxFiles,
    });
  }

  /**
   * GET /copilot/:jobId/source-tree
   *
   * Returns a bounded, repo-relative source tree used by UI context picker.
   */
  @Get(':jobId/source-tree')
  @ApiOperation({ summary: 'List a bounded source tree for context selection' })
  async sourceTree(@Param('jobId') jobId: string, @Query() dto: SourceTreeDto) {
    return this.sourceContext.buildSourceTree(jobId, dto.maxEntries);
  }
}
