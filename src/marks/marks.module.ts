/* eslint-disable prettier/prettier */
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { MarksController } from './marks.controller';
import { MarksService } from './marks.service';
import { SubjectsEntity } from './entities/subjects.entity';
import { MarksEntity } from './entities/marks.entity';
import { ResourceByIdModule } from '../resource-by-id/resource-by-id.module';
import { AuthModule } from '../auth/auth.module';
import { EnrolmentModule } from 'src/enrolment/enrolment.module';
import { ProfilesModule } from 'src/profiles/profiles.module';

@Module({
  imports: [
    AuthModule,
    ResourceByIdModule,
    EnrolmentModule,
    ProfilesModule,
    TypeOrmModule.forFeature([
      SubjectsEntity,
      MarksEntity,
    ]),
  ],
  controllers: [MarksController],
  providers: [MarksService],
  exports: [MarksService],
})
export class MarksModule {}
