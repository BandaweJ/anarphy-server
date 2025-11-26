import { ParentsService } from './parents.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { CreateParentsDto } from '../dtos/createParents.dto';
import { UpdateParentDto } from '../dtos/updateParent.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { TeachersEntity } from '../entities/teachers.entity';
import { StudentsEntity } from '../entities/students.entity';
import { ParentsEntity } from '../entities/parents.entity';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('parents')
@Controller('parents')
@UseGuards(AuthGuard('jwt'))
export class ParentsController {
  private readonly logger = new Logger(ParentsController.name);

  constructor(private parentsService: ParentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all parents' })
  @ApiResponse({ status: 200, description: 'Parents retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getAllParents(
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Getting all parents for user: ${profile.role}`);
    return await this.parentsService.getAllParents(profile);
  }

  @Get(':email')
  @ApiOperation({ summary: 'Get parent by email' })
  @ApiParam({ name: 'email', description: 'Parent email address' })
  @ApiResponse({ status: 200, description: 'Parent retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  async getParent(
    @Param('email') email: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Getting parent: ${email} for user: ${profile.role}`);
    return await this.parentsService.getParent(email, profile);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new parent' })
  @ApiResponse({ status: 201, description: 'Parent created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Conflict - Parent already exists' })
  async createParent(
    @Body() createParentDto: CreateParentsDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Creating parent: ${createParentDto.email} by user: ${profile.role}`);
    return await this.parentsService.createParent(createParentDto, profile);
  }

  @Patch(':email')
  @ApiOperation({ summary: 'Update parent by email' })
  @ApiParam({ name: 'email', description: 'Parent email address' })
  @ApiResponse({ status: 200, description: 'Parent updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Email already exists' })
  async updateParent(
    @Param('email') email: string,
    @Body() updateParentDto: UpdateParentDto,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Updating parent: ${email} by user: ${profile.role}`);
    return await this.parentsService.updateParent(email, updateParentDto, profile);
  }

  @Delete(':email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete parent by email' })
  @ApiParam({ name: 'email', description: 'Parent email address' })
  @ApiResponse({ status: 200, description: 'Parent deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Parent not found' })
  @ApiResponse({ status: 409, description: 'Conflict - Parent has associated students' })
  async deleteParent(
    @Param('email') email: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Deleting parent: ${email} by user: ${profile.role}`);
    return await this.parentsService.deleteParent(email, profile);
  }

  @Get(':email/students')
  @ApiOperation({ summary: 'Get all students linked to a parent' })
  @ApiParam({ name: 'email', description: 'Parent email address' })
  async getParentStudents(
    @Param('email') email: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(`Getting children for parent: ${email} by ${profile.role}`);
    return this.parentsService.getChildrenForParent(email, profile);
  }

  @Post(':email/students/:studentNumber')
  @ApiOperation({ summary: 'Assign a student to a parent' })
  @ApiParam({ name: 'email', description: 'Parent email address' })
  @ApiParam({ name: 'studentNumber', description: 'Student number to assign' })
  @ApiResponse({
    status: 200,
    description: 'Student assigned to parent successfully',
  })
  async assignStudentToParent(
    @Param('email') email: string,
    @Param('studentNumber') studentNumber: string,
    @GetUser() profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ) {
    this.logger.log(
      `Assigning student ${studentNumber} to parent ${email} by ${profile.role}`,
    );
    return this.parentsService.assignStudentToParent(
      email,
      studentNumber,
      profile,
    );
  }
}
