import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateApplicationDto {
  // Personal Information
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  surname: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  gender: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  idnumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  // Academic Information
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  prevSchool?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  prevSchoolRecords?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  desiredClass: string;

  // Parent/Guardian Information
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  parentName: string;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @IsNotEmpty()
  parentSurname: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentCell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  parentRelationship?: string;
}



