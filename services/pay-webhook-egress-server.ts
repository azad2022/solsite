import express from 'express';
import { handleWebhookEgressRequest } from './pay-webhook-egress';

const app = express();
const port = Number(process.env.PAY_WEBHOOK_EGRESS_PORT || 8788);
const secret = process.env.PAY_WEBHOOK_EGRESS_SECRET?.trim() || '';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid PAY_WEBHOOK_EGRESS_PORT.');
app.disable('x-powered-by');
app.use(express.raw({ type: 'application/json', limit: '256kb' }));
app.post('/internal/pay/webhook-egress', async (req, res) => {
  try {
    const request = new Request('https://egress.internal/internal/pay/webhook-egress', {
      method: 'POST',
      headers: Object.entries(req.headers).reduce((headers, [key, value]) => {
        if (typeof value === 'string') headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(', '));
        return headers;
      }, new Headers()),
      body: Buffer.isBuffer(req.body) ? req.body : undefined,
    });
    const response = await handleWebhookEgressRequest(request, { secret });
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.status(502).json({ ok: false, code: 'EGRESS_FAILED' });
  }
});
app.listen(port, '127.0.0.1', () => console.log(`SolMint Pay webhook egress listening on 127.0.0.1:${port}`));
