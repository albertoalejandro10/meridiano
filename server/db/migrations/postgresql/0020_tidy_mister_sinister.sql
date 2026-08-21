-- Data-only migration: normalize fee-row descriptions written before the
-- internal/external fee split.
--
-- 'Transfer fee' and 'Fee' are labels no handler produces any more — every fee
-- row is now written with one of the four canonical strings by
-- transfers/index.post.ts, transactions/index.post.ts or accounts/[id]/sell.post.ts.
-- The rows that still carry the old labels predate that change and make the
-- same concept look like several in any grouping over descriptions.
--
-- The replacement is derived from the fee's own kind and its parent row, so
-- each row gets exactly the label the current code would have written for it.
-- Only the two legacy literals are touched, so this is idempotent and a no-op
-- on a database that never held them.
--
-- Note: a fee on an asset sale would be relabelled as a transfer fee here (a
-- sale is stored as a transfer), but no legacy row is a sale — the sale feature
-- shipped with its own labels already in place.
UPDATE "transactions" AS f
SET "description" = CASE
  WHEN f."fee_kind" = 'EXTERNAL' AND p."transfer_id" IS NOT NULL THEN 'External transfer fee'
  WHEN f."fee_kind" = 'EXTERNAL' THEN 'External fee'
  WHEN p."transfer_id" IS NOT NULL THEN 'Internal transfer fee'
  ELSE 'Internal fee'
END
FROM "transactions" AS p
WHERE f."fee_of_id" = p."id"
  AND f."description" IN ('Transfer fee', 'Fee');
