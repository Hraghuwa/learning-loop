-- Add join_code to institute_classes table
ALTER TABLE institute_classes 
ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Create function for random 6-character unique join code generation
CREATE OR REPLACE FUNCTION generate_join_code() 
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  done BOOL;
BEGIN
  done := false;
  WHILE NOT done LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 6));
    BEGIN
      UPDATE institute_classes SET join_code = new_code WHERE id = NULL; -- Dummy just to test unique constraint if needed (not really)
      done := true;
    EXCEPTION WHEN unique_violation THEN
      done := false;
    END;
  END LOOP;
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate join code on insert if not provided
CREATE OR REPLACE FUNCTION trigger_generate_join_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.join_code IS NULL THEN
    NEW.join_code := generate_join_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ensure_join_code ON institute_classes;
CREATE TRIGGER ensure_join_code
BEFORE INSERT ON institute_classes
FOR EACH ROW
EXECUTE FUNCTION trigger_generate_join_code();
