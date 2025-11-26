import { BaseEntity, Column, Entity, OneToMany, PrimaryColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { StudentsEntity } from './students.entity';

@Entity('parents')
export class ParentsEntity extends BaseEntity {
  @PrimaryColumn()
  email: string;

  @Column({ nullable: true })
  name: string;

  @Column()
  surname: string;

  @Column()
  sex: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  idnumber: string;

  @Column()
  cell: string;

  @Column()
  address: string;

  @Column({ default: 'parent' })
  role: string;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => StudentsEntity, (student) => student.parent)
  students: StudentsEntity[];
}
