/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsController } from './controllers/applications.controller';
import { ApplicationsService } from './services/applications.service';
import { ApplicationEntity } from './entities/application.entity';
import { AccountsEntity } from 'src/auth/entities/accounts.entity';
import { ProfilesModule } from 'src/profiles/profiles.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { SystemModule } from 'src/system/system.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationEntity, AccountsEntity]),
    ProfilesModule,
    forwardRef(() => NotificationsModule),
    SystemModule,
  ],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}

