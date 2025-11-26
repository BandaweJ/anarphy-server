/* eslint-disable prettier/prettier */
import { StudentsService } from './students.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { UpdateStudentDto } from '../dtos/updateStudent.dto';
import { UpdateStudentByParentDto } from '../dtos/updateStudentByParent.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { TeachersEntity } from '../entities/teachers.entity';
import { StudentsEntity } from '../entities/students.entity';
import { ParentsEntity } from '../entities/parents.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Logger, HttpStatus, HttpCode } from '@nestjs/common';

@ApiTags('students')
@Controller('students')
@UseGuards(AuthGuard('jwt'))
export class StudentsController {
  private readonly logger = new Logger(StudentsController.name);

  constructor(private studentsService: StudentsService) {}

  @Post()
  createStudent(
    @Body() createStudentDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    return this.studentsService.createStudent(createStudentDto, profile);
  }

  @Get()
  getAllStudents(
    @GetUser() profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ) {
    return this.studentsService.getAllStudents(profile);
  }

  @Get(':studentNumber')
  getStudent(
    @Param('studentNumber') studentNumber: string,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ) {
    return this.studentsService.getStudent(studentNumber, profile);
  }

  @Patch(':studentNumber')
  @ApiOperation({ summary: 'Update student by staff' })
  @ApiParam({ name: 'studentNumber', description: 'Student number' })
  @ApiResponse({ status: 200, description: 'Student updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async updateStudent(
    @Param('studentNumber') studentNumber: string,
    @Body() updateStudentDto: UpdateStudentDto,
    @GetUser() profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ) {
    this.logger.log(`Updating student: ${studentNumber} by user: ${profile.role}`);
    return await this.studentsService.updateStudent(
      studentNumber,
      updateStudentDto,
      profile,
    );
  }

  @Patch(':studentNumber/parent-update')
  @ApiOperation({ summary: 'Update student by parent (limited fields)' })
  @ApiParam({ name: 'studentNumber', description: 'Student number' })
  @ApiResponse({ status: 200, description: 'Student updated successfully by parent' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Parent can only update their own children' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async updateStudentByParent(
    @Param('studentNumber') studentNumber: string,
    @Body() updateStudentDto: UpdateStudentByParentDto,
    @GetUser() profile: ParentsEntity,
  ) {
    this.logger.log(`Parent updating student: ${studentNumber} by parent: ${profile.email}`);
    return await this.studentsService.updateStudentByParent(
      studentNumber,
      updateStudentDto,
      profile,
    );
  }

  @Delete(':studentNumber')
  deleteStudent(@Param('studentNumber') studentnumber: string) {
    // console.log('here' + studentnumber);
    return this.studentsService.deleteStudent(studentnumber);
  }
}
