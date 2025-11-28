/* eslint-disable prettier/prettier */
import { IsString, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportsModel } from '../models/reports.model';

export class FormTeacherCommentDto {
  @IsString()
  @IsNotEmpty()
  comment: string;

  @ValidateNested()
  @Type(() => Object)
  @IsNotEmpty()
  @IsObject()
  report: ReportsModel;
}

