import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SetReportReleaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  termId: number;

  @IsString()
  @IsNotEmpty()
  examType: string;

  @IsBoolean()
  released: boolean;
}

export class GetReportReleaseQueryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  termId?: number;

  @IsOptional()
  @IsString()
  examType?: string;
}
