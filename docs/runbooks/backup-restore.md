# Backup and restore (Phase 6)

## Local / self-host baseline

1. **Postgres:** Use Supabase managed backups in cloud, or `pg_dump` against the LifeOS database volume.
2. **Object storage:** Backup Supabase Storage buckets (attachments, invoice PDFs) with the same checkpoint label as the DB dump.
3. **Secrets:** Store JWT secret, service role, and DB credentials in a secret manager — never in git.
4. **Restore drill:** restore DB → restore files → verify migration version → replay unpublished outbox if needed → smoke login/task/finance.

## RPO / RTO targets (from project.md)

- RPO ≤ 24h
- RTO ≤ 8h

## Verification checklist

- [ ] Personal finance posted journals still balance
- [ ] Invoice numbers and snapshots intact
- [ ] Correlation links resolve to existing personal journals
- [ ] Auth users can sign in after restore
