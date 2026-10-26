import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Ban, CircleCheck, Loader2, MessageSquare, Plus, RefreshCw, Send, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { PayHttpError } from '../http';
import type { PayLocale } from '../types';
import type { PaySessionUser } from '../services/sessionService';
import { blockPayTicketUser, createPayTicket, deletePayTicket, getPayTicket, getPayTicketModeration, listPayTicketUserBlocks, listPayTickets, replyToPayTicket, unblockPayTicketUser, unblockPayTicketUserById, updatePayTicketStatus, type PayTicket, type PayTicketBlockedUser, type PayTicketDetail, type PayTicketModeration, type PayTicketPriority, type PayTicketStatus } from '../services/ticketService';
import { ticketT, type TicketTranslationKey } from './pay-tickets-i18n';
import PayTrainingCenter from './PayTrainingCenter';
import './pay-tickets.css';

interface Props { locale: PayLocale; sessionUser: PaySessionUser; merchantId: string | null; }
const STATUSES: PayTicketStatus[] = ['open','pending_customer','pending_admin','resolved','closed'];
const PRIORITIES: PayTicketPriority[] = ['normal','high','urgent'];
function translateStatus(locale: PayLocale, status: PayTicketStatus): string { const key: Record<PayTicketStatus, TicketTranslationKey> = { open:'open', pending_customer:'pendingCustomer', pending_admin:'pendingAdmin', resolved:'resolved', closed:'closed' }; return ticketT(locale,key[status]); }
function priorityLabel(locale: PayLocale, priority: PayTicketPriority): string { return ticketT(locale, priority); }
function dateValue(value: string, locale: PayLocale): string { const intlLocale = locale === 'fa-IR' ? 'fa-IR' : locale === 'ar' ? 'ar' : locale === 'ru' ? 'ru-RU' : 'en-US'; return new Intl.DateTimeFormat(intlLocale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)); }
function accessError(error: unknown): 'forbidden'|'unauthorized'|'rateLimited'|'error' { if (error instanceof PayHttpError) { if (error.status === 401) return 'unauthorized'; if (error.status === 403) return 'forbidden'; if (error.status === 429) return 'rateLimited'; } return 'error'; }

