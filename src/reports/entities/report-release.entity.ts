import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column()
  examType: string;

  @Column({ default: false })
  released: boolean;

  @Column({ nullable: true })
  releasedAt?: Date;

  @Column({ nullable: true })
  releasedBy?: string;
}
