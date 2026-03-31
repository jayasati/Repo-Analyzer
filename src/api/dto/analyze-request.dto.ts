import {
  IsNotEmpty, IsOptional, IsString, MaxLength, Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeRequestDto {
  @ApiProperty({
    description: 'GitHub HTTPS URL or local absolute path',
    example:     'https://github.com/nestjs/nest',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  source!: string;

  @ApiPropertyOptional({
    description: 'Git branch to analyze (default: repo default branch)',
    example:     'main',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[\w./-]+$/, { message: 'branch contains invalid characters' })
  branch?: string;

  @ApiPropertyOptional({
    description: 'Subdirectory within the repo to analyze (e.g. "src/backend")',
    example:     'src/backend',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subdir?: string;
}