export default function PayTicketCenter({ locale, sessionUser, merchantId }: Props): React.ReactElement {
  const isAdmin = sessionUser.role === 'admin';
  const [tickets,setTickets]=useState<PayTicket[]>([]); const [selectedId,setSelectedId]=useState<string|null>(null); const [detail,setDetail]=useState<PayTicketDetail|null>(null); const ticketListRequestSeq=useRef(0); const detailRequestSeq=useRef(0); const moderationRequestSeq=useRef(0);
  const selectedTicketIdRef=useRef<string|null>(selectedId);
  selectedTicketIdRef.current=selectedId;
  const tenantContext=`${sessionUser.id}:${isAdmin?'admin':`merchant:${merchantId??'none'}`}`;
  const activeTenantContext=useRef(tenantContext);
  // Update synchronously so late responses/event handlers from a prior tenant cannot repaint this view.
  activeTenantContext.current=tenantContext;
  const [loading,setLoading]=useState(true); const [detailLoading,setDetailLoading]=useState(false); const [error,setError]=useState<'error'|'forbidden'|'unauthorized'|'rateLimited'|null>(null); const [detailError,setDetailError]=useState<'error'|'forbidden'|'unauthorized'|'rateLimited'|null>(null); const [moderation,setModeration]=useState<PayTicketModeration|null>(null); const [moderationLoading,setModerationLoading]=useState(false); const [moderationBusy,setModerationBusy]=useState(false); const [moderationError,setModerationError]=useState<'error'|'forbidden'|'unauthorized'|'rateLimited'|null>(null); const [blockReason,setBlockReason]=useState(''); const [blockedUsers,setBlockedUsers]=useState<PayTicketBlockedUser[]>([]); const [blockedUsersLoading,setBlockedUsersLoading]=useState(false); const [blockedUsersError,setBlockedUsersError]=useState<'error'|'forbidden'|'unauthorized'|'rateLimited'|null>(null);
  const [subject,setSubject]=useState(''); const [message,setMessage]=useState(''); const [priority,setPriority]=useState<PayTicketPriority>('normal'); const [reply,setReply]=useState(''); const [busy,setBusy]=useState<'create'|'reply'|'status'|'delete'|null>(null); const [notice,setNotice]=useState<'created'|'replied'|'status'|'deleted'|'blocked'|'unblocked'|null>(null);

  async function loadTickets(selectFirst=true): Promise<PayTicket[]|undefined> {
    const requestSeq=++ticketListRequestSeq.current;
    const requestContext=tenantContext;
    if (requestContext !== activeTenantContext.current) return;
    if (!isAdmin && !merchantId) {
      setTickets([]);
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows=await listPayTickets({merchantId:isAdmin?undefined:merchantId});
      if (requestSeq !== ticketListRequestSeq.current || requestContext !== activeTenantContext.current) return;
      setTickets(rows);
      if (selectFirst && rows[0]) setSelectedId(current=>current && rows.some(item=>item.id===current)?current:rows[0].id);
      else if (!rows.length) setSelectedId(null);
      else setSelectedId(current=>current && rows.some(item=>item.id===current)?current:null);
      return rows;
    } catch (e) {
      if (requestSeq !== ticketListRequestSeq.current || requestContext !== activeTenantContext.current) return;
      // Fail closed: do not leave another merchant's or stale ticket data visible.
      setTickets([]);
      setSelectedId(null);
      setDetail(null);
      setDetailError(null);
      setError(accessError(e));
      return;
    } finally {
      if (requestSeq === ticketListRequestSeq.current && requestContext === activeTenantContext.current) setLoading(false);
    }
  }
  async function loadDetail(id:string, requestContext=tenantContext): Promise<PayTicketDetail|undefined> { if(requestContext!==activeTenantContext.current || selectedTicketIdRef.current!==id) return; const requestSeq=++detailRequestSeq.current; setDetailLoading(true); setDetailError(null); try { const next=await getPayTicket(id); if (requestSeq !== detailRequestSeq.current || requestContext!==activeTenantContext.current || selectedTicketIdRef.current!==id) return; setDetail(next); return next; } catch(e) { if (requestSeq === detailRequestSeq.current && requestContext===activeTenantContext.current && selectedTicketIdRef.current===id) setDetailError(accessError(e)); return; } finally { if (requestSeq === detailRequestSeq.current && requestContext===activeTenantContext.current && selectedTicketIdRef.current===id) setDetailLoading(false); } }
  async function loadModeration(id:string, requestContext=tenantContext): Promise<void> { if(!isAdmin || requestContext!==activeTenantContext.current || selectedTicketIdRef.current!==id) return; const requestSeq=++moderationRequestSeq.current; setModerationLoading(true); setModerationError(null); try { const next=await getPayTicketModeration(id); if(requestSeq!==moderationRequestSeq.current || requestContext!==activeTenantContext.current || selectedTicketIdRef.current!==id) return; setModeration(next); } catch(e) { if(requestSeq===moderationRequestSeq.current && requestContext===activeTenantContext.current && selectedTicketIdRef.current===id) setModerationError(accessError(e)); } finally { if(requestSeq===moderationRequestSeq.current && requestContext===activeTenantContext.current && selectedTicketIdRef.current===id) setModerationLoading(false); } }
  async function loadBlockedUsers(): Promise<void> { if(!isAdmin) { setBlockedUsers([]); return; } const requestContext=tenantContext; setBlockedUsersLoading(true); setBlockedUsersError(null); try { const rows=await listPayTicketUserBlocks(); if(requestContext!==activeTenantContext.current) return; setBlockedUsers(rows); } catch(e) { if(requestContext===activeTenantContext.current) setBlockedUsersError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setBlockedUsersLoading(false); } }
  async function refreshSelectedTicket() { const requestContext=tenantContext; setNotice(null); const rows=await loadTickets(false); if(requestContext!==activeTenantContext.current || !rows) return; const id=selectedTicketIdRef.current; if(id && rows.some(item=>item.id===id)) await loadDetail(id,requestContext); }
  useEffect(()=>{
    // A tenant/role switch invalidates pending responses before they can repaint old ticket data.
    setTickets([]);
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
    setModeration(null);
    setModerationError(null);
    setBlockReason('');
    setBlockedUsers([]);
    setBlockedUsersError(null);
    setError(null);
    setNotice(null);
    setSubject('');
    setMessage('');
    setPriority('normal');
    setReply('');
    setBusy(null);
    ++ticketListRequestSeq.current;
    ++detailRequestSeq.current;
    ++moderationRequestSeq.current;
    void loadTickets();
    if(isAdmin) void loadBlockedUsers();
    return ()=>{ ++ticketListRequestSeq.current; ++detailRequestSeq.current; ++moderationRequestSeq.current; };
  },[tenantContext]);
  useEffect(()=>{ ++detailRequestSeq.current; ++moderationRequestSeq.current; if(selectedId) { setDetail(null); setDetailError(null); setModeration(null); setModerationError(null); void loadDetail(selectedId); if(isAdmin) void loadModeration(selectedId); } else { setDetail(null); setDetailError(null); setModeration(null); setModerationError(null); } },[selectedId,isAdmin,tenantContext]);
  const selected = useMemo(()=>selectedId ? tickets.find(item=>item.id===selectedId)||(detail?.ticket.id===selectedId?detail.ticket:null) : null,[tickets,selectedId,detail]);
  async function handleCreate(event:React.FormEvent) { event.preventDefault(); if(!merchantId || !subject.trim() || !message.trim() || busy) return; const requestContext=tenantContext; setBusy('create'); setError(null); setNotice(null); try { const created=await createPayTicket({merchantId,subject,message,priority}); if(requestContext!==activeTenantContext.current) return; setSubject(''); setMessage(''); setPriority('normal'); setNotice('created'); await loadTickets(false); if(requestContext===activeTenantContext.current) setSelectedId(created.id); } catch(e) { if(requestContext===activeTenantContext.current) setError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setBusy(null); } }
  async function handleReply(event:React.FormEvent) { event.preventDefault(); if(!selectedId || !reply.trim() || busy) return; const requestContext=tenantContext; const ticketId=selectedId; const replyBody=reply; setBusy('reply'); setDetailError(null); setNotice(null); try { await replyToPayTicket(ticketId,replyBody); if(requestContext!==activeTenantContext.current) return; void loadTickets(false); if(ticketId!==selectedTicketIdRef.current) return; setReply(''); setNotice('replied'); await loadDetail(ticketId,requestContext); } catch(e) { if(requestContext===activeTenantContext.current && ticketId===selectedTicketIdRef.current) setDetailError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setBusy(null); } }
  async function handleStatus(status:PayTicketStatus) { if(!selectedId || busy || moderationBusy || !isAdmin || !detail || detail.ticket.id!==selectedId || detailError) return; const requestContext=tenantContext; const ticketId=selectedId; setBusy('status'); setNotice(null); try { const updated=await updatePayTicketStatus(ticketId,status); if(requestContext!==activeTenantContext.current) return; setTickets(current=>current.map(item=>item.id===updated.id?updated:item)); setDetail(current=>current?.ticket.id===ticketId?{...current,ticket:updated}:current); if(ticketId===selectedTicketIdRef.current) setNotice('status'); } catch(e) { if(requestContext===activeTenantContext.current && ticketId===selectedTicketIdRef.current) setDetailError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setBusy(null); } }
  async function handleBlockUser() { if(!isAdmin || !selectedId || busy || moderationBusy || blockReason.trim().length<3 || blockReason.trim().length>500) return; if(!window.confirm(ticketT(locale,'blockConfirm'))) return; const requestContext=tenantContext; const ticketId=selectedId; setModerationBusy(true); setModerationError(null); setNotice(null); try { const next=await blockPayTicketUser(ticketId,blockReason); if(requestContext!==activeTenantContext.current || ticketId!==selectedTicketIdRef.current) return; setModeration(next); setBlockReason(''); setNotice('blocked'); } catch(e) { if(requestContext===activeTenantContext.current && ticketId===selectedTicketIdRef.current) setModerationError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setModerationBusy(false); } }
  async function handleUnblockUser() { if(!isAdmin || !selectedId || busy || moderationBusy) return; const requestContext=tenantContext; const ticketId=selectedId; setModerationBusy(true); setModerationError(null); setNotice(null); try { const next=await unblockPayTicketUser(ticketId); if(requestContext!==activeTenantContext.current || ticketId!==selectedTicketIdRef.current) return; setModeration(next); setBlockedUsers(current=>current.filter(item=>item.userId!==detail?.ticket.createdByUserId)); setNotice('unblocked'); } catch(e) { if(requestContext===activeTenantContext.current && ticketId===selectedTicketIdRef.current) setModerationError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setModerationBusy(false); } }
  async function handleUnblockFromList(userId:string) { if(!isAdmin || moderationBusy || busy) return; const requestContext=tenantContext; setModerationBusy(true); setBlockedUsersError(null); setNotice(null); try { await unblockPayTicketUserById(userId); if(requestContext!==activeTenantContext.current) return; setBlockedUsers(current=>current.filter(item=>item.userId!==userId)); if(selected?.createdByUserId===userId) setModeration({isBlocked:false,reason:null,blockedAt:null}); setNotice('unblocked'); } catch(e) { if(requestContext===activeTenantContext.current) setBlockedUsersError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setModerationBusy(false); } }
  async function handleDeleteTicket() { if(!isAdmin || !selectedId || busy || moderationBusy) return; if(!window.confirm(ticketT(locale,'deleteConfirm'))) return; const requestContext=tenantContext; const ticketId=selectedId; setBusy('delete'); setNotice(null); setDetailError(null); try { await deletePayTicket(ticketId); if(requestContext!==activeTenantContext.current || ticketId!==selectedTicketIdRef.current) return; setTickets(current=>current.filter(item=>item.id!==ticketId)); setSelectedId(null); setDetail(null); setModeration(null); setNotice('deleted'); void loadTickets(false); } catch(e) { if(requestContext===activeTenantContext.current && ticketId===selectedTicketIdRef.current) setDetailError(accessError(e)); } finally { if(requestContext===activeTenantContext.current) setBusy(null); } }

  return <section className="pay-ticket-center" aria-label={ticketT(locale,'tickets')}>
    <PayTrainingCenter locale={locale} />
    <div className="pay-ticket-heading"><div><h2>{ticketT(locale,'title')}</h2><p>{ticketT(locale,'subtitle')}</p></div><button type="button" className="pay-icon-button" onClick={()=>void refreshSelectedTicket()} aria-label={ticketT(locale,'retry')}><RefreshCw size={17}/></button></div>
    {notice ? <div className="pay-ticket-success" role="status" aria-live="polite"><CircleCheck size={18}/><span>{ticketT(locale,notice==='created'?'sent':notice==='replied'?'replied':notice==='status'?'statusUpdated':notice==='deleted'?'deleted':notice==='blocked'?'blocked':'unblocked')}</span></div> : null}
    {error ? <div className={`pay-ticket-alert ${error==='forbidden'?'is-forbidden':''}`} role="alert"><AlertCircle size={18}/><span>{error==='forbidden'?ticketT(locale,'forbidden'):error==='unauthorized'?ticketT(locale,'unauthorized'):error==='rateLimited'?ticketT(locale,'rateLimited'):ticketT(locale,'error')}</span><button type="button" onClick={()=>void loadTickets()}>{ticketT(locale,'retry')}</button></div>:null}
    {isAdmin ? <section className="pay-ticket-blocked-users" aria-label={ticketT(locale,'blockedUsersTitle')}>
      <div className="pay-ticket-blocked-users-heading"><div><strong>{ticketT(locale,'blockedUsersTitle')}</strong><span>{blockedUsers.length}</span></div><button type="button" className="pay-secondary-action" onClick={()=>void loadBlockedUsers()} disabled={blockedUsersLoading||moderationBusy}><RefreshCw size={15}/>{ticketT(locale,'retry')}</button></div>
      {blockedUsersLoading ? <div className="pay-ticket-loading"><Loader2 className="spin" size={18}/>{ticketT(locale,'loading')}</div> : blockedUsersError ? <div className="pay-ticket-alert" role="alert"><span>{blockedUsersError==='forbidden'?ticketT(locale,'forbidden'):blockedUsersError==='unauthorized'?ticketT(locale,'unauthorized'):blockedUsersError==='rateLimited'?ticketT(locale,'rateLimited'):ticketT(locale,'moderationError')}</span><button type="button" onClick={()=>void loadBlockedUsers()}>{ticketT(locale,'retry')}</button></div> : blockedUsers.length===0 ? <div className="pay-ticket-blocked-users-empty">{ticketT(locale,'noBlockedUsers')}</div> : <div className="pay-ticket-blocked-users-list">{blockedUsers.map(item=><article key={item.userId} className="pay-ticket-blocked-user-row"><div><code dir="ltr">{item.userId}</code><span>{item.reason}</span><time>{dateValue(item.blockedAt,locale)}</time></div><button type="button" className="pay-secondary-action" onClick={()=>void handleUnblockFromList(item.userId)} disabled={moderationBusy||busy!==null}><ShieldOff size={15}/>{ticketT(locale,'unblockUser')}</button></article>)}</div>}
    </section> : null}
    <div className="pay-ticket-layout">
      <div className="pay-ticket-list-pane">
        {loading ? <div className="pay-ticket-loading"><Loader2 className="spin" size={20}/>{ticketT(locale,'loading')}</div> : tickets.length ? <div className="pay-ticket-list">{tickets.map(item=><button type="button" key={item.id} className={`pay-ticket-list-item ${item.id===selectedId?'is-selected':''}`} onClick={()=>setSelectedId(item.id)}><div><strong>{item.subject}</strong><span>{dateValue(item.updatedAt,locale)}</span></div><div><span className={`pay-ticket-status status-${item.status}`}>{translateStatus(locale,item.status)}</span>{isAdmin?<span className={`pay-ticket-priority priority-${item.priority}`}>{priorityLabel(locale,item.priority)}</span>:null}</div></button>)}</div> : <div className="pay-ticket-empty"><MessageSquare size={22}/><strong>{ticketT(locale,'noTickets')}</strong></div>}
        {!isAdmin ? <form className="pay-ticket-new" onSubmit={handleCreate}><div className="pay-ticket-form-title"><Plus size={17}/>{ticketT(locale,'newTicket')}</div><label>{ticketT(locale,'subject')}<input value={subject} onChange={e=>setSubject(e.target.value)} maxLength={160} required placeholder={ticketT(locale,'subjectHint')}/></label><label>{ticketT(locale,'priority')}<select value={priority} onChange={e=>setPriority(e.target.value as PayTicketPriority)}>{PRIORITIES.map(value=><option key={value} value={value}>{priorityLabel(locale,value)}</option>)}</select><small>{ticketT(locale,'priorityHelp')}</small></label><label>{ticketT(locale,'message')}<textarea value={message} onChange={e=>setMessage(e.target.value)} maxLength={10000} rows={5} required placeholder={ticketT(locale,'messageHint')}/></label><button type="submit" className="pay-primary-action" disabled={!merchantId||busy!==null||!subject.trim()||!message.trim()}>{busy==='create'?<Loader2 className="spin" size={17}/>:<Send size={17}/>} {ticketT(locale,'send')}</button></form>:null}
      </div>
      <div className="pay-ticket-detail-pane">
        {!selected ? <div className="pay-ticket-detail-empty"><MessageSquare size={25}/><p>{ticketT(locale,'selectTicket')}</p></div> : detailLoading && !detail ? <div className="pay-ticket-loading"><Loader2 className="spin" size={20}/>{ticketT(locale,'loading')}</div> : <div className="pay-ticket-thread"><div className="pay-ticket-thread-header"><div><span className="pay-panel-kicker">{ticketT(locale,'details')}</span><h3>{selected.subject}</h3><p>{ticketT(locale,'status')}: {translateStatus(locale,selected.status)} · {priorityLabel(locale,selected.priority)}</p><code className="pay-ticket-id" dir="ltr">{ticketT(locale,'ticketId')}: {selected.id}</code></div>{isAdmin?<div className="pay-ticket-admin-controls">
            <select value={selected.status} disabled={busy==='status'||busy==='delete'||moderationBusy||!detail||detail.ticket.id!==selectedId||detailError!==null} onChange={e=>void handleStatus(e.target.value as PayTicketStatus)} aria-label={ticketT(locale,'updateStatus')}>{STATUSES.map(value=><option key={value} value={value}>{translateStatus(locale,value)}</option>)}</select>
            <div className="pay-ticket-moderation">
              <code className="pay-ticket-user-id" dir="ltr">{selected.createdByUserId}</code>
              {moderationLoading ? <span className="pay-ticket-moderation-status">{ticketT(locale,'loading')}</span> : moderationError ? <div className="pay-ticket-alert" role="alert"><span>{moderationError==='forbidden'?ticketT(locale,'forbidden'):moderationError==='unauthorized'?ticketT(locale,'unauthorized'):moderationError==='rateLimited'?ticketT(locale,'rateLimited'):ticketT(locale,'moderationError')}</span><button type="button" onClick={()=>void loadModeration(selected.id)}>{ticketT(locale,'retry')}</button></div> : moderation?.isBlocked ? <><span className="pay-ticket-blocked-state">{ticketT(locale,'blockedState')}{moderation.reason? ` — ${moderation.reason}`:''}</span><button type="button" className="pay-secondary-action" onClick={()=>void handleUnblockUser()} disabled={moderationBusy||busy!==null}><ShieldOff size={15}/>{moderationBusy?ticketT(locale,'loading'):ticketT(locale,'unblockUser')}</button></> : <><label className="pay-ticket-block-reason">{ticketT(locale,'blockReason')}<input value={blockReason} onChange={e=>setBlockReason(e.target.value)} minLength={3} maxLength={500} placeholder={ticketT(locale,'blockedReasonHint')}/></label><button type="button" className="pay-secondary-action" onClick={()=>void handleBlockUser()} disabled={moderationBusy||busy!==null||blockReason.trim().length<3||blockReason.trim().length>500}><Ban size={15}/>{moderationBusy?ticketT(locale,'loading'):ticketT(locale,'blockUser')}</button></>}
              <button type="button" className="pay-danger-action" onClick={()=>void handleDeleteTicket()} disabled={busy!==null||moderationBusy}><Trash2 size={15}/>{busy==='delete'?ticketT(locale,'loading'):ticketT(locale,'deleteTicket')}</button>
            </div>
          </div>:null}</div>
          {detailError?<div className="pay-ticket-alert" role="alert"><AlertCircle size={18}/><span>{detailError==='forbidden'?ticketT(locale,'forbidden'):detailError==='unauthorized'?ticketT(locale,'unauthorized'):detailError==='rateLimited'?ticketT(locale,'rateLimited'):ticketT(locale,'sendError')}</span><button type="button" onClick={()=>void loadDetail(selected.id)}>{ticketT(locale,'retry')}</button></div>:null}
          <div className="pay-ticket-messages" role="region" aria-label={ticketT(locale,'conversation')}>{detail?.messages.map(item=><article key={item.id} className={`pay-ticket-message ${item.authorUserId===sessionUser.id?'is-self':''}`}><div className="pay-ticket-message-meta"><span>{item.authorUserId===sessionUser.id?ticketT(locale,isAdmin?'admin':'merchant'):isAdmin?ticketT(locale,'merchant'):ticketT(locale,'admin')}</span><time>{dateValue(item.createdAt,locale)}</time></div><p>{item.body}</p></article>)}</div>
          {detail && detail.ticket.id===selectedId && !detailError ? selected.status !== 'closed' ? <form className="pay-ticket-reply" onSubmit={handleReply}><label>{ticketT(locale,'message')}<textarea value={reply} onChange={e=>setReply(e.target.value)} maxLength={10000} rows={4} required placeholder={ticketT(locale,'messageHint')}/></label><button type="submit" className="pay-primary-action" disabled={busy!==null||!reply.trim()}>{busy==='reply'?<Loader2 className="spin" size={17}/>:<Send size={17}/>} {ticketT(locale,'reply')}</button></form> : <div className="pay-ticket-closed"><CircleCheck size={18}/>{ticketT(locale,'closed')}</div> : null}
        </div>}
      </div>
    </div>
    {isAdmin?<div className="pay-ticket-admin-note"><ShieldCheck size={16}/><span>{ticketT(locale,'adminOnly')}</span></div>:null}
  </section>;
}
