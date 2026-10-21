-- Payment providers allocate their immutable reference after a local attempt is claimed.
-- Permit exactly one transition from an empty reference to a non-empty reference;
-- all subsequent reference changes remain blocked as evidence tampering.
CREATE OR REPLACE FUNCTION "guard_coffee_payment_evidence"() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Payment evidence cannot be deleted'; END IF;
  IF (to_jsonb(OLD) - ARRAY['status','providerPaymentId','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','updatedAt'])
     IS DISTINCT FROM
     (to_jsonb(NEW) - ARRAY['status','providerPaymentId','failureMessage','processedAt','refundIdempotencyKey','refundedAmount','refundReason','refundedAt','updatedAt']) THEN
    RAISE EXCEPTION 'Payment identity and amount evidence is immutable';
  END IF;
  IF OLD."providerPaymentId" IS DISTINCT FROM NEW."providerPaymentId"
     AND NOT (COALESCE(OLD."providerPaymentId", '') = '' AND COALESCE(NEW."providerPaymentId", '') <> '') THEN
    RAISE EXCEPTION 'Payment provider reference is immutable once assigned';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
