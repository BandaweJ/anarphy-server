/* eslint-disable prettier/prettier */
import { AccountsEntity } from 'src/auth/entities/accounts.entity';
import {
  Column,
  Entity,
  PrimaryColumn,
  BaseEntity,
  OneToOne,
  JoinColumn,
  Timestamp,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('teachers')
export class TeachersEntity extends BaseEntity {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column()
  surname: string;

  @Column({ nullable: true })
  dob?: Date;

  @Column()
  gender: string;

  @Column()
  title: string;

  @Column({ default: Timestamp })
  dateOfJoining: Date;

  @Column({ type: 'simple-array', nullable: true })
  qualifications?: string[];

  @Column({ default: true })
  active: boolean;

  @Column()
  cell: string;

  @Column()
  email: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ nullable: true })
  dateOfLeaving?: Date;

  @Column()
  role: string;

  @OneToOne(() => AccountsEntity, (account) => account.teacher)
  account: AccountsEntity;

}
