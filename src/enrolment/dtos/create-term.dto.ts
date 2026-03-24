import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { TermType } from '../entities/term.entity';

export class CreateTermDto {
  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  num: number;

  @ApiProperty()
  @IsNumber()
  @IsNotEmpty()
  year: number;

  @ApiProperty({ enum: TermType, required: false, default: TermType.REGULAR })
  @IsOptional()
  @IsIn([TermType.REGULAR, TermType.VACATION])
  type?: TermType;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  startDate: Date;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  endDate: Date;
}
