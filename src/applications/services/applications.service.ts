/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { ApplicationEntity, ApplicationStatus } from '../entities/application.entity';
import { CreateApplicationDto } from '../dtos/create-application.dto';
import { UpdateApplicationStatusDto } from '../dtos/update-application-status.dto';
import { StudentsService } from 'src/profiles/students/students.service';
import { CreateStudentDto } from 'src/profiles/dtos/createStudents.dto';
import { AccountsEntity } from 'src/auth/entities/accounts.entity';
import { TeachersEntity } from 'src/profiles/entities/teachers.entity';
import { ParentsEntity } from 'src/profiles/entities/parents.entity';
import { StudentsEntity } from 'src/profiles/entities/students.entity';
import { ROLES } from 'src/auth/models/roles.enum';
import { NotificationService, ApplicationNotificationData } from 'src/notifications/services/notification.service';
import { forwardRef, Inject } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import { Stream } from 'stream';
import { SystemSettingsService } from 'src/system/services/system-settings.service';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(ApplicationEntity)
    private applicationsRepository: Repository<ApplicationEntity>,
    @InjectRepository(AccountsEntity)
    private accountsRepository: Repository<AccountsEntity>,
    private studentsService: StudentsService,
    @Inject(forwardRef(() => NotificationService))
    private notificationService: NotificationService,
    private systemSettingsService: SystemSettingsService,
  ) {}

  /**
   * Generate unique application ID (format: APP-YYYY-NNNNNN)
   */
  private async generateApplicationId(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `APP-${year}-`;

    const lastApplication = await this.applicationsRepository.findOne({
      where: { applicationId: Like(`${prefix}%`) },
      order: { createdAt: 'DESC' },
    });

    let sequence = 1;
    if (lastApplication) {
      const parts = lastApplication.applicationId.split('-');
      if (parts.length === 3) {
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
          sequence = lastSeq + 1;
        }
      }
    }

    return `${prefix}${String(sequence).padStart(6, '0')}`;
  }

  /**
   * Create a new application (public endpoint)
   */
  async createApplication(
    createApplicationDto: CreateApplicationDto,
  ): Promise<ApplicationEntity> {
    // Check for duplicate application (same email or idnumber)
    if (createApplicationDto.email) {
      const existingByEmail = await this.applicationsRepository.findOne({
        where: { email: createApplicationDto.email },
      });
      if (existingByEmail) {
        throw new BadRequestException(
          'An application with this email already exists',
        );
      }
    }

    if (createApplicationDto.idnumber) {
      const existingByIdNumber = await this.applicationsRepository.findOne({
        where: { idnumber: createApplicationDto.idnumber },
      });
      if (existingByIdNumber) {
        throw new BadRequestException(
          'An application with this ID number already exists',
        );
      }
    }

    const applicationId = await this.generateApplicationId();

    const application = this.applicationsRepository.create({
      ...createApplicationDto,
      applicationId,
      status: ApplicationStatus.PENDING,
      dob: createApplicationDto.dob ? new Date(createApplicationDto.dob) : null,
    });

    try {
      const savedApplication = await this.applicationsRepository.save(application);
      this.logger.log(`Application created: ${savedApplication.applicationId}`);

      // Send confirmation notification
      try {
        await this.notificationService.sendApplicationConfirmation({
          applicationId: savedApplication.applicationId,
          applicantName: savedApplication.name,
          applicantSurname: savedApplication.surname,
          applicantEmail: savedApplication.email || undefined,
          applicantCell: savedApplication.cell || undefined,
          parentEmail: savedApplication.parentEmail || undefined,
          parentCell: savedApplication.parentCell || undefined,
          status: savedApplication.status,
        });
      } catch (notificationError) {
        this.logger.error(
          `Failed to send confirmation notification for ${savedApplication.applicationId}`,
          notificationError,
        );
        // Don't fail the application creation if notification fails
      }

      return savedApplication;
    } catch (error) {
      this.logger.error('Failed to create application', error);
      throw new BadRequestException('Failed to create application');
    }
  }

  /**
   * Get all applications (admin only)
   */
  async getAllApplications(
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
    status?: ApplicationStatus,
    search?: string,
  ): Promise<ApplicationEntity[]> {
    // Authorization check - Only admin, director, auditor can view applications
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor: {
        break;
      }
      default:
        throw new UnauthorizedException(
          'Only admins, directors, and auditors can view applications',
        );
    }

    const queryBuilder = this.applicationsRepository.createQueryBuilder('application');

    if (status) {
      queryBuilder.where('application.status = :status', { status });
    }

    if (search) {
      queryBuilder.andWhere(
        '(application.name ILIKE :search OR application.surname ILIKE :search OR application.email ILIKE :search OR application.applicationId ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    queryBuilder.orderBy('application.createdAt', 'DESC');

    return await queryBuilder.getMany();
  }

  /**
   * Get application by ID
   */
  async getApplicationById(
    id: string,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<ApplicationEntity> {
    // Authorization check
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor: {
        break;
      }
      default:
        throw new UnauthorizedException(
          'Only admins, directors, and auditors can view applications',
        );
    }

    const application = await this.applicationsRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    return application;
  }

  /**
   * Get application by applicationId (for public tracking)
   */
  async getApplicationByApplicationId(
    applicationId: string,
  ): Promise<ApplicationEntity> {
    const application = await this.applicationsRepository.findOne({
      where: { applicationId },
    });

    if (!application) {
      throw new NotFoundException(
        `Application with reference number ${applicationId} not found`,
      );
    }

    return application;
  }

  /**
   * Update application status
   */
  async updateApplicationStatus(
    id: string,
    updateDto: UpdateApplicationStatusDto,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<ApplicationEntity> {
    // Authorization check
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor: {
        break;
      }
      default:
        throw new UnauthorizedException(
          'Only admins, directors, and auditors can update applications',
        );
    }

    const application = await this.applicationsRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException(`Application with ID ${id} not found`);
    }

    // Get the account of the reviewer
    const account = await this.accountsRepository.findOne({
      where: { id: (profile as any).accountId },
    });

    if (!account) {
      throw new NotFoundException('Reviewer account not found');
    }

    const previousStatus = application.status;
    application.status = updateDto.status;
    application.reviewedBy = account;
    application.reviewedByAccountId = account.id;
    application.reviewedAt = new Date();
    if (updateDto.reviewNotes) {
      application.reviewNotes = updateDto.reviewNotes;
    }

    // If status is being changed to ACCEPTED, auto-register the student
    if (
      updateDto.status === ApplicationStatus.ACCEPTED &&
      previousStatus !== ApplicationStatus.ACCEPTED
    ) {
      if (application.studentNumber) {
        this.logger.warn(
          `Application ${application.applicationId} already has a student number: ${application.studentNumber}`,
        );
      } else {
        await this.autoRegisterStudent(application);
      }
    }

    try {
      const updatedApplication = await this.applicationsRepository.save(application);
      this.logger.log(
        `Application ${application.applicationId} status updated to ${updateDto.status}`,
      );

      // Send status update notification
      try {
        const notificationData: ApplicationNotificationData = {
          applicationId: updatedApplication.applicationId,
          applicantName: updatedApplication.name,
          applicantSurname: updatedApplication.surname,
          applicantEmail: updatedApplication.email || undefined,
          applicantCell: updatedApplication.cell || undefined,
          parentEmail: updatedApplication.parentEmail || undefined,
          parentCell: updatedApplication.parentCell || undefined,
          status: updatedApplication.status,
          studentNumber: updatedApplication.studentNumber || undefined,
        };

        // If status is ACCEPTED and student number exists, send acceptance notification
        if (
          updatedApplication.status === ApplicationStatus.ACCEPTED &&
          updatedApplication.studentNumber
        ) {
          await this.notificationService.sendAcceptanceNotification(notificationData);
        } else {
          // Send general status update
          await this.notificationService.sendApplicationStatusUpdate(notificationData);
        }
      } catch (notificationError) {
        this.logger.error(
          `Failed to send status update notification for ${updatedApplication.applicationId}`,
          notificationError,
        );
        // Don't fail the status update if notification fails
      }

      return updatedApplication;
    } catch (error) {
      this.logger.error('Failed to update application status', error);
      throw new BadRequestException('Failed to update application status');
    }
  }

  /**
   * Auto-register student when application is accepted
   */
  private async autoRegisterStudent(
    application: ApplicationEntity,
  ): Promise<StudentsEntity> {
    this.logger.log(
      `Auto-registering student for application ${application.applicationId}`,
    );

    // Create student DTO from application data
    const createStudentDto: CreateStudentDto = {
      name: application.name,
      surname: application.surname,
      gender: application.gender,
      dob: application.dob || undefined,
      idnumber: application.idnumber || undefined,
      email: application.email || undefined,
      cell: application.cell || undefined,
      address: application.address || undefined,
      prevSchool: application.prevSchool || undefined,
      dateOfJoining: new Date(),
      residence: 'Day', // Default to Day student, can be updated later
    };

    // Create a temporary admin profile for the service call
    // The StudentsService.createStudent requires a profile, but we'll bypass
    // the authorization check since we're in an admin context
    const tempAdminProfile = {
      role: ROLES.admin,
    } as TeachersEntity;

    try {
      const student = await this.studentsService.createStudent(
        createStudentDto,
        tempAdminProfile,
      );

      // Link application to student
      application.studentNumber = student.studentNumber;
      application.student = student;
      await this.applicationsRepository.save(application);

      this.logger.log(
        `Student ${student.studentNumber} created for application ${application.applicationId}`,
      );

      return student;
    } catch (error) {
      this.logger.error(
        `Failed to auto-register student for application ${application.applicationId}`,
        error,
      );
      throw new BadRequestException(
        'Failed to auto-register student. Please register manually.',
      );
    }
  }

  /**
   * Generate PDF for application (fits on A4 page)
   */
  async generateApplicationPdf(application: ApplicationEntity): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 40, bottom: 40, left: 50, right: 50 },
    });

    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {});

    const primaryBlue = '#2196f3';
    const textPrimary = '#2c3e50';
    const textSecondary = '#7f8c8d';
    const successGreen = '#4caf50';
    const warningOrange = '#ff9800';
    const errorRed = '#f44336';

    let currentY = 40;

    // Fetch system settings
    let systemSettings;
    try {
      systemSettings = await this.systemSettingsService.getSettings();
    } catch (error) {
      this.logger.warn('Failed to fetch system settings, using defaults', error);
      systemSettings = null;
    }

    const schoolName = (systemSettings?.schoolName?.trim()) || 'Junior High School';
    const schoolAddress = (systemSettings?.schoolAddress?.trim()) || '30588 Lundi Drive, Rhodene, Masvingo';
    const schoolPhone = (systemSettings?.schoolPhone?.trim()) || '+263 392 263 293 / +263 78 223 8026';
    const schoolEmail = (systemSettings?.schoolEmail?.trim()) || 'info@juniorhighschool.ac.zw';

    // Logo
    try {
      const imgPath = path.join(process.cwd(), 'public', 'anarphy_logo.png');
      if (fs.existsSync(imgPath)) {
        doc.image(imgPath, 50, currentY, { width: 80, height: 80 });
      }
    } catch (e) {
      this.logger.warn('Error adding logo', e);
    }

    // Header
    const logoWidth = 80;
    const textStartX = 50 + logoWidth + 15;
    const textWidth = doc.page.width - textStartX - 50;

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(primaryBlue)
      .text(schoolName.toUpperCase(), textStartX, currentY, {
        align: 'left',
        width: textWidth,
      });

    currentY += 18;
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(textSecondary)
      .text(schoolAddress, textStartX, currentY, {
        align: 'left',
        width: textWidth,
      });

    currentY += 12;
    doc.text(schoolPhone, textStartX, currentY, {
      align: 'left',
      width: textWidth,
    });

    currentY += 12;
    doc.text(schoolEmail, textStartX, currentY, {
      align: 'left',
      width: textWidth,
    });

    currentY += 30;

    // Title
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(textPrimary)
      .text('STUDENT APPLICATION', 50, currentY, {
        align: 'center',
        width: doc.page.width - 100,
      });

    currentY += 25;

    // Application Reference
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(textPrimary)
      .text(`Application Reference: ${application.applicationId}`, 50, currentY);

    currentY += 20;

    // Status
    const statusColor = 
      application.status === ApplicationStatus.ACCEPTED ? successGreen :
      application.status === ApplicationStatus.DECLINED ? errorRed :
      application.status === ApplicationStatus.ON_HOLD ? warningOrange :
      textSecondary;

    const statusLabel = application.status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    doc
      .font('Helvetica-Bold')
      .fontSize(10)
      .fillColor(statusColor)
      .text(`Status: ${statusLabel}`, 50, currentY);

    currentY += 25;

    // Section: Applicant Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(primaryBlue)
      .text('APPLICANT INFORMATION', 50, currentY);

    currentY += 15;
    this.addSectionLine(doc, 50, currentY, doc.page.width - 100);
    currentY += 10;

    const applicantFields = [
      { label: 'Full Name', value: `${application.name} ${application.surname}` },
      { label: 'Gender', value: application.gender },
      { label: 'Date of Birth', value: application.dob ? new Date(application.dob).toLocaleDateString() : 'N/A' },
      { label: 'ID Number', value: application.idnumber || 'N/A' },
      { label: 'Email', value: application.email || 'N/A' },
      { label: 'Cell', value: application.cell || 'N/A' },
      { label: 'Address', value: application.address || 'N/A' },
    ];

    currentY = this.addFields(doc, applicantFields, 50, currentY, textPrimary, textSecondary);

    currentY += 15;

    // Section: Academic Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(primaryBlue)
      .text('ACADEMIC INFORMATION', 50, currentY);

    currentY += 15;
    this.addSectionLine(doc, 50, currentY, doc.page.width - 100);
    currentY += 10;

    const academicFields = [
      { label: 'Desired Class', value: application.desiredClass },
      { label: 'Previous School', value: application.prevSchool || 'N/A' },
    ];

    currentY = this.addFields(doc, academicFields, 50, currentY, textPrimary, textSecondary);

    if (application.prevSchoolRecords) {
      currentY += 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(textPrimary)
        .text('Previous School Records:', 50, currentY);
      
      currentY += 12;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(textSecondary)
        .text(application.prevSchoolRecords, 50, currentY, {
          width: doc.page.width - 100,
          align: 'left',
        });
      currentY += doc.heightOfString(application.prevSchoolRecords, { width: doc.page.width - 100 }) + 5;
    }

    currentY += 15;

    // Section: Parent/Guardian Information
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(primaryBlue)
      .text('PARENT/GUARDIAN INFORMATION', 50, currentY);

    currentY += 15;
    this.addSectionLine(doc, 50, currentY, doc.page.width - 100);
    currentY += 10;

    const parentFields = [
      { label: 'Full Name', value: `${application.parentName} ${application.parentSurname}` },
      { label: 'Relationship', value: application.parentRelationship || 'N/A' },
      { label: 'Email', value: application.parentEmail || 'N/A' },
      { label: 'Cell', value: application.parentCell || 'N/A' },
    ];

    currentY = this.addFields(doc, parentFields, 50, currentY, textPrimary, textSecondary);

    currentY += 15;

    // Section: Application Details
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(primaryBlue)
      .text('APPLICATION DETAILS', 50, currentY);

    currentY += 15;
    this.addSectionLine(doc, 50, currentY, doc.page.width - 100);
    currentY += 10;

    const detailFields = [
      { label: 'Submitted Date', value: new Date(application.createdAt).toLocaleString() },
      { label: 'Reviewed Date', value: application.reviewedAt ? new Date(application.reviewedAt).toLocaleString() : 'Not reviewed' },
    ];

    if (application.studentNumber) {
      detailFields.push({ label: 'Student Number', value: application.studentNumber });
    }

    currentY = this.addFields(doc, detailFields, 50, currentY, textPrimary, textSecondary);

    if (application.reviewNotes) {
      currentY += 10;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(textPrimary)
        .text('Review Notes:', 50, currentY);
      
      currentY += 12;
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(textSecondary)
        .text(application.reviewNotes, 50, currentY, {
          width: doc.page.width - 100,
          align: 'left',
        });
    }

    // Footer
    const footerY = doc.page.height - 40;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(textSecondary)
      .text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        footerY,
        {
          align: 'center',
          width: doc.page.width - 100,
        },
      );

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);
    });
  }

  private addFields(
    doc: any,
    fields: Array<{ label: string; value: string }>,
    x: number,
    startY: number,
    labelColor: string,
    valueColor: string,
  ): number {
    let currentY = startY;
    const labelWidth = 120;
    const valueX = x + labelWidth + 10;

    fields.forEach((field) => {
      // Check if we need a new page
      if (currentY > doc.page.height - 80) {
        doc.addPage();
        currentY = 40;
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(labelColor)
        .text(`${field.label}:`, x, currentY, { width: labelWidth });

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(valueColor)
        .text(field.value, valueX, currentY, {
          width: doc.page.width - valueX - 50,
        });

      currentY += 14;
    });

    return currentY;
  }

  private addSectionLine(
    doc: any,
    x: number,
    y: number,
    width: number,
  ): void {
    doc
      .strokeColor('#e0e0e0')
      .lineWidth(1)
      .moveTo(x, y)
      .lineTo(x + width, y)
      .stroke();
  }
}

