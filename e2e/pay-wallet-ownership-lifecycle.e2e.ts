  const applicationUserId = betterAuthUserId;
  const runId = crypto.randomUUID().replaceAll('-', '');
  const email = `pay-wallet-e2e-${runId}@solmint.invalid`;
  const username = `pay_wallet_e2e_${runId.slice(0, 20)}`;
  const password = `E2E-${randomBytes(24).toString('base64url')}`;
  const passwordHash = await hashPassword(password);
  const merchantId = crypto.randomUUID();
  const wallet = createWalletSigner();

  try {
    await db.query(
      'insert into better_auth."user" (id, name, email, email_verified, username, created_at, updated_at) values ($1,$2,$3,true,$4,now(),now())',
      [betterAuthUserId, 'SolMint Pay Wallet E2E', email, username],
    );
    await db.query(
      'insert into better_auth.account (id, user_id, account_id, provider_id, issuer, password, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,now(),now())',
      [betterAuthUserId, betterAuthUserId, betterAuthUserId, 'credential', 'local:credential', passwordHash],
    );