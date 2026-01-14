/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { EmailService } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { SmsService } from './services/sms.service';
import { SystemModule } from '../system/system.module';

@Module({
  imports: [forwardRef(() => SystemModule)],
  providers: [EmailService, SmsService, NotificationService],
  exports: [EmailService, SmsService, NotificationService],
})
export class NotificationsModule {}

