import assert from 'node:assert/strict';
import test from 'node:test';
import type { PayLocale } from '../src/pay/types';
import { ticketT, type TicketTranslationKey } from '../src/pay/components/pay-tickets-i18n';

const locales: PayLocale[] = ['fa-IR','en-US','ar','ru'];
const keys: TicketTranslationKey[] = [
  'title','subtitle','newTicket','subject','message','category','catPayments','catWallet',
  'catInvoices','catPaymentLinks','catBulkPay','catApiWebhooks','catMerchantAccount',
  'catReferrals','catSecurity','catOther','paymentIntentId','paymentIntentHint',
  'paymentIntentHelp','paymentIntentNotFound','createError','merchantId','you',
  'otherParticipant','createdAt','lastUpdate','priority','normal','high','urgent',
  'send','reply','tickets','details','ticketId','noTickets','selectTicket','loading',
  'retry','unauthorized','forbidden','error','sent','replied','status','open',
  'pendingCustomer','pendingAdmin','resolved','closed','updateStatus','closeTicket',
  'reopenTicket','adminInbox','adminOnly','merchant','admin','conversation',
  'sendError','statusError','statusUpdated','subjectHint','messageHint','priorityHelp','stale',
];

test('ticket UI translations provide every support workflow key in all four locales', () => {
  for (const locale of locales) {
    for (const key of keys) {
      const value = ticketT(locale, key);
      assert.equal(typeof value, 'string', `${locale}.${key} must be a string`);
      assert.ok(value.trim().length > 0, `${locale}.${key} must not be empty`);
    }
  }
});
