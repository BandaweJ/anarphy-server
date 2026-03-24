/* eslint-disable prettier/prettier */
import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { EnrolEntity } from './enrol.entity';

export enum TermType {
  REGULAR = 'regular',
  VACATION = 'vacation',
}

@Entity('terms')
@Index(['num', 'year'], { unique: true })
export class TermsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  num: number;

  @Column()
  year: number;

  @Column({ type: 'varchar', default: TermType.REGULAR })
  type: TermType;

  @Column()
  startDate: Date;

  @Column()
  endDate: Date;

  @OneToMany(() => EnrolEntity, (enrol) => enrol.term)
  enrolments: EnrolEntity[];
}
