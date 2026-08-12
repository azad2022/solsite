import { onRequest as mediaAction } from './[action]';

export const onRequest = (context: any) =>
  mediaAction({ ...context, params: { ...(context.params || {}), action: 'test-connection' } });
