CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  username VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  role ENUM('author','editor') NOT NULL,
  password_hash CHAR(64) CHARACTER SET ascii NOT NULL,
  salt CHAR(32) CHARACTER SET ascii NOT NULL,
  iterations INT UNSIGNED NOT NULL,
  created_at VARCHAR(32) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS manuscripts (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  author_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category VARCHAR(32) NOT NULL,
  title VARCHAR(100) NOT NULL,
  content MEDIUMTEXT NOT NULL,
  status ENUM('draft','review','approved') NOT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at VARCHAR(32) NOT NULL,
  updated_at VARCHAR(32) NOT NULL,
  INDEX manuscripts_author_idx (author_id),
  INDEX manuscripts_status_idx (status),
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  manuscript_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  editor_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  action ENUM('return','approve') NOT NULL,
  reason TEXT,
  manuscript_version INT UNSIGNED NOT NULL,
  created_at VARCHAR(32) NOT NULL,
  INDEX reviews_manuscript_idx (manuscript_id),
  FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  FOREIGN KEY (editor_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at BIGINT NOT NULL,
  INDEX sessions_expiry_idx (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  `key` CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  attempts INT UNSIGNED NOT NULL,
  window_start BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS studio_meta (
  name VARCHAR(64) PRIMARY KEY,
  value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO studio_meta (name,value) VALUES ('application','submission-review-system');
