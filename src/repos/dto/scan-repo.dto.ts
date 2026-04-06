import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ScanRepoDto {
  @ApiProperty({
    example: 'octocat/Hello-World',
    description: 'Repository full name or https://github.com/owner/repo URL',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  repo!: string;
}
