import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MinLength,
} from 'class-validator';

/**
 * DTO for parent updates to student records
 * Excludes sensitive fields like studentNumber, role, etc.
 */
export class UpdateStudentByParentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dob?: Date;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  // @MinLength(10)
  idnumber?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  // @IsPhoneNumber('ZW')
  cell?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  // @IsEmail()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  prevSchool?: string;

  // Note: Fields NOT allowed for parent updates:
  // - studentNumber (system generated)
  // - name (requires admin approval)
  // - surname (requires admin approval)
  // - dateOfJoining (system managed)
  // - role (system managed)
  // - enrols (managed by school)
  // - marks, attendance, etc. (managed by teachers)
}

