-- Align unrecorded settlements with the end of the event; paid statements stay unchanged.
UPDATE event SET settlement_due_at = end_date_time
WHERE end_date_time IS NOT NULL
  AND status IN ('AWAITING_DEPOSIT', 'PUBLISHED')
  AND (settlement_status IS NULL OR settlement_status <> 'PAID')
  AND NOT EXISTS (SELECT 1 FROM event_payout p WHERE p.event_id = event.id);
