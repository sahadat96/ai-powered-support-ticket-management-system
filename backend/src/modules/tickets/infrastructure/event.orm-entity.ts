import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserOrmEntity } from '../../users/infrastructure/user.orm-entity';
import { TicketOrmEntity } from './ticket.orm-entity';

@Entity({ name: 'ticket_events', schema: 'support' })
export class EventOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketOrmEntity, { nullable: false })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketOrmEntity;

  @Column({ name: 'actor_id', type: 'uuid' })
  actorId!: string;

  @ManyToOne(() => UserOrmEntity, { nullable: false })
  @JoinColumn({ name: 'actor_id' })
  actor!: UserOrmEntity;

  @Column({ type: 'varchar', length: 40 })
  action!: string;

  @Column({ type: 'text' })
  detail!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
