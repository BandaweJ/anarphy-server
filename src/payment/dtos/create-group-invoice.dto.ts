/* eslint-disable prettier/prettier */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBillDto } from 'src/finance/dtos/bills.dto';

/**
 * DTO for creating a group invoice (multiple students, same donor/scholarship)
 */
export class GroupStudentInvoiceDto {
  @ApiProperty({ 
    description: 'Student number',
    example: 'STU001',
  })
  @IsString()
  @IsNotEmpty()
  studentNumber: string;

  @ApiProperty({ 
    description: 'Term number',
    example: 1,
  })
  @IsNotEmpty()
  termNum: number;

  @ApiProperty({ 
    description: 'Academic year',
    example: 2024,
  })
  @IsNotEmpty()
  year: number;

  @ApiProperty({ 
    description: 'Array of bills for this student',
    type: [CreateBillDto],
  })
  @IsArray()
  // Removed @ValidateNested and @Type to allow full bill objects from frontend
  // The service will handle validation and transformation
  bills: CreateBillDto[];
}

export class CreateGroupInvoiceDto {
  @ApiProperty({ 
    description: 'Array of students with their bills to invoice together',
    type: [GroupStudentInvoiceDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroupStudentInvoiceDto)
  students: GroupStudentInvoiceDto[];

  @ApiProperty({ 
    description: 'Optional note about donor/scholarship paying for these invoices',
    required: false,
  })
  @IsOptional()
  @IsString()
  donorNote?: string;

  @ApiProperty({ description: 'Optional due date for all invoices in the group', required: false })
  @IsOptional()
  @IsDateString()
  invoiceDueDate?: string | Date;

  @ApiProperty({ description: 'Optional invoice date for all invoices in the group', required: false })
  @IsOptional()
  @IsDateString()
  invoiceDate?: string | Date;
}

