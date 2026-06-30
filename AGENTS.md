# AGENTS.md — Collaboration Notes for AI Agents

## Project Overview

SUNDOWNER — Cloudflare Pages + Workers media library. Storage backends: Telegram, Discord, S3, R2, HuggingFace. KV stores file metadata, index chunks manage file listing.

---

## Critical Architecture Constraints

### 1. KV metadata 写入的安全层 (IMPORTANT)

`functions/utils/databaseAdapter.js` 的 `put()` 方法对 **非 `manage@` 前缀** 的 key 自动调用 `stripSensitiveMetadata()`，静默剥离以下字段：

```
TgBotToken, TgProxyUrl, DiscordBotToken, DiscordProxyUrl,
S3AccessKeyId, S3SecretAccessKey, HfToken
```

**绝不能** 通过 per-file metadata 存储敏感凭证。写入看起来成功但字段实际不存在。

正确做法：
- 凭证统一存 KV upload config（`manage@sysConfig@upload`，以 `manage@` 开头，不被 strip）
- 文件级关联 channel 时写 `ChannelName` 字段（不被 strip），让 `resolveTelegramAccess` 通过 `findChannelByName` 匹配 channel config 中的 token

### 2. KV list 操作额度 (FREE PLAN: 1000次/天)

`indexManager.js` 中的 `getAllPendingOperations` 和 `rebuildIndex` 使用 `kv.list()`。如果 pending operations 获取失败会 fallback 到 `rebuildIndex`，其 while(true) 循环会快速耗尽 list 额度，导致 dashboard / 回收站 / 批量操作全部 429。

**安全的操作**（不消耗 list 额度）：`kv.get()`, `kv.put()`, `kv.delete()`
**危险的操作**：`kv.list()` — 所有涉及 index scan 的功能

扫描 index 应优先用 chunk-based 读取（`kv.get('manage@index_0')` 等），避免 `kv.list()`。

### 3. Telegram file_id vs file_unique_id

- `file_id`（60+ 字符）：可用于 `getFile` API 下载文件，与 bot 绑定
- `file_unique_id`（~16 字符）：跨 bot 唯一标识符，**不能** 用于下载
- `looksLikeTelegramFileId()` 用 length >= 40 区分两者
- batch sync 导入的文件 key 里存的是 `file_unique_id`，需要通过 `forwardMessage` 恢复真实 `file_id`

### 4. Bot Token 解析链（resolveTelegramAccess）

`functions/utils/mediaSecurity.js` 中 `resolveTelegramAccess(env, metadata)` 的查找顺序：
1. `metadata.TgBotToken`（被 strip，通常不存在）
2. `loadUploadConfig(env)` → `findChannelByName(config.telegram, metadata.ChannelName)`
3. `env.TG_BOT_TOKEN`（可能未设置）

如果三者都失败，返回 null。确保至少有一个路径可用（推荐设 env vars 或存 KV upload config）。

---

## File Structure (Key Files)

```
functions/
  file/[[path]].js          — 文件直链访问端点（GET /file/...）
  utils/
    databaseAdapter.js       — KV 抽象层，含 stripSensitiveMetadata 安全守卫
    telegramAPI.js           — Telegram Bot API 封装
    telegramFileId.js        — file_id 解析/回退逻辑
    mediaSecurity.js         — resolveTelegramAccess 等凭证解析
    indexManager.js          — 文件索引管理（chunk-based，有 list 额度风险）
  api/manage/
    sysConfig/upload.js      — upload config CRUD + getUploadConfig()
    migrate/
      recover-tg-file-ids.js — TgFileId 迁移恢复接口
```

---

## Pending Issues (as of 2026-04-13)

1. **时间戳格式文件 500**：`1775628424666_市政厅前的吻.jpg` 等，非 `tg_` 格式，无法从 key 提取 messageId，需手动查原始消息。Codex 已新增 `GET /api/manage/migrate/scan-orphan-files` 用于定位这类候选记录，但还没有自动恢复能力
2. ~~**D1 迁移**~~：**已完成 (2026-04-13)**。生产已绑定 `img_d1`，KV→D1 迁移已执行（38 files, 2 settings），当前运行 Hybrid 模式，list 查询走 D1 SQL 不再消耗 KV list 配额
