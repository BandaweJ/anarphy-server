import { Column, Entity, Index, ManyToOne, JoinColumn, PrimaryGeneratedColumn } from 'typeorm';
import { TermsEntity } from 'src/enrolment/entities/term.entity';

@Entity('report_releases')
@Index(['name', 'num', 'year', 'examType'], { unique: true })
export class ReportReleaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  num: number;

  @Column()
  year: number;

  @Column({ nullable: true })
  termId?: number;

  @Column()
  examType: string;

  @ManyToOne(() => TermsEntity, { nullable: true })
  @JoinColumn({ name: 'termId' })
  term?: TermsEntity;

  @Column({ default: false })
  released: boolean;

  @Column({ nullable: true })
  releasedAt?: Date;

  @Column({ nullable: true })
  releasedBy?: string;
}
