'use client';
import {AlertCircle, Inbox, LoaderCircle, RotateCw} from 'lucide-react';
import type {ReactNode} from 'react';
import type {Category, Priority, Status} from '@/lib/types';
import {label} from '@/lib/format';
export function Spinner({small = false}: {small?: boolean}) {return <LoaderCircle size={small ? 16 : 24} className="spin" aria-label="Loading"/>;}
export function StatusBadge({status}: {status: Status}) {return <span className={`badge status-${status.toLowerCase()}`}><span className="status-dot"/>{label(status)}</span>;}
export function PriorityBadge({priority}: {priority: Priority}) {return <span className={`priority priority-${priority.toLowerCase()}`}><span className="priority-bars" aria-hidden="true">▂▅▇</span>{label(priority)}</span>;}
export function CategoryBadge({category}: {category: Category}) {return <span className="category-badge">{label(category)}</span>;}
export function Avatar({name, small = false}: {name: string; small?: boolean}) {return <span className={`avatar ${small ? 'avatar-small' : ''}`} aria-hidden="true">{name.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase()}</span>;}
export function ErrorState({message, retry}: {message: string; retry?: () => void}) {return <div className="error-state" role="alert"><AlertCircle size={22}/><div><strong>We couldn’t load this.</strong><p>{message}</p></div>{retry && <button className="btn btn-secondary btn-small" onClick={retry}><RotateCw size={15}/>Try again</button>}</div>;}
export function EmptyState({title = 'No tickets here yet', description, action}: {title?: string; description: string; action?: ReactNode}) {return <div className="empty-state"><span className="empty-icon"><Inbox size={28}/></span><h3>{title}</h3><p>{description}</p>{action}</div>;}
export function PageHeading({eyebrow, title, description, action}: {eyebrow?: string; title: string; description?: string; action?: ReactNode}) {return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>;}
export function LoadingState({rows = 4}: {rows?: number}) {return <div className="skeleton-group" aria-busy="true" aria-label="Loading content">{Array.from({length: rows}, (_, i) => <div className="skeleton" key={i}/>)}</div>;}
