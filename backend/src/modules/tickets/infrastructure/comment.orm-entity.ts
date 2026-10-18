import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { UserOrmEntity } from '../../users/infrastructure/user.orm-entity';
import { TicketOrmEntity } from './ticket.orm-entity';

@Entity({ name: 'comments', schema: 'support' })
export class CommentOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => TicketOrmEntity, { nullable: false })
  @JoinColumn({ name: 'ticket_id' })
  ticket!: TicketOrmEntity;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => UserOrmEntity, { nullable: false })
  @JoinColumn({ name: 'author_id' })
  author!: UserOrmEntity;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'boolean', default: false })
  internal!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
