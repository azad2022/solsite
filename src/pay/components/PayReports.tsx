import React,{useCallback,useEffect,useState} from 'react';
import {BarChart3,Loader2,RefreshCw,XCircle} from 'lucide-react';
import {PayHttpError} from '../http';
import type {PayLocale} from '../types';
import {payReportService,type PayReport} from '../services/reportService';
import {reportT} from './pay-reports-i18n';
import './pay-reports.css';

interface Props{locale:PayLocale;merchantId:string|null}
type RangeKey='today'|'sevenDays'|'thirtyDays'|'ninetyDays'|'custom';

function rangeDates(range:RangeKey,fromDate:string,toDate:string){
  const now=new Date();
  if(range==='custom'){
    if(!fromDate||!toDate) return null;
    const from=new Date(fromDate+'T00:00:00.000Z');
    const to=new Date(toDate+'T00:00:00.000Z'); to.setUTCDate(to.getUTCDate()+1);
    return {from:from.toISOString(),to:to.toISOString()};
  }
  const end=new Date(now);
  const start=new Date(now);
  start.setUTCHours(0,0,0,0);
  if(range==='sevenDays') start.setUTCDate(start.getUTCDate()-6);
  if(range==='thirtyDays') start.setUTCDate(start.getUTCDate()-29);
  if(range==='ninetyDays') start.setUTCDate(start.getUTCDate()-89);
  return {from:start.toISOString(),to:end.toISOString()};
}
function errorKind(error:unknown):'unauthorized'|'forbidden'|'error'{
  if(error instanceof PayHttpError&&error.status===401)return'unuthorized';
  if(error instanceof PayHttpError&&error.status===403)return'forbidden';
  return'error';
}
function formatAtomic(value:string,locale:PayLocale){
  return Number(value).toLocaleString(locale==='fa-IR'?'fa-IR':locale);
}
function formatDate(value:string,locale:PayLocale){
  const d=new Date(value); if(Number.isNaN(d.getTime()))return'—';
  return new Intl.DateTimeFormat(locale==='ru'?'ru-RU':locale,{dateStyle:'medium',timeStyle:'short'}).format(d);
}

export default function PayReports({locale,merchantId}:Props):React.ReactElement{
  const [range,setRange]=useState<RangeKey>('today');
  const [fromDate,setFromDate]=useState('');
  const [toDate,setToDate]=useState('');
  const [report,setReport]=useState<PayReport|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<'unauthorized'|'forbidden'|'error'|null>(null);
  const [stale,setStale]=useState(false);

  const load=useCallback(async()=>{
    if(!merchantId){setLoading(false);setReport(null);return;}
    const dates=rangeDates(range,fromDate,toDate);
    if(!dates){setLoading(false);setReport(null);return;}
    setLoading(true);setError(null);
    try{setReport(await payReportService.get(merchantId,dates.from,dates.to));setStale(false);}
    catch(cause){setError(errorKind(cause));setStale(report!==null);}
    finally{setLoading(false);}
  },[merchantId,range,fromDate,toDate,report]);
  useEffect(()=>{void load();},[load]);

  return <section className="pay-reports" aria-label={reportT(locale,'title')}>
    <div className="pay-reports-heading"><div><span className="pay-panel-kicker">{reportT(locale,'title')}</span><h2>{reportT(locale,'title')}</h2><p>{reportT(locale,'subtitle')}</p></div><button type="button" className="pay-secondary-action" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>{reportT(locale,'refresh')}</button></div>
    <div className="pay-reports-range" role="group" aria-label={reportT(locale,'range')}>
      {(['today','sevenDays','thirtyDays','ninetyDays'] as const).map(key=><button key={key} type="button" className={range===key?'is-active':''} onClick={()=>setRange(key)}>{reportT(locale,key)}</button>)}
      <button type="button" className={range==='custom'?'is-active':''} onClick={()=>setRange('custom')}>{reportT(locale,'custom')}</button>
    </div>
    {range==='custom'?<div className="pay-reports-custom"><label>{reportT(locale,'from')}<input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/></label><label>{reportT(locale,'to')}<input type="date" value={toDate} onChange={e=>setToDate(e.target.value)}/></label></div>:null}
    {stale&&!loading?<div className="pay-reports-stale" role="status">{reportT(locale,'stale')}</div>:null}
    {loading?<div className="pay-reports-state"><Loader2 className="animate-spin" size={22}/>{reportT(locale,'loading')}</div>:null}
    {error&&!loading?<div className="pay-reports-state is-error" role="alert"><XCircle size={21}/><span>{error==='unauthorized'?reportT(locale,'unauthorized'):error==='forbidden'?reportT(locale,'forbidden'):reportT(locale,'loadFailed')}</span><button type="button" className="pay-secondary-action" onClick={()=>void load()}>{reportT(locale,'retry')}</button></div>:null}
    {!loading&&!error&&report?<>
      <div className="pay-reports-meta">{formatDate(report.periodStart,locale)} — {formatDate(report.periodEnd,locale)} · {reportT(locale,'backendSource')}</div>
      <div className="pay-reports-grid">
        <Metric title={reportT(locale,'paymentIntents')} value={report.paymentIntentCount.toLocaleString(locale==='fa-IR'?'fa-IR':locale)}/>
        <Metric title={reportT(locale,'completed')} value={report.completedPaymentCount.toLocaleString(locale==='fa-IR'?'fa-IR':locale)}/>
        <Metric title={reportT(locale,'customers')} value={report.customerCount.toLocaleString(locale==='fa-IR'?'fa-IR':locale)}/>
        <Metric title={reportT(locale,'completedRate')} value={(report.completedRateBps/100).toFixed(2)+'%'}/>
        <Metric title={reportT(locale,'completedAmount')} value={formatAtomic(report.completedPaymentAmountAtomic,locale)}/>
        <Metric title={reportT(locale,'netRevenue')} value={formatAtomic(report.netGatewayRevenueAtomic,locale)}/>
      </div>
      <div className="pay-reports-panels">
        <section className="pay-reports-panel"><h3><BarChart3 size={17}/>{reportT(locale,'statusSummary')}</h3><div className="pay-report-statuses">{Object.entries(report.statusCounts).map(([status,count])=><div key={status}><span>{status}</span><strong>{count.toLocaleString(locale==='fa-IR'?'fa-IR':locale)}</strong></div>)}</div></section>
        <section className="pay-reports-panel"><h3>{reportT(locale,'daily')}</h3><div className="pay-reports-table-wrap"><table><thead><tr><th>{reportT(locale,'date')}</th><th>{reportT(locale,'paymentIntents')}</th><th>{reportT(locale,'completed')}</th><th>{reportT(locale,'completedAmount')}</th></tr></thead><tbody>{report.daily.map(row=><tr key={row.date}><td>{row.date}</td><td>{row.paymentIntentCount}</td><td>{row.completedPaymentCount}</td><td>{formatAtomic(row.completedPaymentAmountAtomic,locale)}</td></tr>)}</tbody></table></div></section>
      </div>
      <p className="pay-reports-note">{reportT(locale,'truthNote')}</p>
    </>:null}
    {!loading&&!error&&!report&&range==='custom'?<div className="pay-reports-state">{reportT(locale,'chooseDates')}</div>:null}
  </section>;
}
function Metric({title,value}:{title:string;value:string}){return <article className="pay-report-metric"><span>{title}</span><strong>{value}</strong></article>}
