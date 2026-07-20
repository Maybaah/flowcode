-- flowcode leaderboard schema (Cloudflare D1 / SQLite)
-- v2: every mode has its own daily board.

CREATE TABLE IF NOT EXISTS scores (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  day        INTEGER NOT NULL,          -- UTC date seed, e.g. 20260721
  mode       TEXT    NOT NULL,          -- daily / time / words / endless / sudden / ramp
  player     TEXT    NOT NULL,          -- client-generated id, one row per player per board
  name       TEXT    NOT NULL,
  wpm        INTEGER NOT NULL,
  acc        REAL    NOT NULL,
  score      INTEGER NOT NULL,
  words      INTEGER NOT NULL,
  max_combo  INTEGER NOT NULL,
  flow       INTEGER NOT NULL DEFAULT 0, -- flow setting the run was played at
  created_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scores_board_player ON scores (day, mode, player);
CREATE INDEX IF NOT EXISTS idx_scores_board_score ON scores (day, mode, score DESC);

-- Per-caller submission throttle. The column holds a salted SHA-256 prefix of
-- the address, never the address itself, and the salt rotates daily; rows are
-- pruned a few days after their challenge closes.
CREATE TABLE IF NOT EXISTS rate (
  ip  TEXT    NOT NULL,           -- hashed caller key, not an IP address
  day INTEGER NOT NULL,
  n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, day)
);
