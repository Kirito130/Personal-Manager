-- Signup failed: identity.handle_new_user inserts personal_spaces whose
-- id default calls public.uuid_generate_v7(), which used unqualified
-- gen_random_bytes. On local Supabase that lives in extensions, outside
-- the function's search_path (identity, public).

CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
  unix_ts_ms BYTEA;
  uuid_bytes BYTEA;
BEGIN
  unix_ts_ms := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3);
  uuid_bytes := unix_ts_ms || extensions.gen_random_bytes(10);
  uuid_bytes := set_byte(uuid_bytes, 6, (get_byte(uuid_bytes, 6) & 15) | 112); -- version 7
  uuid_bytes := set_byte(uuid_bytes, 8, (get_byte(uuid_bytes, 8) & 63) | 128); -- variant
  RETURN encode(uuid_bytes, 'hex')::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION identity.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = identity, public, extensions
AS $$
BEGIN
  INSERT INTO identity.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    lower(NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  INSERT INTO identity.personal_spaces (owner_user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;
