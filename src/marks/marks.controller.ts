/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { CreateSubjectDto } from './dtos/create-subject.dto';
import { MarksService } from './marks.service';
import { StudentsEntity } from '../profiles/entities/students.entity';
import { ParentsEntity } from '../profiles/entities/parents.entity';
import { TeachersEntity } from '../profiles/entities/teachers.entity';
import { CreateMarkDto } from './dtos/create-mark.dto';

import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { HasPermissions } from '../auth/decorators/has-permissions.decorator';
import { PERMISSIONS } from '../auth/models/permissions.constants';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('marks')
@UseGuards(AuthGuard(), PermissionsGuard)
export class MarksController {
  constructor(private marksService: MarksService) {}

  @Post('/subjects')
  @HasPermissions(PERMISSIONS.MARKS.ENTER)
  createSubject(
    @Body() createSubjectDto: CreateSubjectDto,

    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    // console.log(profile);
    return this.marksService.createSubject(createSubjectDto, profile);
  }

  @Get('/subjects')
  getAllSubjects() {
    return this.marksService.getAllSubjects();
  }

  @Get('/subjects/:code')
  getOneSubject(@Param('code') code: string) {
    return this.marksService.getOneSubject(code);
  }

  @Delete('subjects/:code')
  deleteSubject(
    @Param('code') code: string,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.deleteSubject(code, profile);
  }

  @Patch('/subjects')
  editSubject(@Body() subject: CreateSubjectDto) {
    return this.marksService.editSubject(subject);
  }

  @Post('/marks')
  @HasPermissions(PERMISSIONS.MARKS.ENTER)
  createMark(
    @Body() createMarkDto: CreateMarkDto,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    // console.log(createMarkDto);
    return this.marksService.createMark(createMarkDto, profile);
  }

  @Get('/marks')
  getAllMarks(
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.getAllMarks(profile);
  }

  @Get('/marks/term/:termId/:name/:examType')
  getMarksByClassTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: string,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.getMarksByClassWithTermId(termId, name, examType, profile);
  }

  @Get('/marks/term/:termId/:name/:subjectCode/:examType')
  getSubjectMarksInClassByTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('subjectCode') subjectCode: string,
    @Param('examType') examType: string,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.getSubjectMarksInClassWithTermId(
      termId,
      name,
      subjectCode,
      examType,
      profile,
    );
  }

  @Get('/studentMarks/:studentNumber')
  @ApiOperation({ summary: 'Get marks for a specific student' })
  @ApiParam({ name: 'studentNumber', description: 'Student number' })
  @ApiResponse({ status: 200, description: 'Marks retrieved successfully' })
  async getStudentMarks(
    @Param('studentNumber') studentNumber: string,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.getStudentMarksForProfile(
      studentNumber,
      profile,
    );
  }

  /**
   * !TOFIX
   * Passing object to @Patch and @Delete
   *
   *
   */

  // @Patch('/marks')
  // updateMark(
  //   updateMarkDto: UpdateMarkDto,
  //   @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  // ) {
  //   return this.marksService.updateMark(updateMarkDto, profile);
  // }

  @Delete('/marks/:id')
  deleteMark(
    @Param('id') id: number,
    @GetUser() profile: StudentsEntity | ParentsEntity | TeachersEntity,
  ) {
    return this.marksService.deleteMark(id, profile);
  }

  @Get('/perf/term/:termId/:name/:examType')
  getPerfomanceData(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: string,
  ) {
    return this.marksService.getPerfomanceData(termId, name, examType);
  }

  @Get('/progress/term/:termId/:clas/:examType')
  fetchMarksProgress(
    @Param('clas') clas: string,
    @Param('termId', ParseIntPipe) termId: number,
    @Param('examType') examType: string,
    @GetUser() profile: TeachersEntity,
  ) {
    return this.marksService.fetchMarksProgress(
      termId,
      clas,
      examType,
      profile,
    );
  }
}
