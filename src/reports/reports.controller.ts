/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { TeachersEntity } from 'src/profiles/entities/teachers.entity';
import { StudentsEntity } from 'src/profiles/entities/students.entity';
import { ParentsEntity } from 'src/profiles/entities/parents.entity';
import { HeadCommentDto } from './dtos/head-comment.dto';
import { FormTeacherCommentDto } from './dtos/form-teacher-comment.dto';
import { ReportsModel } from './models/reports.model';
import { ExamType } from 'src/marks/models/examtype.enum';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/auth/decorators/has-permissions.decorator';
import { PERMISSIONS } from 'src/auth/models/permissions.constants';
import { SetReportReleaseDto } from './dtos/report-release.dto';
import { ReportExtraActivitiesDto } from './dtos/report-extra-activities.dto';

@Controller('reports')
@UseGuards(AuthGuard(), PermissionsGuard)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('/generate/term/:termId/:name/:examType')
  @HasPermissions(PERMISSIONS.REPORTS.GENERATE)
  generateReportsByTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: string,
    @GetUser() profile,
  ) {
    return this.reportsService.generateReportsByTermId(termId, name, examType, profile);
  }


  @Post('/save/term/:termId/:name/:examType')
  @HasPermissions(PERMISSIONS.REPORTS.SAVE)
  saveReportsByTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: ExamType,
    @Body() reports: ReportsModel[],
    @GetUser() profile,
  ) {
    return this.reportsService.saveReportsByTermId(termId, name, reports, examType, profile);
  }


  @Post('/save/head-comment')
  @HasPermissions(PERMISSIONS.REPORTS.EDIT_COMMENT)
  saveHeadComment(
    @Body() comment: HeadCommentDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    // Validation will be handled by ValidationPipe, but add explicit check as fallback
    if (!comment) {
      throw new BadRequestException('Comment data is required');
    }
    if (!comment.report) {
      throw new BadRequestException('Report data is required in comment');
    }
    if (!comment.comment) {
      throw new BadRequestException('Comment text is required');
    }
    return this.reportsService.saveHeadComment(comment, profile);
  }

  @Post('/save/form-teacher-comment')
  @HasPermissions(PERMISSIONS.REPORTS.EDIT_COMMENT)
  saveFormTeacherComment(
    @Body() comment: FormTeacherCommentDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    // Validation will be handled by ValidationPipe, but add explicit check as fallback
    if (!comment) {
      throw new BadRequestException('Comment data is required');
    }
    if (!comment.report) {
      throw new BadRequestException('Report data is required in comment');
    }
    if (!comment.comment) {
      throw new BadRequestException('Comment text is required');
    }
    return this.reportsService.saveFormTeacherComment(comment, profile);
  }

  @Post('/save/extra-activities')
  @HasPermissions(PERMISSIONS.REPORTS.EDIT_COMMENT)
  saveExtraActivities(
    @Body() payload: ReportExtraActivitiesDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    if (!payload || !payload.report) {
      throw new BadRequestException('Report data is required');
    }
    return this.reportsService.saveExtraActivities(payload, profile);
  }

  @Get('/view/term/:termId/:name/:examType')
  viewReportsByTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: string,
    @GetUser() profile,
  ) {
    return this.reportsService.viewReportsByTermId(termId, name, examType, profile);
  }


  @Get('/view/:studentNumber')
  getStudentReports(
    @Param('studentNumber') studentNumber: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    return this.reportsService.getStudentReports(studentNumber, profile);
  }

  @Get('/release')
  @HasPermissions(PERMISSIONS.REPORTS.VIEW)
  getReportReleaseStatus(
    @Query('name') name?: string,
    @Query('termId') termId?: string,
    @Query('examType') examType?: string,
  ) {
    return this.reportsService.getReportReleaseStatuses(
      name,
      termId ? parseInt(termId, 10) : undefined,
      examType,
    );
  }

  @Post('/release')
  @HasPermissions(PERMISSIONS.REPORTS.SAVE)
  setReportReleaseStatus(
    @Body() payload: SetReportReleaseDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    return this.reportsService.setReportReleaseStatus(
      payload.name,
      payload.termId,
      payload.examType,
      payload.released,
      profile,
    );
  }

  // @Get('view')
  // getOneReport(
  //   @Param('num') num: number,
  //   @Param('year') year: number,
  //   @Param('name') name: string,
  //   @Param('studentNumber') studentNumber: string,
  //   @GetUser() profile,
  // ) {
  //   return this.reportsService.getOneReport(
  //     num,
  //     year,
  //     name,
  //     studentNumber,
  //     profile,
  //   );
  // }

  @Get('/pdf/term/:termId/:name/:examType/:studentNumber/')
  @HasPermissions(PERMISSIONS.REPORTS.DOWNLOAD)
  async getOnePDFByTermId(
    @Param('termId', ParseIntPipe) termId: number,
    @Param('name') name: string,
    @Param('examType') examType: string,
    @Param('studentNumber') studentNumber: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
    @Res() res: Response,
  ): Promise<void> {
    const result = await this.reportsService.downloadReportByTermId(
      termId,
      name,
      examType,
      studentNumber,
      profile,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${result.filename}"`,
      'Content-Length': result.buffer.length,
    });

    res.end(result.buffer);
  }

  // @Get('/pdf/:name/:num/:year')
  // async getAllPDFs(
  //   @Param('name') name: string,
  //   @Param('num') num: number,
  //   @Param('year') year: number,
  //   @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  //   @Res() res: Response,
  // ): Promise<void> {
  //   const studentNumber = '';

  //   const buffer = await this.reportsService.downloadReports(
  //     name,
  //     num,
  //     year,
  //     studentNumber,
  //     profile,
  //   );

  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': 'attachment; filename=example.pdf',
  //     'Content-Length': buffer.length,
  //   });

  //   res.end(buffer);
  // }
}
