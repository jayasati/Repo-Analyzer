import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsGithubUrl } from '../../common/validators/github-url.validator';

/**
 * WHY: class-validator + class-transformer wired via ValidationPipe
 * gives us declarative input validation with helpful error messages
 * before any business logic runs.
 */
export class AnalyzeRequestDto {
  /**
   * Either a full GitHub HTTPS URL or a local absolute path.
   * GitHub URLs are validated by IsGithubUrl.
   * Local paths are allowed only in dev/test environments.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  source!: string;
}