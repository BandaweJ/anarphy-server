/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { ApplicationsService } from '../services/applications.service';
import { CreateApplicationDto } from '../dtos/create-application.dto';
import { UpdateApplicationStatusDto } from '../dtos/update-application-status.dto';
import { ApplicationResponseDto } from '../dtos/application-response.dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { TeachersEntity } from 'src/profiles/entities/teachers.entity';
import { ParentsEntity } from 'src/profiles/entities/parents.entity';
import { StudentsEntity } from 'src/profiles/entities/students.entity';
import { ApplicationStatus } from '../entities/application.entity';

@ApiTags('applications')
@Controller('applications')
export class ApplicationsController {
  constructor(private applicationsService: ApplicationsService) {}

  /**
   * Public endpoint - Submit application (no auth required)
   */
  @Post()
  @ApiOperation({ summary: 'Submit a new application (public)' })
  @ApiResponse({
    status: 201,
    description: 'Application submitted successfully',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createApplication(
    @Body() createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationsService.createApplication(createApplicationDto);
  }

  /**
   * Public endpoint - Track application status (no auth required)
   */
  @Get('track/:applicationId')
  @ApiOperation({ summary: 'Track application status by reference number (public)' })
  @ApiResponse({
    status: 200,
    description: 'Application found',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async trackApplication(
    @Param('applicationId') applicationId: string,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationsService.getApplicationByApplicationId(
      applicationId,
    );
  }

  /**
   * Admin endpoint - Get all applications
   */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get all applications (admin only)' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({
    status: 200,
    description: 'List of applications',
    type: [ApplicationResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllApplications(
    @GetUser() profile: TeachersEntity | ParentsEntity | StudentsEntity,
    @Query('status') status?: ApplicationStatus,
    @Query('search') search?: string,
  ): Promise<ApplicationResponseDto[]> {
    return await this.applicationsService.getAllApplications(
      profile,
      status,
      search,
    );
  }

  /**
   * Admin endpoint - Get application by ID
   */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get application by ID (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Application details',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplicationById(
    @Param('id') id: string,
    @GetUser() profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationsService.getApplicationById(id, profile);
  }

  /**
   * Admin endpoint - Update application status
   */
  @Put(':id/status')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update application status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Application status updated',
    type: ApplicationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async updateApplicationStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateApplicationStatusDto,
    @GetUser() profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<ApplicationResponseDto> {
    return await this.applicationsService.updateApplicationStatus(
      id,
      updateDto,
      profile,
    );
  }
}



