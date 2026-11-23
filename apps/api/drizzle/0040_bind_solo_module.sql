-- Attach a pre-existing placeholder without replacing its catalog identity,
-- presentation, publication status or historical records.
UPDATE games AS placeholder
SET module_id = 'solo', version = version + 1
WHERE placeholder.slug = 'solo'
  AND placeholder.deleted_at IS NULL
  AND placeholder.module_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND NOT EXISTS (SELECT 1 FROM games AS registered WHERE registered.module_id = 'solo')
  AND NOT EXISTS (
    SELECT 1 FROM game_matches AS historical
    WHERE historical.game_id = placeholder.id AND historical.game_slug <> 'solo'
  );
