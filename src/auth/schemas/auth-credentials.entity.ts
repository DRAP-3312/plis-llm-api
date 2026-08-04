import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
} from 'typeorm';

@Entity('auth_credentials')
export class AuthCredentials {
  @PrimaryColumn('uuid')
  playerId!: string;

  @Index({ unique: true })
  @Column()
  username!: string;

  @Column()
  passwordHash!: string;

  @Index()
  @Column()
  registrationIpHash!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
