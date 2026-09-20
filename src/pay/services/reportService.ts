import { defaultPayHttpClient, type PayHttpClient } from '../http';

export interface PayReportDaily {
  date: string;
  paymentIntentCount: number;
  completedPaymentCount: number;
  completedPaymentAmountAtomic: string;
}
export interface PayReport {
  periodStart: string;
  periodEnd: string;
  timezone: string;
  paymentIntentCount: number;
  completedPaymentCount: number;
  pendingPaymentCount: number;
  exceptionPaymentCount: number;
  customerCount: number;
  completedPaymentAmountAtomic: string;
  completedGatewayFeeSnapshotAtomic: string;
  grossGatewayFeeAtomic: string;
  referralCommissionAtomic: string;
  netGatewayRevenueAtomic: string;
  completedRateBps: number;
  statusCounts: Record<string, number>;
  daily: PayReportDaily[];
}

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ATOMIC=/^\d+$/;

function record(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Invalid Pay report payload.');
  return v as Record<string, unknown>;
}
function str(v: unknown, field: string): string {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError('Invalid Pay report field: ' + field);
  return v;
}
function atomic(v: unknown, field: string): string {
  const value=str(v,field); if(!ATOMIC.test(value)) throw new TypeError('Invalid Pay report atomic field: ' + field); return value;
}
function int(v: unknown, field: string): number {
  const n=typeof v==='number'?v:Number(v); if(!Number.isSafeInteger(n)||n<0) throw new TypeError('Invalid Pay report integer field: ' + field); return n;
}
function parse(payload: unknown): PayReport {
  const row=record(payload);
  const statusCountsRaw=record(row.statusCounts);
  const dailyRaw=Array.isArray(row.daily)?row.daily:[];
  return {
    periodStart:str(row.periodStart,'periodStart'),
    periodEnd:str(row.periodEnd,'periodEnd'),
    timezone:str(row.timezone,'timezone'),
    paymentIntentCount:int(row.paymentIntentCount,'paymentIntentCount'),
    completedPaymentCount:int(row.completedPaymentCount,'completedPaymentCount'),
    pendingPaymentCount:int(row.pendingPaymentCount,'pendingPaymentCount'),
    exceptionPaymentCount:int(row.exceptionPaymentCount,'exceptionPaymentCount'),
    customerCount:int(row.customerCount,'customerCount'),
    completedPaymentAmountAtomic:atomic(row.completedPaymentAmountAtomic,'completedPaymentAmountAtomic'),
    completedGatewayFeeSnapshotAtomic:atomic(row.completedGatewayFeeSnapshotAtomic,'completedGatewayFeeSnapshotAtomic'),
    grossGatewayFeeAtomic:atomic(row.grossGatewayFeeAtomic,'grossGatewayFeeAtomic'),
    referralCommissionAtomic:atomic(row.referralCommissionAtomic,'referralCommissionAtomic'),
    netGatewayRevenueAtomic:atomic(row.netGatewayRevenueAtomic,'netGatewayRevenueAtomic'),
    completedRateBps:int(row.completedRateBps,'completedRateBps'),
    statusCounts:Object.fromEntries(Object.entries(statusCountsRaw).map(([key,value])=>[key,int(value,key)])),
    daily:dailyRaw.map(value=>{
      const d=record(value);
      return {
        date:str(d.date,'daily.date'),
        paymentIntentCount:int(d.paymentIntentCount,'daily.paymentIntentCount'),
        completedPaymentCount:int(d.completedPaymentCount,'daily.completedPaymentCount'),
        completedPaymentAmountAtomic:atomic(d.completedPaymentAmountAtomic,'daily.completedPaymentAmountAtomic'),
      };
    }),
  };
}

export function createPayReportService(client: PayHttpClient=defaultPayHttpClient){
  return {
    async get(merchantId:string, from:string, to:string):Promise<PayReport>{
      if(!UUID.test(merchantId.trim())) throw new TypeError('Merchant ID is invalid.');
      const params=new URLSearchParams({merchantId:merchantId.trim(),from,to});
      const body=await client.request<{success?:boolean;apiVersion?:string;data?:unknown}>('/api/pay/v1/reports?'+params.toString());
      const root=record(body);
      if(root.success!==true||root.apiVersion!=='v1') throw new TypeError('Invalid Pay report envelope.');
      return parse(root.data);
    },
  };
}
export const payReportService=createPayReportService();
