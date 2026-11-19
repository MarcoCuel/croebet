CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 username text NOT NULL CONSTRAINT users_username_unique UNIQUE CHECK (username ~ '^[a-z0-9._]{3,24}$'),
 display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
 password_hash text NOT NULL,
 role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sessions (
 token_hash text PRIMARY KEY CHECK (length(token_hash) = 64),
 user_id uuid NOT NULL CONSTRAINT sessions_user_id_users_id_fk REFERENCES users(id),
 expires_at timestamptz NOT NULL,
 idle_expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE auth_rate_limits (key text PRIMARY KEY, window_start timestamptz NOT NULL, attempts integer NOT NULL CHECK (attempts > 0));
