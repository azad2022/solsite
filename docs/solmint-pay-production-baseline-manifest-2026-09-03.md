# SolMint Pay — Production Baseline Evidence Manifest

**Capture date:** 2026-09-03
**Environment:** Supabase Production
**Project ref:** `nvopkbiedorfshwbmyhn`
**Region:** `eu-central-1`
**Purpose:** Immutable audit record of the production schema snapshot, replay/equivalence evidence, and migration ledger observed during SolMint Pay baseline recovery.

## Production schema snapshot

- Capture workflow: `SolMint Pay — Production Schema Capture`
- Verified workflow run: `33781797071`
- Capture job: `Read-only production schema capture`
- Checked-out branch: `audit/solmint-pay-next`
- Checked-out HEAD at capture: `ca7cbe6945d169e2f42a6d014190816149ef5eee`
- Supabase CLI: `2.116.0`
- Schema SHA-256: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- GitHub artifact ID: `9907361271`
- Artifact verified to contain exactly two files: `production-schema.sql` and `production-schema.sha256`
- Captured SQL size: `65,610` bytes / `1,991` lines
- Data-statement scan: no `INSERT INTO` or `COPY ... FROM stdin` blocks detected
- Connection-string scan: no PostgreSQL URI or `SUPABASE_DB_URL=` pattern detected
- Pay-object scan: no `pay_`, `solmint_pay`, `payment_intent`, or `payment` identifiers were found in the captured schema text

## Snapshot replay / schema equivalence

- Replay workflow: `SolMint Pay — Production Schema Replay Equivalence`
- Primary replay execution used: GitHub Actions run `33792606677`, job `100772584920`
- Replay checkout before comparator-only fixes: branch `audit/solmint-pay-next`, commit `6e15318b9edffab69c9b9c3dc8f5de7545235f27`
- Snapshot source artifact: `9907361271`
- Snapshot SHA-256 reverified inside CI: `553d0f9a34f52ef344471c45398c41780438c0dbeec5d6cc63c912d6a8b223c5`
- Replay target: disposable `postgres:17-alpine` container; Production was never used as the replay target
- Replay DDL execution: **PASS** with `psql -v ON_ERROR_STOP=1`
- Replayed schema dump: **PASS** and contained no `INSERT INTO` / `COPY ... FROM stdin` data statements
- Replayed relation/index/function inventories were successfully generated
- Independent rerun of the final canonical comparator against the exact replay artifact: **PASS**
- Final canonical SHA-256, snapshot: `f52a2e9c1d49a42cad70aa9f59fa36aafc6e5b645898ef901153f39dc5f114c1`
- Final canonical SHA-256, replay: `f52a2e9c1d49a42cad70aa9f59fa36aafc6e5b645898ef901153f39dc5f114c1`
- Canonicalized lengths: `43,550` bytes on both sides

### Equivalence scope

The comparator intentionally excludes deployment-environment metadata that is not a core PostgreSQL object-equivalence signal: ownership, ACLs/default privileges, unsupported Supabase platform extension declarations unavailable in the disposable image, realtime publication metadata, standard schema comments, and `CREATE OR REPLACE`/role-order serialization differences. The replay therefore proves **core PostgreSQL DDL replayability and canonical schema equivalence**, not byte-for-byte identity with the Supabase-hosted control plane.

## Production migration ledger snapshot

The live `supabase_migrations.schema_migrations` ledger contained 55 applied versions at capture time. The newest applied version was `20260826190853 / category_default_media_gallery_rpc`.

```text
20260804212636 / harden_public_rls_and_function_permissions
20260804212725 / revoke_public_table_mutations
20260804215020 / harden_public_rls_and_article_timestamps
20260804215706 / enforce_admin_user_uniqueness_and_settings_persistence
20260804220556 / persist_active_media_config_defaults
20260805083846 / enable_autopublish_scheduler_extensions
20260805083916 / add_autopublish_scheduler_control
20260805083950 / add_autopublish_lock
20260805083957 / expose_autopublish_lock_rpc
20260805084011 / fix_autopublish_token_verifier
20260805094225 / add_chatbot_rate_limit
20260805095150 / secure_cms_settings_from_anon
20260805095458 / move_deepseek_secret_out_of_cms_settings
20260805102324 / lock_down_media_client_writes
20260806185329 / add_meme_market_ticker
20260807120537 / harden_article_seo_fields
20260807120649 / improve_article_keyword_autofill
20260807120705 / fix_article_keyword_trigger_variable
20260807120724 / fix_article_keyword_tokenization
20260807120752 / refine_article_keyword_quality
20260807123833 / create_article_categories_and_link_articles
20260807124427 / enforce_article_category_taxonomy_reference
20260807145946 / create_media_system_logs
20260807191610 / harden_blog_comments
20260807192415 / production_comments_replies_votes
20260807192425 / lock_comment_vote_rpc_to_server
20260807193720 / comments_security_hardening
20260810160711 / add_server_auth_sessions
20260810172758 / add_atomic_auth_login_rate_limits
20260812121312 / harden_comment_votes_and_rate_limits
20260812121352 / add_comment_rate_limiter
20260812121444 / comments_final_production_hardening_20260812_v2
20260812122015 / registration_rate_limit_production
20260812170215 / sync_article_cover_asset_reference
20260812170426 / canonicalize_article_media_asset_ids
20260812170536 / canonicalize_article_media_asset_ids_v2
20260812172444 / add_category_default_media_asset
20260812172656 / category_default_media_url
20260812175218 / article_category_default_media_fallback
20260813120037 / fix_comment_rate_limit_operation_key
20260813120812 / harden_security_definer_and_search_paths
20260813120823 / revoke_public_trigger_function_execute
20260813121749 / harden_public_function_search_paths
20260813171731 / add_solana_projects_category
20260813171756 / seed_solana_projects_pillar_articles
20260817164322 / add_article_localization_fields
20260817175002 / harden_article_translation_integrity
20260817175842 / harden_article_localization_contract
20260818125620 / drop_duplicate_article_translation_index
20260818125650 / remove_redundant_article_translation_group_index
20260826170111 / enforce_category_default_cover_on_articles
20260826170422 / category_default_media_atomic_assignment
20260826170554 / fix_category_default_media_rpc_ambiguity
20260826173332 / 20260826_allow_public_active_category_reads
20260826190831 / category_default_media_gallery
20260826190853 / category_default_media_gallery_rpc
```

## Recovery decision

This manifest is evidence, not a production migration authorization. The production migration ledger and schema remain authoritative for what is deployed. The repository's Pay migrations remain repository-only until the migration baseline is reconciled with the 55-production-migration ledger and all Pay-specific replay/security/E2E gates pass.

No remote migration metadata was changed by the capture or replay process, and no Pay DDL was applied to Production as part of this work.
