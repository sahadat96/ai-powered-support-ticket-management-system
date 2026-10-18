import {
  Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { TriageResult } from '../../ai/domain/triage';
import { UserOrmEntity } from '../../users/infrastructure/user.orm-entity';
import type { TicketCategory, TicketPriority, TicketStatus } from '../domain/ticket';

@Entity({ name: 'tickets', schema: 'support' })
export class TicketOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer', generated: 'increment', unique: true })
  number!: number;

  @Column({ type: 'varchar', length: 160 })
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', length: 20, default: 'OPEN' })
  status!: TicketStatus;

  @Column({ type: 'varchar', length: 20 })
  priority!: TicketPriority;

  @Column({ type: 'varchar', length: 20 })
  category!: TicketCategory;

  @Column({ name: 'requester_id', type: 'uuid' })
  requesterId!: string;

  @ManyToOne(() => UserOrmEntity, { nullable: false })
  @JoinColumn({ name: 'requester_id' })
  requester!: UserOrmEntity;

  @Column({ name: 'assignee_id', type: 'uuid', nullable: true })
  assigneeId!: string | null;

  @ManyToOne(() => UserOrmEntity, { nullable: true })
  @JoinColumn({ name: 'assignee_id' })
  assignee!: UserOrmEntity | null;

  @Column({ type: 'jsonb' })
  ai!: TriageResult;

  @Column({ type: 'integer', default: 1 })
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt!: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
