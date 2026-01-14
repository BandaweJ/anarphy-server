/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { SystemSettingsService } from '../../system/services/system-settings.service';

// Dynamic import for Twilio to handle case when package is not installed
let twilio: any;
try {
  twilio = require('twilio');
} catch (error) {
  // Twilio package not installed yet
  twilio = null;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: any | null = null;
  private settingsLoaded = false;

  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  /**
   * Initialize Twilio client
   */
  private async initializeTwilioClient(): Promise<any | null> {
    if (this.twilioClient && this.settingsLoaded) {
      return this.twilioClient;
    }

    // Check if Twilio package is installed
    if (!twilio) {
      this.logger.warn(
        'Twilio package not installed. Please run: npm install twilio',
      );
      this.settingsLoaded = true;
      return null;
    }

    try {
      const settings = await this.systemSettingsService.getSettings();

      if (
        !settings.twilioAccountSid ||
        !settings.twilioAuthToken ||
        !settings.twilioPhoneNumber
      ) {
        this.logger.warn(
          'Twilio credentials not configured. SMS sending will be disabled.',
        );
        this.settingsLoaded = true;
        return null;
      }

      this.twilioClient = twilio(
        settings.twilioAccountSid,
        settings.twilioAuthToken,
      );
      this.settingsLoaded = true;
      this.logger.log('Twilio client initialized successfully');
      return this.twilioClient;
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client:', error);
      this.settingsLoaded = true;
      return null;
    }
  }

  /**
   * Send SMS message
   */
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      const settings = await this.systemSettingsService.getSettings();
      if (!settings.smsNotificationsEnabled) {
        this.logger.warn('SMS notifications are disabled in settings');
        return false;
      }

      const client = await this.initializeTwilioClient();
      if (!client) {
        this.logger.warn('Twilio client not available, skipping SMS send');
        return false;
      }

      // Ensure phone number has country code format
      const formattedPhoneNumber = this.formatPhoneNumber(phoneNumber);

      const result = await client.messages.create({
        body: message,
        from: settings.twilioPhoneNumber,
        to: formattedPhoneNumber,
      });

      this.logger.log(`SMS sent successfully: ${result.sid} to ${formattedPhoneNumber}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${phoneNumber}:`, error);
      return false;
    }
  }

  /**
   * Format phone number to include country code if missing
   * Assumes Zimbabwe (+263) if no country code is present
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove any spaces, dashes, or parentheses
    const cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');

    // If it already starts with +, return as is
    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    // If it starts with 0, replace with +263 (Zimbabwe country code)
    if (cleaned.startsWith('0')) {
      return `+263${cleaned.substring(1)}`;
    }

    // If it starts with 263, add +
    if (cleaned.startsWith('263')) {
      return `+${cleaned}`;
    }

    // Otherwise, assume it's a local number and add +263
    return `+263${cleaned}`;
  }
}

