/* eslint-disable prettier/prettier */
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ExemptionType } from '../enums/exemptions-type.enum';

export class UpdateExemptionDto {
  @IsOptional()
  @IsEnum(ExemptionType)
  type?: ExemptionType;

  @IsNumber()
  @IsOptional()
  fixedAmount?: number;

  @IsNumber()
  @IsOptional()
  percentageAmount?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

