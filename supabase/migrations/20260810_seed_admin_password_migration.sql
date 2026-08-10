-- One-time migration of the production admin credential into the server-auth password store.
-- The value is a SHA-256 compatibility hash; the first successful login upgrades it to PBKDF2.
update public.users
set password_hash = '0f0fac4ce8b895acc2fe29b7669eeb20e8358316a8a1369c55541d6b4586a5be',
    role = 'superadmin',
    is_active = true
where username = 'admin';
