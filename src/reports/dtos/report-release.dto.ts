import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SetReportReleaseDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  num: number;

  @IsNumber()
  year: number;

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
  num?: number;

  @IsOptional()
  @IsNumber()
  year?: number;

  @IsOptional()
  @IsString()
  examType?: string;
}
