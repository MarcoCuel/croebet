BEGIN;
DO $$
BEGIN
  IF current_database() <> 'croebet_preview_test' OR
     (SELECT environment FROM application_environment WHERE id = 1) IS DISTINCT FROM 'test' THEN
    RAISE EXCEPTION 'A conta de playtest exige o banco exclusivo da prévia';
  END IF;
END $$;

-- The private Codespace owner registers normally and can then use the site's bot controls.
CREATE TABLE IF NOT EXISTS preview_owner (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  user_id uuid NOT NULL
);
CREATE OR REPLACE FUNCTION preview_claim_owner() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO preview_owner (singleton, user_id) VALUES (true, NEW.id)
    ON CONFLICT DO NOTHING;
  IF FOUND THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER preview_first_registration BEFORE INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION preview_claim_owner();
COMMIT;
