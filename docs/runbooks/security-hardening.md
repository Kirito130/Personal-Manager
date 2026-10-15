# Security hardening checklist

- [ ] RLS enabled on all domain schemas (see M13)
- [ ] NestJS never trusts client-supplied owner/org IDs without policy checks
- [ ] Service role key only on API/worker; anon key on web
- [ ] No authorization from `user_metadata`
- [ ] Idempotency on invoice issue, payments, correlation links
- [ ] Journal bodies excluded from shared search indexes
- [ ] Rate limits planned for auth-sensitive routes before public deploy
- [ ] Dependency audit (`pnpm audit`) before production
