/* eslint-disable prettier/prettier */
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountsEntity } from 'src/auth/entities/accounts.entity';
import { StudentsEntity } from 'src/profiles/entities/students.entity';

export enum ApplicationStatus {
  PENDING = 'pending',
  ON_HOLD = 'on_hold',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Entity('applications')
export class ApplicationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  applicationId: string; // Reference number (e.g., APP-2025-000001)

  // Personal Information
  @Column()
  name: string;

  @Column()
  surname: string;

  @Column()
  gender: string;

  @Column({ type: 'timestamp', nullable: true })
  dob: Date | null;

  @Column({ nullable: true })
  idnumber: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  cell: string | null;

  @Column({ nullable: true })
  address: string | null;

  // Academic Information
  @Column({ nullable: true })
  prevSchool: string | null;

  @Column({ type: 'text', nullable: true })
  prevSchoolRecords: string | null; // Can store JSON or text

  @Column()
  desiredClass: string; // Desired class/level

  // Parent/Guardian Information
  @Column()
  parentName: string;

  @Column()
  parentSurname: string;

  @Column({ nullable: true })
  parentEmail: string | null;

  @Column({ nullable: true })
  parentCell: string | null;

  @Column({ nullable: true })
  parentRelationship: string | null; // e.g., "Father", "Mother", "Guardian"

  // Application Status and Review
  @Column({
    type: 'enum',
    enum: ApplicationStatus,
    default: ApplicationStatus.PENDING,
  })
  status: ApplicationStatus;

  @ManyToOne(() => AccountsEntity, { nullable: true })
  @JoinColumn({ name: 'reviewedBy' })
  reviewedBy: AccountsEntity | null;

  @Column({ nullable: true })
  reviewedByAccountId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  reviewNotes: string | null;

  // Link to student when accepted
  @OneToOne(() => StudentsEntity, { nullable: true })
  @JoinColumn({ name: 'studentNumber' })
  student: StudentsEntity | null;

  @Column({ nullable: true })
  studentNumber: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}



