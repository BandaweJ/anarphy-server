/* eslint-disable prettier/prettier */
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReportsModel } from '../models/reports.model';

export class ReportExtraActivitiesDto {
  @ValidateNested()
  @Type(() => Object)
  @IsNotEmpty()
  @IsObject()
  report: ReportsModel;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  activities: string[];
}
