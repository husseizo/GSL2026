-- Phase 5 Production Security: AuditLog rows become genuinely immutable at
-- the database level, not just "immutable by convention" (every prior
-- phase's audit/history tables — JobStatusHistory, EstimateRevision,
-- ApprovalHistory — relied on no code path calling UPDATE/DELETE; this is
-- the first one enforced by Postgres itself). Any UPDATE or DELETE against
-- AuditLog is rejected with an exception, verified directly in
-- security-production.integration-spec.ts by attempting one against a real
-- row and confirming Postgres rejects it. See
-- docs/architecture/security-production.md.

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows are immutable and cannot be updated or deleted (attempted % on id=%)', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
