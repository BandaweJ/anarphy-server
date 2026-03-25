/* eslint-disable prettier/prettier */
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import { ManyToOne, JoinColumn } from 'typeorm';
import { ReportModel } from '../models/report.model';
import { TermsEntity } from 'src/enrolment/entities/term.entity';

@Entity('reports')
export class ReportsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  num: number;

  @Column()
  year: number;

  @Column({ nullable: true })
  termId?: number;

  @ManyToOne(() => TermsEntity, { nullable: true })
  @JoinColumn({ name: 'termId' })
  term?: TermsEntity;

  @Column()
  name: string;

  @Column()
  studentNumber: string;

  @Column('simple-json')
  report: ReportModel;

  @Column({ nullable: true })
  examType: string;
}
