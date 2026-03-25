/* eslint-disable prettier/prettier */
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubjectsEntity } from './subjects.entity';
import { StudentsEntity } from '../../profiles/entities/students.entity';
import { TermsEntity } from '../../enrolment/entities/term.entity';

@Entity('marks')
export class MarksEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => TermsEntity, { nullable: false })
  @JoinColumn({ name: 'termId' })
  term: TermsEntity;

  @Column()
  name: string;

  @Column()
  mark: number;

  @Column({ nullable: true })
  termMark?: number;

  @Column()
  comment: string;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  date: Date;

  @Column({ nullable: true })
  examType: string;

  @ManyToOne(() => SubjectsEntity, (subject) => subject.marks, {
    nullable: false,
  })
  @JoinColumn()
  subject: SubjectsEntity;

  @ManyToOne(() => StudentsEntity, (student) => student.marks, {
    nullable: false,
  })
  @JoinColumn()
  student: StudentsEntity;

  position?: string;
}
