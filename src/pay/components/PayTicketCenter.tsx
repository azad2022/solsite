import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CircleCheck, Loader2, MessageSquare, Plus, RefreshCw, Send, ShieldCheck } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import type { PaySessionUser } from '../services/sessionService';
import { createPayTicket, getPayTicket, listPayTickets, replyToPayTicket, updatePayTicketStatus, type PayTicket, type PayTicketDetail, type PayTicketPriority, type PayTicketStatus } from '../services/ticketService';
import { ticketT, type TicketTranslationKey } from './pay-tickets-i18n';
import './pay-tickets.css';

interface Props { locale: PayLocale; sessionUser: PaySessionUser; merchantId: string | null; }
const STATUSES: PayTicketStatus[] = ['open','pending_customer','pending_admin','resolved','closed'];
const PRIORITIES: PayTicketPriority[] = ['normal','high','urgent'];
function translateStatus(locale: PayLocale, status: PayTicketStatus): string { const key: Record<PayTicketStatus, TicketTranslationKey> = { open:'open', pending_customer:'pendingCustomer', pending_admin:'pendingAdmin', resolved:'resolved', closed:'closed' }; return ticketT(locale,key[status]); }
function priorityLabel(locale: PayLocale, priority: PayTicketPriority): string { return ticketT(locale, priority); }
function dateValue(value: string, locale: PayLocale): string { const intlLocale = locale === 'fa-IR' ? 'fa-IR' : locale === 'ar' ? 'ar' : locale === 'ru' ? 'ru-RU' : 'en-US'; return new Intl.DateTimeFormat(intlLocale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
function accessError(error: unknown): 'forbidden'|'unauthorized'|'error' { if (error instanceof PayHttpError) { if (error.status === 401) return 'unauthorized'; if (error.status === 403) return 'forbidden'; } return 'error'; }

export default function PayTicketCenter({ locale, sessionUser, merchantId }: Props): React.ReactElement {
  const isAdmin = sessionUser.role === 'admin';
  const [tickets,setTickets]=useState<PayTicket[]>([]); const [selectedId,setSelectedId]=useState<string|null>(null); const [detail,setDetail]=useState<PayTicketDetail|null>(null);
  const [loading,setLoading]=useState(true); const [detailLoading,setDetailLoading]=useState(false); const [error,setError]=useState<'error'|'forbidden'|'unauthorized'|null>(null); const [detailError,setDetailError]=useState<'error'|'forbidden'|'unauthorized'|null>(null);
  const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const [priority,setPriority]=useState<PayTicketPriority>('normal'); const [reply,setReply]=useState(''); const [busy,setBusy]=useState<'create'|'reply'|'status'|null>(null);

  async function loadTickets(selectFirst=true) { setLoading(true); setError(null); try { const rows=await listPayTickets({merchantId:isAdmin?undefined:merchantId}); setTickets(rows); if (selectFirst && rows[0]) setSelectedId(current=>current && rows.some(item=>item.id===current)?current:rows[0].id); else if (!rows.length) { setSelectedId(null); setDetail(null); } } catch (e) { setError(accessError(e)); } finally { setLoading(false); } }
  async function loadDetail(id:string) { setDetailLoading(true); setDetailError(null); try { setDetail(await getPayTicket(id)); } catch(e) { setDetailError(accessError(e)); } finally { setDetailLoading(false); } }
  useEffect(()=>{ void loadTickets(); },[merchantId,isAdmin]);
  useEffect(()=>{ if(selectedId) void loadDetail(selectedId); else setDetail(null); },[selectedId]);
  const selected = useMemo(()=>tickets.find(item=>item.id===selectedId)||detail?.ticket||null,[tickets,selectedId,detail]);
  async function handleCreate(event:React.FormEvent) { event.preventDefault(); if(!merchantId || !subject.trim() || !message.trim() || busy) return; setBusy('create'); setError(null); try { const created=await createPayTicket({merchantId,subject,message,priority}); setSubject(''); setMessage(''); setPriority('normal'); await loadTickets(false); setSelectedId(created.id); } catch(e) { setError(accessError(e)); } finally { setBusy(null); } }
  async function handleReply(event:React.FormEvent) { event.preventDefault(); if(!selectedId || !reply.trim() || busy) return; setBusy('reply'); setDetailError(null); try { await replyToPayTicket(selectedId,reply); setReply(''); await Promise.all([loadTickets(false),loadDetail(selectedId)]); } catch(e) { setDetailError(accessError(e)); } finally { setBusy(null); } }
  async function handleStatus(status:PayTicketStatus) { if(!selectedId || busy || !isAdmin) return; setBusy('status'); try { const updated=await updatePayTicketStatus(selectedId,status); setTickets(current=>current.map(item=>item.id===updated.id?updated:item)); setDetail(current=>current?{...current,ticket:updated}:current); } catch(e) { setDetailError(accessError(e)); } finally { setBusy(null); } }

  return <section className="pay-ticket-center" aria-label={ticketT(locale,'tickets')}>
    <div className="pay-ticket-heading"><div><div className="pay-panel-kicker">{isAdmin?ticketT(locale,'adminInbox'):ticketT(locale,'tickets')}</div><h2>{ticketT(locale,'title')}</h2><p>{ticketT(locale,'subtitle')}</p></div><button type="button" className="pay-icon-button" onClick={()=>void loadTickets(false)} aria-label={ticketT(locale,'retry')}><RefreshCw size={17}/></button></div>
    {error ? <div className={`pay-ticket-alert ${error==='forbidden'?'is-forbidden':''}`} role="alert"><AlertCircle size={18}/><span>{error==='forbidden'?ticketT(locale,'forbidden'):error==='unauthorized'?ticketT(locale,'unauthorized'):ticketT(locale,'error')}</span><button type="button" onClick={()=>void loadTickets()}>{ticketT(locale,'retry')}</button></div>:null}
    <div className="pay-ticket-layout">
      <div className="pay-ticket-list-pane">
        {loading ? <div className="pay-ticket-loading"><Loader2 className="spin" size={20}/>{ticketT(locale,'loading')}</div> : tickets.length ? <div className="pay-ticket-list">{tickets.map(item=><button type="button" key={item.id} className={`pay-ticket-list-item ${item.id===selectedId?'is-selected':''}`} onClick={()=>setSelectedId(item.id)}><div><strong>{item.subject}</strong><span>{dateValue(item.updatedAt,locale)}</span></div><div><span className={`pay-ticket-status status-${item.status}`}>{translateStatus(locale,item.status)}</span>{isAdmin?<span className={`pay-ticket-priority priority-${item.priority}`}>{priorityLabel(locale,item.priority)}</span>:null}</div></button>)}</div> : <div className="pay-ticket-empty"><MessageSquare size={22}/><strong>{ticketT(locale,'noTickets')}</strong></div>}
        {!isAdmin ? <form className="pay-ticket-new" onSubmit={handleCreate}><div className="pay-ticket-form-title"><Plus size={17}/>{ticketT(locale,'newTicket')}</div><label>{ticketT(locale,'subject')}<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160} required placeholder={ticketT(locale,'subjectHint')}/></label><label>{ticketT(locale,'priority')}<select value={priority} onChange={e=>setPriority(e.target.value as PayTicketPriority)}>{PRIORITIES.map(value=><option key={value} value={value}>{priorityLabel(locale,value)}</option>)}</select><small>{ticketT(locale,'priorityHelp')}</small></label><label>{ticketT(locale,'message')}<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={10000} rows={5} required placeholder={ticketT(locale,'messageHint')}/></label><button type="submit" className="pay-primary-action" disabled={!merchantId||busy!==null||!subject.trim()||!message.trim()}>{busy==='create'?<Loader2 className="spin" size={17}/>:<Send size={17}/>} {ticketT(locale,'send')}</button></form>:null}
      </div>
      <div className="pay-ticket-detail-pane">
        {!selected ? <div className="pay-ticket-detail-empty"><MessageSquare size={25}/><p>{ticketT(locale,'selectTicket')}</p></div> : detailLoading && !detail ? <div className="pay-ticket-loading"><Loader2 className="spin" size={20}/>{ticketT(locale,'loading')}</div> : <div className="pay-ticket-thread"><div className="pay-ticket-thread-header"><div><span className="pay-panel-kicker">{ticketT(locale,'details')}</span><h3>{selected.subject}</h3><p>{ticketT(locale,'status')}: {translateStatus(locale,selected.status)} · {priorityLabel(locale,selected.priority)}</p></div>{isAdmin?<select value={selected.status} disabled={busy==='status'} onChange={e=>void handleStatus(e.target.value as PayTicketStatus)} aria-label={ticketT(locale,'updateStatus')}>{STATUSES.map(value=><option key={value} value={value}>{translateStatus(locale,value)}</option>)}</select>:null}</div>
          {detailError?<div className="pay-ticket-alert" role="alert"><AlertCircle size={18}/><span>{detailError==='forbidden'?ticketT(locale,'forbidden'):detailError==='unauthorized'?ticketT(locale,'unauthorized'):ticketT(locale,'sendError')}</span><button type="button" onClick={()=>void loadDetail(selected.id)}>{ticketT(locale,'retry')}</button></div>:null}
          <div className="pay-ticket-messages">{detail?.messages.map(item=><article key={item.id} className={`pay-ticket-message ${item.authorUserId===sessionUser.id?'is-self':''}`}><div className="pay-ticket-message-meta"><span>{item.authorUserId===sessionUser.id?ticketT(locale,isAdmin?'admin':'merchant'):isAdmin?ticketT(locale,'merchant'):ticketT(locale,'admin')}</span><time>{dateValue(item.createdAt,locale)}</time></div><p>{item.body}</p></article>)}</div>
          {selected.status !== 'closed' ? <form className="pay-ticket-reply" onSubmit={handleReply}><label>{ticketT(locale,'message')}<textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} rows={4} required placeholder={ticketT(locale,'messageHint')}/></label><button type="submit" className="pay-primary-action" disabled={busy!==null||!reply.trim()}>{busy==='reply'?<Loader2 className="spin" size={17}/>:<Send size={17}/>} {ticketT(locale,'reply')}</button></form> : <div className="pay-ticket-closed"><CircleCheck size={18}/>{ticketT(locale,'closed')}</div>}
        </div>}
      </div>
    </div>
    {isAdmin?<div className="pay-ticket-admin-note"><ShieldCheck size={16}/><span>{ticketT(locale,'adminOnly')}</span></div>:null}
  </section>;
}
