import { ApiProperty } from '@nestjs/swagger';
import { ApplicationStatus } from '../entities/application.entity';

export class ApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  surname: string;

  @ApiProperty()
  gender: string;

  @ApiProperty({ nullable: true })
  dob: Date | null;

  @ApiProperty({ nullable: true })
  idnumber: string | null;

  @ApiProperty({ nullable: true })
  email: string | null;

  @ApiProperty({ nullable: true })
  cell: string | null;

  @ApiProperty({ nullable: true })
  address: string | null;

  @ApiProperty({ nullable: true })
  prevSchool: string | null;

  @ApiProperty({ nullable: true })
  prevSchoolRecords: string | null;

  @ApiProperty()
  desiredClass: string;

  @ApiProperty()
  parentName: string;

  @ApiProperty()
  parentSurname: string;

  @ApiProperty({ nullable: true })
  parentEmail: string | null;

  @ApiProperty({ nullable: true })
  parentCell: string | null;

  @ApiProperty({ nullable: true })
  parentRelationship: string | null;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty({ nullable: true })
  studentNumber: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}



