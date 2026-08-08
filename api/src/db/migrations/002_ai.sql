-- ============================================================
-- 002_ai.sql — 知舟 AI 阅读助手表
-- deepseek-v4-flash（文本）+ mimo-v2.5（图像，预留）
-- 约定：AI 产物先落 ai_generations.status=draft，审核后 publish/rejected。
-- ============================================================

-- AI 生成产物（续写 / 摘要 / 对话）-------------------------------
CREATE TABLE ai_generations (
  id          TEXT PRIMARY KEY,
  novel_id    TEXT NOT NULL DEFAULT '',
  chapter_id  TEXT NOT NULL DEFAULT '',
  kind        TEXT NOT NULL,                 -- continue | summary | dialogue
  model       TEXT NOT NULL DEFAULT '',
  params_json TEXT NOT NULL DEFAULT '{}',
  prompt      TEXT NOT NULL DEFAULT '',
  result      TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'draft',  -- draft | published | rejected
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  BIGINT NOT NULL,
  reviewed_at BIGINT NOT NULL DEFAULT 0,
  review_note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_ai_generations_user_created ON ai_generations(created_by, created_at);
CREATE INDEX idx_ai_generations_status ON ai_generations(status, created_at);
CREATE INDEX idx_ai_generations_novel ON ai_generations(novel_id, created_at);

-- AI 用量 / 成本 / 配额 -------------------------------------------
CREATE TABLE ai_usage (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL DEFAULT '',
  model             TEXT NOT NULL DEFAULT '',
  provider          TEXT NOT NULL DEFAULT '',
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  image_count       INTEGER NOT NULL DEFAULT 0,
  cost_millicents   INTEGER NOT NULL DEFAULT 0,
  created_at        BIGINT NOT NULL
);
CREATE INDEX idx_ai_usage_user_created ON ai_usage(user_id, created_at);
CREATE INDEX idx_ai_usage_created ON ai_usage(created_at);

-- API Key（AI 接口鉴权，key_hash 仅存摘要）-----------------------
CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL DEFAULT '',
  name         TEXT NOT NULL DEFAULT '',
  key_hash     TEXT NOT NULL,
  scopes       TEXT NOT NULL DEFAULT 'reader',   -- reader | admin
  expires_at   BIGINT NOT NULL DEFAULT 0,
  revoked_at   BIGINT NOT NULL DEFAULT 0,
  last_used_at BIGINT NOT NULL DEFAULT 0,
  created_at   BIGINT NOT NULL
);
CREATE UNIQUE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
