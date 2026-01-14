/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import { SystemSettingsService } from '../../system/services/system-settings.service';
import { StudentsEntity } from '../../profiles/entities/students.entity';
import { ParentsEntity } from '../../profiles/entities/parents.entity';
import { TeachersEntity } from '../../profiles/entities/teachers.entity';
import { ApplicationStatus } from '../../applications/entities/application.entity';

export interface ReportCardNotificationData {
  studentName: string;
  studentNumber: string;
  className: string;
  termNumber: number;
  termYear: number;
  examType: string;
  parentEmail?: string;
  studentEmail?: string;
}

export interface InvoiceNotificationData {
  studentName: string;
  studentNumber: string;
  invoiceNumber: string;
  invoiceDate: Date;
  totalAmount: number;
  dueDate?: Date;
  parentEmail?: string;
  studentEmail?: string;
}

export interface PaymentNotificationData {
  studentName: string;
  studentNumber: string;
  receiptNumber: string;
  paymentDate: Date;
  amount: number;
  paymentMethod: string;
  parentEmail?: string;
  studentEmail?: string;
}

export interface LowBalanceNotificationData {
  studentName: string;
  studentNumber: string;
  currentBalance: number;
  parentEmail?: string;
  studentEmail?: string;
}

export interface ContinuousAssessmentNotificationData {
  studentName: string;
  studentNumber: string;
  topicOrSkill: string;
  assessmentDate: Date;
  score: number;
  maxScore?: number;
  assessmentType?: string;
  parentEmail?: string;
  studentEmail?: string;
}

