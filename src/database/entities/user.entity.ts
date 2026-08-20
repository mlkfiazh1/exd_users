import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class Users {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Index('user-email-idx')
  @Column('varchar', { length: 100 })
  email: string;

  @Column({ type: 'text' })
  password: string;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  attempts?: number;

  @Column({ type: 'int', unsigned: true, nullable: true })
  otpCode?: number;

  @Index('user-status-idx')
  @Column({ type: 'tinyint', default: 3, unsigned: true }) // 0 = delete, 1 = Active, 2 = Inactive, 3 = Unverified
  status?: number;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;
}
