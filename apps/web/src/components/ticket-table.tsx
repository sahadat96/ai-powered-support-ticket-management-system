'use client';
import Link from 'next/link';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { Ticket, date, initials, ticketNumber } from '@/lib/types';
import { Badge, EmptyState } from './ui';
export function TicketTable({tickets, compact = false}: {tickets: Ticket[]; compact?: boolean}) {
  if (!tickets.length) return <EmptyState/>;
  return <div className="table-scroll"><table className={`ticket-table ${compact ? 'dashboard-table' : ''}`}><thead><tr><th>TICKET / SUBJECT</th><th>STATUS</th><th className="hide-small">PRIORITY</th>{!compact && <th>CATEGORY</th>}<th className="hide-medium">ASSIGNEE</th>{!compact && <th>CREATED</th>}<th><span className="sr-only">Open ticket</span></th></tr></thead><tbody>{tickets.map(ticket => <tr key={ticket.id}><td className="ticket-subject"><Link href={`/tickets/${ticket.id}`}>{ticket.title}</Link><small><span>{ticketNumber(ticket.number)}</span><span>·</span>{ticket.requester.name}</small></td><td><Badge value={ticket.status}/></td><td className="hide-small"><Badge value={ticket.priority} kind="priority"/></td>{!compact && <td><Badge value={ticket.category} kind="category"/></td>}<td className="hide-medium">{ticket.assignee ? <span className="avatar purple" title={ticket.assignee.name}>{initials(ticket.assignee.name)}</span> : <span className="muted" style={{fontSize: 10}}>Unassigned</span>}</td>{!compact && <td className="muted" style={{fontSize: 10}}>{date(ticket.createdAt)}</td>}<td><Link className="icon-button" aria-label={`Open ${ticketNumber(ticket.number)}`} href={`/tickets/${ticket.id}`}><ArrowUpRight size={14}/></Link></td></tr>)}</tbody></table></div>;
}
