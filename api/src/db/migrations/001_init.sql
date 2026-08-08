-- ============================================================
-- 001_init.sql — 知舟 基础表（由 Novel-KV _init.js 平移为原生 PostgreSQL）
-- 约定：时间戳一律 BIGINT（epoch 毫秒）；BLOB → BYTEA；JSON 存 TEXT。
-- 迁移器在事务内执行本文件，无需 BEGIN/COMMIT。
-- ============================================================

-- 用户 / 会话 / 头像 / 登录限流 ---------------------------------
CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  username            TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL DEFAULT '',
  bio                 TEXT NOT NULL DEFAULT '',
  role                TEXT NOT NULL DEFAULT 'reader',
  password_hash       TEXT NOT NULL,
  password_salt       TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 120000,
  status              TEXT NOT NULL DEFAULT 'active',
  reader_settings     TEXT NOT NULL DEFAULT '{}',
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL,
  last_login_at       BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created ON users(created_at);

CREATE TABLE user_sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  BIGINT NOT NULL,
  created_at  BIGINT NOT NULL,
  device_name TEXT NOT NULL DEFAULT '',
  user_agent  TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE user_avatars (
  user_id      TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data         BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  updated_at   BIGINT NOT NULL
);

CREATE TABLE login_failures (
  key_hash   TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_login_failures_key_created ON login_failures(key_hash, created_at);

CREATE TABLE invites (
  code        TEXT PRIMARY KEY,
  created_at  BIGINT NOT NULL,
  used_at     BIGINT NOT NULL DEFAULT 0,
  used_by     TEXT NOT NULL DEFAULT '',
  disabled_at BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_invites_created ON invites(created_at);

CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at BIGINT NOT NULL
);

-- 小说 / 章节 ---------------------------------------------------
CREATE TABLE novels (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  author              TEXT NOT NULL DEFAULT '',
  description         TEXT NOT NULL DEFAULT '',
  cover_url           TEXT NOT NULL DEFAULT '',
  categories          TEXT NOT NULL DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'ongoing',
  source_url          TEXT NOT NULL DEFAULT '',
  chapter_count       INTEGER NOT NULL DEFAULT 0,
  remote_chapter_count INTEGER NOT NULL DEFAULT 0,
  update_checked_at   BIGINT NOT NULL DEFAULT 0,
  created_at          BIGINT NOT NULL,
  updated_at          BIGINT NOT NULL
);
CREATE INDEX idx_novels_title ON novels(title);
CREATE INDEX idx_novels_updated ON novels(updated_at);
CREATE INDEX idx_novels_source_url ON novels(source_url);
CREATE INDEX idx_novels_status ON novels(status);

CREATE TABLE chapters (
  id         TEXT PRIMARY KEY,
  novel_id   TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  word_count INTEGER NOT NULL DEFAULT 0,
  source_url TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_chapters_novel ON chapters(novel_id);
CREATE INDEX idx_chapters_order ON chapters(novel_id, sort_order);
CREATE INDEX idx_chapters_src_url ON chapters(source_url);
CREATE INDEX idx_chapters_created ON chapters(created_at);

-- 爬虫配置 / 书源 / 任务 / 子项 / 日志 --------------------------
CREATE TABLE scrape_configs (
  novel_id   TEXT PRIMARY KEY REFERENCES novels(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL DEFAULT '',
  selectors  TEXT NOT NULL DEFAULT '{}',
  encoding   TEXT NOT NULL DEFAULT 'utf-8',
  updated_at BIGINT NOT NULL
);

CREATE TABLE scrape_sources (
  host           TEXT PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT '',
  source_url     TEXT NOT NULL DEFAULT '',
  selectors      TEXT NOT NULL DEFAULT '{}',
  meta_selectors TEXT NOT NULL DEFAULT '{}',
  source_json    TEXT NOT NULL DEFAULT '{}',
  encoding       TEXT NOT NULL DEFAULT 'utf-8',
  encoding_hint  INTEGER NOT NULL DEFAULT 0,
  support        TEXT NOT NULL DEFAULT 'partial',
  confidence     INTEGER NOT NULL DEFAULT 0,
  warnings       TEXT NOT NULL DEFAULT '[]',
  enabled        INTEGER NOT NULL DEFAULT 1,
  is_preset      INTEGER NOT NULL DEFAULT 0,
  last_tested_at BIGINT NOT NULL DEFAULT 0,
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);
CREATE INDEX idx_scrape_sources_enabled ON scrape_sources(enabled);

CREATE TABLE scrape_jobs (
  id                 TEXT PRIMARY KEY,
  novel_id           TEXT REFERENCES novels(id) ON DELETE SET NULL,
  status             TEXT NOT NULL DEFAULT 'starting',
  step               TEXT NOT NULL DEFAULT '',
  current            INTEGER NOT NULL DEFAULT 0,
  total              INTEGER NOT NULL DEFAULT 0,
  chapter_count      INTEGER NOT NULL DEFAULT 0,
  progress           REAL NOT NULL DEFAULT 0.0,
  error              TEXT,
  debug              TEXT NOT NULL DEFAULT '',
  started_at         BIGINT NOT NULL,
  updated_at         BIGINT NOT NULL,
  local_mode         INTEGER NOT NULL DEFAULT 0,
  update_mode        INTEGER NOT NULL DEFAULT 0,
  retry_source_job_id TEXT NOT NULL DEFAULT '',
  retry_links        TEXT NOT NULL DEFAULT '[]'
);
CREATE INDEX idx_jobs_status ON scrape_jobs(status);
CREATE INDEX idx_jobs_started ON scrape_jobs(started_at);
CREATE INDEX idx_jobs_updated ON scrape_jobs(updated_at);

CREATE TABLE scrape_job_items (
  id            TEXT PRIMARY KEY,
  job_id        TEXT NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  novel_id      TEXT NOT NULL DEFAULT '',
  chapter_url   TEXT NOT NULL DEFAULT '',
  chapter_title TEXT NOT NULL DEFAULT '',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending',
  word_count    INTEGER NOT NULL DEFAULT 0,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  error         TEXT NOT NULL DEFAULT '',
  started_at    BIGINT NOT NULL DEFAULT 0,
  updated_at    BIGINT NOT NULL,
  finished_at   BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX idx_scrape_job_items_job_status ON scrape_job_items(job_id, status);
CREATE INDEX idx_scrape_job_items_job_order ON scrape_job_items(job_id, sort_order);
CREATE INDEX idx_scrape_job_items_novel_updated ON scrape_job_items(novel_id, updated_at);
CREATE INDEX idx_scrape_job_items_job_url ON scrape_job_items(job_id, chapter_url);

CREATE TABLE scrape_job_logs (
  id         TEXT PRIMARY KEY,
  job_id     TEXT NOT NULL REFERENCES scrape_jobs(id) ON DELETE CASCADE,
  level      TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL DEFAULT '',
  detail     TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_scrape_job_logs_job_created ON scrape_job_logs(job_id, created_at);
CREATE INDEX idx_scrape_job_logs_level_created ON scrape_job_logs(level, created_at);

-- 阅读进度 / 封面 / 下载日志 -------------------------------------
CREATE TABLE reading_progress (
  id             TEXT PRIMARY KEY,
  novel_id       TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id     TEXT NOT NULL,
  scroll_percent REAL NOT NULL DEFAULT 0,
  updated_at     BIGINT NOT NULL,
  user_id        TEXT NOT NULL DEFAULT '',
  deleted_at     BIGINT NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX idx_progress_user_novel ON reading_progress(user_id, novel_id);
CREATE INDEX idx_progress_user_updated ON reading_progress(user_id, updated_at DESC);
CREATE INDEX idx_progress_user_deleted ON reading_progress(user_id, deleted_at DESC);

CREATE TABLE novel_covers (
  novel_id     TEXT PRIMARY KEY REFERENCES novels(id) ON DELETE CASCADE,
  data         BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  source       TEXT NOT NULL DEFAULT '',
  updated_at   BIGINT NOT NULL
);

CREATE TABLE download_logs (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL,
  target_id    TEXT NOT NULL DEFAULT '',
  target_title TEXT NOT NULL DEFAULT '',
  item_count   INTEGER NOT NULL DEFAULT 0,
  created_at   BIGINT NOT NULL
);
CREATE INDEX idx_download_logs_created ON download_logs(created_at);

-- 段评 / 评分 / 评论 / 点赞 / 举报 --------------------------------
CREATE TABLE thoughts (
  id              TEXT PRIMARY KEY,
  novel_id        TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id      TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  paragraph_index INTEGER NOT NULL,
  paragraph_hash  TEXT NOT NULL DEFAULT '',
  selected_text   TEXT NOT NULL DEFAULT '',
  thought_text    TEXT NOT NULL,
  display_name    TEXT NOT NULL DEFAULT '',
  client_id_hash  TEXT NOT NULL DEFAULT '',
  ip_hash         TEXT NOT NULL DEFAULT '',
  user_agent_hash TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'visible',
  report_count    INTEGER NOT NULL DEFAULT 0,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL,
  user_id         TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_thoughts_chapter_paragraph ON thoughts(chapter_id, paragraph_index, status, created_at);
CREATE INDEX idx_thoughts_chapter ON thoughts(chapter_id, status, created_at);
CREATE INDEX idx_thoughts_created ON thoughts(created_at);
CREATE INDEX idx_thoughts_status ON thoughts(status, created_at);
CREATE INDEX idx_thoughts_user_created ON thoughts(user_id, created_at);
CREATE INDEX idx_thoughts_client_created ON thoughts(client_id_hash, created_at);
CREATE INDEX idx_thoughts_ip_created ON thoughts(ip_hash, created_at);

CREATE TABLE novel_ratings (
  id         TEXT PRIMARY KEY,
  novel_id   TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  UNIQUE (novel_id, user_id)
);
CREATE INDEX idx_ratings_novel ON novel_ratings(novel_id);
CREATE INDEX idx_ratings_user ON novel_ratings(user_id);

CREATE TABLE novel_comments (
  id             TEXT PRIMARY KEY,
  novel_id       TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id      TEXT REFERENCES novel_comments(id) ON DELETE CASCADE,
  comment_text   TEXT NOT NULL,
  display_name   TEXT NOT NULL DEFAULT '',
  has_spoiler    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'visible',
  like_count     INTEGER NOT NULL DEFAULT 0,
  report_count   INTEGER NOT NULL DEFAULT 0,
  client_id_hash TEXT NOT NULL DEFAULT '',
  ip_hash        TEXT NOT NULL DEFAULT '',
  created_at     BIGINT NOT NULL,
  updated_at     BIGINT NOT NULL
);
CREATE INDEX idx_comments_novel_parent ON novel_comments(novel_id, parent_id, status, created_at);
CREATE INDEX idx_comments_user_created ON novel_comments(user_id, created_at);
CREATE INDEX idx_comments_status_created ON novel_comments(status, created_at);
CREATE INDEX idx_comments_client_created ON novel_comments(client_id_hash, created_at);
CREATE INDEX idx_comments_ip_created ON novel_comments(ip_hash, created_at);
CREATE INDEX idx_comments_parent ON novel_comments(parent_id);

CREATE TABLE novel_comment_likes (
  id         TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES novel_comments(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  UNIQUE (comment_id, user_id)
);
CREATE INDEX idx_comment_likes_comment ON novel_comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_created ON novel_comment_likes(user_id, created_at);

CREATE TABLE novel_comment_reports (
  id          TEXT PRIMARY KEY,
  comment_id  TEXT NOT NULL REFERENCES novel_comments(id) ON DELETE CASCADE,
  reported_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL DEFAULT 'other',
  note        TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'open',
  resolved_by TEXT NOT NULL DEFAULT '',
  resolved_at BIGINT NOT NULL DEFAULT 0,
  created_at  BIGINT NOT NULL
);
CREATE INDEX idx_comment_reports_comment ON novel_comment_reports(comment_id);
CREATE INDEX idx_comment_reports_status_created ON novel_comment_reports(status, created_at);
CREATE INDEX idx_comment_reports_reporter_created ON novel_comment_reports(reported_by, created_at);
CREATE UNIQUE INDEX idx_comment_reports_open_once ON novel_comment_reports(comment_id, reported_by) WHERE status = 'open';

-- 书签 / 书架 ----------------------------------------------------
CREATE TABLE user_bookmarks (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  novel_id      TEXT NOT NULL,
  novel_title   TEXT NOT NULL DEFAULT '',
  chapter_id    TEXT NOT NULL,
  chapter_title TEXT NOT NULL DEFAULT '',
  chapter_order INTEGER NOT NULL DEFAULT 0,
  note          TEXT NOT NULL DEFAULT '',
  created_at    BIGINT NOT NULL,
  updated_at    BIGINT NOT NULL
);
CREATE UNIQUE INDEX idx_user_bookmarks_chapter ON user_bookmarks(user_id, novel_id, chapter_id);
CREATE INDEX idx_user_bookmarks_updated ON user_bookmarks(user_id, updated_at);

CREATE TABLE user_bookshelf (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  novel_id   TEXT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, novel_id)
);
CREATE INDEX idx_user_bookshelf_updated ON user_bookshelf(user_id, updated_at DESC);
