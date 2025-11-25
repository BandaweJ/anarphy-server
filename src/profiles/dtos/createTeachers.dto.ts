/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ROLES } from 'src/auth/models/roles.enum';

export class CreateTeacherDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  id: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  surname: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value === '' ? undefined : value)
  dob?: Date;

  @ApiProperty()
  @IsString()
  gender: string;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  dateOfJoining?: Date;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  qualifications?: string[];

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  active: boolean;

  @ApiProperty()
  @IsString()
  // @IsPhoneNumber()
  cell: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  @Transform(({ value }) => value === '' ? undefined : value)
  dateOfLeaving?: Date;

  @ApiProperty()
  @IsOptional()
  @IsString()
  role?: ROLES;
}