export interface ApplicationNotificationData {
  applicationId: string;
  applicantName: string;
  applicantSurname: string;
  applicantEmail?: string;
  applicantCell?: string;
  parentEmail?: string;
  parentCell?: string;
  status: ApplicationStatus;
  studentNumber?: string;
  schoolName?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly systemSettingsService: SystemSettingsService,
  ) {}

  /**
   * Send report card notification
   */
  async sendReportCardNotification(
    data: ReportCardNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    if (!settings.emailNotificationsEnabled) {
      return false;
    }

    const recipients: string[] = [];
    if (data.parentEmail) recipients.push(data.parentEmail);
    if (data.studentEmail) recipients.push(data.studentEmail);

    if (recipients.length === 0) {
      this.logger.warn(
        `No email addresses found for student ${data.studentNumber}`,
      );
      return false;
    }

    const subject = `Report Card Available - ${data.studentName} (Term ${data.termNumber}, ${data.termYear})`;
    const html = this.generateReportCardEmail(data, settings.schoolName);

    return await this.emailService.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * Send invoice notification
   */
  async sendInvoiceNotification(
    data: InvoiceNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    if (!settings.emailNotificationsEnabled) {
      return false;
    }

    const recipients: string[] = [];
    if (data.parentEmail) recipients.push(data.parentEmail);
    if (data.studentEmail) recipients.push(data.studentEmail);

    if (recipients.length === 0) {
      this.logger.warn(
        `No email addresses found for student ${data.studentNumber}`,
      );
      return false;
    }

    const subject = `New Invoice - ${data.studentName} (Invoice #${data.invoiceNumber})`;
    const html = this.generateInvoiceEmail(data, settings.schoolName);

    return await this.emailService.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * Send payment receipt notification
   */
  async sendPaymentNotification(
    data: PaymentNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    if (!settings.emailNotificationsEnabled) {
      return false;
    }

    const recipients: string[] = [];
    if (data.parentEmail) recipients.push(data.parentEmail);
    if (data.studentEmail) recipients.push(data.studentEmail);

    if (recipients.length === 0) {
      this.logger.warn(
        `No email addresses found for student ${data.studentNumber}`,
      );
      return false;
    }

    const subject = `Payment Receipt - ${data.studentName} (Receipt #${data.receiptNumber})`;
    const html = this.generatePaymentEmail(data, settings.schoolName);

    return await this.emailService.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * Send low balance alert
   */
  async sendLowBalanceAlert(
    data: LowBalanceNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    if (!settings.emailNotificationsEnabled) {
      return false;
    }

    const recipients: string[] = [];
    if (data.parentEmail) recipients.push(data.parentEmail);
    if (data.studentEmail) recipients.push(data.studentEmail);

    if (recipients.length === 0) {
      this.logger.warn(
        `No email addresses found for student ${data.studentNumber}`,
      );
      return false;
    }

    const subject = `Low Balance Alert - ${data.studentName}`;
    const html = this.generateLowBalanceEmail(data, settings.schoolName);

    return await this.emailService.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  async sendContinuousAssessmentNotification(
    data: ContinuousAssessmentNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    if (!settings.emailNotificationsEnabled) {
      return false;
    }

    const recipients: string[] = [];
    if (data.parentEmail) recipients.push(data.parentEmail);
    if (data.studentEmail) recipients.push(data.studentEmail);

    if (recipients.length === 0) {
      return false;
    }

    const scoreText = data.maxScore ? `${data.score}/${data.maxScore}` : `${data.score}`;
    const subject = `Continuous Assessment Update - ${data.studentName}`;
    const html = `
      <h2>${settings.schoolName || 'School Notification'}</h2>
      <p>A new continuous assessment has been recorded.</p>
      <p><strong>Student:</strong> ${data.studentName} (${data.studentNumber})</p>
      <p><strong>Topic/Skill:</strong> ${data.topicOrSkill}</p>
      <p><strong>Assessment Type:</strong> ${data.assessmentType || 'Exercise'}</p>
      <p><strong>Date:</strong> ${new Date(data.assessmentDate).toLocaleDateString()}</p>
      <p><strong>Score:</strong> ${scoreText}</p>
      <p>Please log into the portal for more details.</p>
    `;

    return this.emailService.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  /**
   * Generate report card email HTML
   */
  private generateReportCardEmail(
    data: ReportCardNotificationData,
    schoolName?: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196f3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196f3; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName || 'School Management System'}</h1>
            <h2>Report Card Available</h2>
          </div>
          <div class="content">
            <p>Dear Parent/Guardian,</p>
            <p>We are pleased to inform you that the report card for <strong>${data.studentName}</strong> (Student #${data.studentNumber}) is now available.</p>
            
            <div class="info-box">
              <p><strong>Term:</strong> Term ${data.termNumber}, ${data.termYear}</p>
              <p><strong>Class:</strong> ${data.className}</p>
              <p><strong>Exam Type:</strong> ${data.examType}</p>
            </div>
            
            <p>You can view and download the report card by logging into the school management system.</p>
            <p>If you have any questions or concerns, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName || 'School Management System'}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate invoice email HTML
   */
  private generateInvoiceEmail(
    data: InvoiceNotificationData,
    schoolName?: string,
  ): string {
    const dueDateText = data.dueDate
      ? `<p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleDateString()}</p>`
      : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196f3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196f3; }
          .amount { font-size: 24px; font-weight: bold; color: #2196f3; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName || 'School Management System'}</h1>
            <h2>New Invoice Generated</h2>
          </div>
          <div class="content">
            <p>Dear Parent/Guardian,</p>
            <p>A new invoice has been generated for <strong>${data.studentName}</strong> (Student #${data.studentNumber}).</p>
            
            <div class="info-box">
              <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
              <p><strong>Invoice Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString()}</p>
              ${dueDateText}
              <p class="amount">Total Amount: ${data.totalAmount.toLocaleString()} ${this.getCurrencySymbol()}</p>
            </div>
            
            <p>Please log into the school management system to view the invoice details and make payment.</p>
            <p>If you have any questions, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName || 'School Management System'}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate payment receipt email HTML
   */
  private generatePaymentEmail(
    data: PaymentNotificationData,
    schoolName?: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4caf50; }
          .amount { font-size: 24px; font-weight: bold; color: #4caf50; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName || 'School Management System'}</h1>
            <h2>Payment Received</h2>
          </div>
          <div class="content">
            <p>Dear Parent/Guardian,</p>
            <p>We have received a payment for <strong>${data.studentName}</strong> (Student #${data.studentNumber}).</p>
            
            <div class="info-box">
              <p><strong>Receipt Number:</strong> ${data.receiptNumber}</p>
              <p><strong>Payment Date:</strong> ${new Date(data.paymentDate).toLocaleDateString()}</p>
              <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
              <p class="amount">Amount Paid: ${data.amount.toLocaleString()} ${this.getCurrencySymbol()}</p>
            </div>
            
            <p>Thank you for your payment. You can view the receipt details by logging into the school management system.</p>
            <p>If you have any questions, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName || 'School Management System'}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate low balance alert email HTML
   */
  private generateLowBalanceEmail(
    data: LowBalanceNotificationData,
    schoolName?: string,
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #ff9800; }
          .amount { font-size: 24px; font-weight: bold; color: #ff9800; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName || 'School Management System'}</h1>
            <h2>Low Balance Alert</h2>
          </div>
          <div class="content">
            <p>Dear Parent/Guardian,</p>
            <p>This is to inform you that the account balance for <strong>${data.studentName}</strong> (Student #${data.studentNumber}) is low.</p>
            
            <div class="info-box">
              <p class="amount">Current Balance: ${data.currentBalance.toLocaleString()} ${this.getCurrencySymbol()}</p>
            </div>
            
            <p>Please arrange to make a payment to avoid any inconvenience. You can view the account details and make payment by logging into the school management system.</p>
            <p>If you have any questions, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName || 'School Management System'}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get currency symbol
   */
  private getCurrencySymbol(): string {
    // Default currency symbol - can be enhanced to read from settings
    return '$';
  }

  /**
   * Send application confirmation notification (on submission)
   */
  async sendApplicationConfirmation(
    data: ApplicationNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    const schoolName = settings.schoolName || 'School Management System';
    const fullName = `${data.applicantName} ${data.applicantSurname}`;

    // Email notification
    if (settings.emailNotificationsEnabled && data.applicantEmail) {
      const subject = `Application Received - ${data.applicationId}`;
      const html = this.generateApplicationConfirmationEmail(data, schoolName);

      await this.emailService.sendEmail({
        to: data.applicantEmail,
        subject,
        html,
      });
    }

    // SMS notification
    if (settings.smsNotificationsEnabled && data.applicantCell) {
      const message = `Dear ${data.applicantName}, your application ${data.applicationId} has been received by ${schoolName}. We will review it and get back to you soon. Track status: [tracking URL]`;
      await this.smsService.sendSms(data.applicantCell, message);
    }

    // Also notify parent if different email/cell
    if (data.parentEmail && data.parentEmail !== data.applicantEmail) {
      if (settings.emailNotificationsEnabled) {
        const subject = `Application Received - ${data.applicationId}`;
        const html = this.generateApplicationConfirmationEmail(data, schoolName, true);
        await this.emailService.sendEmail({
          to: data.parentEmail,
          subject,
          html,
        });
      }
    }

    if (data.parentCell && data.parentCell !== data.applicantCell) {
      if (settings.smsNotificationsEnabled) {
        const message = `Application ${data.applicationId} for ${fullName} has been received by ${schoolName}. We will review it and get back to you soon.`;
        await this.smsService.sendSms(data.parentCell, message);
      }
    }

    return true;
  }

  /**
   * Send application status update notification
   */
  async sendApplicationStatusUpdate(
    data: ApplicationNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    const schoolName = settings.schoolName || 'School Management System';
    const fullName = `${data.applicantName} ${data.applicantSurname}`;

    let statusMessage = '';
    let emailSubject = '';
    let smsMessage = '';

    switch (data.status) {
      case ApplicationStatus.ON_HOLD:
        statusMessage = 'Your application has been placed on hold. We may need additional information.';
        emailSubject = `Application Update - ${data.applicationId}`;
        smsMessage = `Dear ${data.applicantName}, your application ${data.applicationId} has been placed on hold. We may contact you for additional information.`;
        break;
      case ApplicationStatus.DECLINED:
        statusMessage = 'We regret to inform you that your application has been declined.';
        emailSubject = `Application Decision - ${data.applicationId}`;
        smsMessage = `Dear ${data.applicantName}, we regret to inform you that application ${data.applicationId} has been declined. Thank you for your interest.`;
        break;
      case ApplicationStatus.ACCEPTED:
        statusMessage = 'Congratulations! Your application has been accepted.';
        emailSubject = `Application Accepted - ${data.applicationId}`;
        smsMessage = `Dear ${data.applicantName}, congratulations! Your application ${data.applicationId} has been accepted. Student Number: ${data.studentNumber || 'TBD'}. Check your email for next steps.`;
        break;
      default:
        return false;
    }

    // Email notification
    if (settings.emailNotificationsEnabled && data.applicantEmail) {
      const html = this.generateApplicationStatusUpdateEmail(
        data,
        schoolName,
        statusMessage,
      );
      await this.emailService.sendEmail({
        to: data.applicantEmail,
        subject: emailSubject,
        html,
      });
    }

    // SMS notification
    if (settings.smsNotificationsEnabled && data.applicantCell) {
      await this.smsService.sendSms(data.applicantCell, smsMessage);
    }

    // Notify parent if different
    if (data.parentEmail && data.parentEmail !== data.applicantEmail) {
      if (settings.emailNotificationsEnabled) {
        const html = this.generateApplicationStatusUpdateEmail(
          data,
          schoolName,
          statusMessage,
          true,
        );
        await this.emailService.sendEmail({
          to: data.parentEmail,
          subject: emailSubject,
          html,
        });
      }
    }

    if (data.parentCell && data.parentCell !== data.applicantCell) {
      if (settings.smsNotificationsEnabled) {
        const parentMessage = `Application ${data.applicationId} for ${fullName}: ${statusMessage}`;
        await this.smsService.sendSms(data.parentCell, parentMessage);
      }
    }

    return true;
  }

  /**
   * Send acceptance notification with student number and signup instructions
   */
  async sendAcceptanceNotification(
    data: ApplicationNotificationData,
  ): Promise<boolean> {
    const settings = await this.systemSettingsService.getSettings();
    const schoolName = settings.schoolName || 'School Management System';
    const fullName = `${data.applicantName} ${data.applicantSurname}`;

    if (!data.studentNumber) {
      this.logger.warn(
        `Cannot send acceptance notification for ${data.applicationId}: student number missing`,
      );
      return false;
    }

    // Email notification
    if (settings.emailNotificationsEnabled && data.applicantEmail) {
      const subject = `Welcome to ${schoolName} - Application Accepted`;
      const html = this.generateAcceptanceEmail(data, schoolName);
      await this.emailService.sendEmail({
        to: data.applicantEmail,
        subject,
        html,
      });
    }

    // SMS notification
    if (settings.smsNotificationsEnabled && data.applicantCell) {
      const message = `Congratulations ${data.applicantName}! Your application ${data.applicationId} has been accepted. Your Student Number is ${data.studentNumber}. Please check your email for signup instructions.`;
      await this.smsService.sendSms(data.applicantCell, message);
    }

    // Notify parent
    if (data.parentEmail && data.parentEmail !== data.applicantEmail) {
      if (settings.emailNotificationsEnabled) {
        const subject = `Welcome to ${schoolName} - Application Accepted`;
        const html = this.generateAcceptanceEmail(data, schoolName, true);
        await this.emailService.sendEmail({
          to: data.parentEmail,
          subject,
          html,
        });
      }
    }

    if (data.parentCell && data.parentCell !== data.applicantCell) {
      if (settings.smsNotificationsEnabled) {
        const message = `Application ${data.applicationId} for ${fullName} has been accepted. Student Number: ${data.studentNumber}. Check email for details.`;
        await this.smsService.sendSms(data.parentCell, message);
      }
    }

    return true;
  }

  /**
   * Generate application confirmation email HTML
   */
  private generateApplicationConfirmationEmail(
    data: ApplicationNotificationData,
    schoolName: string,
    isParent: boolean = false,
  ): string {
    const recipientName = isParent
      ? 'Parent/Guardian'
      : `${data.applicantName} ${data.applicantSurname}`;
    const applicantName = `${data.applicantName} ${data.applicantSurname}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196f3; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #2196f3; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName}</h1>
            <h2>Application Received</h2>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            <p>Thank you for submitting an application to ${schoolName}.</p>
            
            <div class="info-box">
              <p><strong>Application Reference:</strong> ${data.applicationId}</p>
              <p><strong>Applicant Name:</strong> ${applicantName}</p>
              <p><strong>Status:</strong> Pending Review</p>
            </div>
            
            <p>We have received your application and it is currently under review. We will notify you once a decision has been made.</p>
            <p>You can track the status of your application using the reference number above.</p>
            
            <p>If you have any questions, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate application status update email HTML
   */
  private generateApplicationStatusUpdateEmail(
    data: ApplicationNotificationData,
    schoolName: string,
    statusMessage: string,
    isParent: boolean = false,
  ): string {
    const recipientName = isParent
      ? 'Parent/Guardian'
      : `${data.applicantName} ${data.applicantSurname}`;
    const applicantName = `${data.applicantName} ${data.applicantSurname}`;
    const headerColor =
      data.status === ApplicationStatus.ACCEPTED
        ? '#4caf50'
        : data.status === ApplicationStatus.DECLINED
          ? '#f44336'
          : '#ff9800';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${headerColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${headerColor}; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName}</h1>
            <h2>Application Status Update</h2>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            <p>${statusMessage}</p>
            
            <div class="info-box">
              <p><strong>Application Reference:</strong> ${data.applicationId}</p>
              <p><strong>Applicant Name:</strong> ${applicantName}</p>
              <p><strong>Status:</strong> ${data.status.toUpperCase().replace('_', ' ')}</p>
              ${data.studentNumber ? `<p><strong>Student Number:</strong> ${data.studentNumber}</p>` : ''}
            </div>
            
            ${data.status === ApplicationStatus.ACCEPTED
        ? '<p>Please check your email for next steps on how to sign up and access your student account.</p>'
        : data.status === ApplicationStatus.ON_HOLD
          ? '<p>We may contact you for additional information. Please ensure your contact details are up to date.</p>'
          : '<p>Thank you for your interest in our school.</p>'}
            
            <p>If you have any questions, please contact the school administration.</p>
            
            <p>Best regards,<br>${schoolName}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate acceptance email HTML with signup instructions
   */
  private generateAcceptanceEmail(
    data: ApplicationNotificationData,
    schoolName: string,
    isParent: boolean = false,
  ): string {
    const recipientName = isParent
      ? 'Parent/Guardian'
      : `${data.applicantName} ${data.applicantSurname}`;
    const applicantName = `${data.applicantName} ${data.applicantSurname}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4caf50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
          .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
          .info-box { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #4caf50; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4caf50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${schoolName}</h1>
            <h2>Welcome! Your Application Has Been Accepted</h2>
          </div>
          <div class="content">
            <p>Dear ${recipientName},</p>
            <p>Congratulations! We are pleased to inform you that your application has been accepted.</p>
            
            <div class="info-box">
              <p><strong>Application Reference:</strong> ${data.applicationId}</p>
              <p><strong>Applicant Name:</strong> ${applicantName}</p>
              <p><strong>Student Number:</strong> ${data.studentNumber}</p>
            </div>
            
            <h3>Next Steps:</h3>
            <ol>
              <li>Visit the school portal and click on "Sign Up"</li>
              <li>Use your Student Number: <strong>${data.studentNumber}</strong></li>
              <li>Create your username and password</li>
              <li>Complete your profile and start using the system</li>
            </ol>
            
            <p>Your student account has been automatically created. You can now sign up using your student number to access the portal.</p>
            
            <p>If you have any questions or need assistance, please contact the school administration.</p>
            
            <p>We look forward to welcoming you to ${schoolName}!</p>
            
            <p>Best regards,<br>${schoolName}</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

