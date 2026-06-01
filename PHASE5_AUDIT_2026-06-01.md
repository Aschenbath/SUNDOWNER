# Phase 5 审计待办 — leosDrive-telegram-sync（全盘 audit 长尾）

> 2026-06-01 生成。23-batch workflow 全盘扫 126 个源文件（已排除 node_modules/.wrangler/.worktrees/test），
> 对每个 HIGH/MEDIUM 发现派**对抗性 refuter** 验证。结果：**44 高/中审计 → 35 confirmed、0 uncertain、9 refuted**，外加 51 个未验证的 LOW。
> 严重度 = refuter **修正后**的 adjustedSeverity（很多原 MEDIUM 被验证后下调为 LOW）。
> 项目路径：`D:\Codex\midTime\leosDrive-telegram-sync`，远程 `Aschenbath/SUNDOWNER`，分支 `main`，当前 HEAD `af220a8`（Phase 4）。

> ⚠️ **行号会漂**：下面行号是 audit 当时（af220a8）的。动手前用 grep 锚点重新定位（吸取 Phase 3/4 教训）。
> ⚠️ **改前必复核**：Phase 3/4 多次发现文档假设有误，每条动手前用 read-only 复核数据流/调用方。

---

## 系统性主题（不是孤立 bug，是反复出现的模式）

1. **KV 共享键的无锁 read-modify-write（lost update）** — 出现在 ≥8 处：moments stateKey（HIGH）、index merge、rateLimiter、apiTokens security blob、telegramSync upload config、mindStore、blockip/whiteip、movieRepository。KV 无 CAS，纯 KV 下无法完全原子化。项目已有 `acquireRebuildLock`（indexManager.js）这个 advisory KV 锁范式可复用，但只用在 rebuild。**需决定统一策略**：复用锁范式 / 拆独立键 / 接受 best-effort。
2. **`fetchOthersConfig` catch fallback 缺 key → 调用方 null-deref → 500** — random/index.js、dav/[[path]].js 都中招。根因在 sysConfig.js:169-175 的 fallback 只返回 `{telemetry:{enabled:false}}`，缺 `webDAV`/`randomImageAPI`。**一处修 fallback 形状即可同时治多个调用点**。
3. **独立 await 串行化（serial-io）** — ≥12 处可改 bounded-concurrency 批次（项目已有 CONCURRENCY=3 范式）。低风险高收益，但量大。

---

## Tier 1：真 HIGH（confirmed，adjustedSeverity=HIGH）— 数据损坏，优先

### H1. applyBatchAddOperation 用过期数组下标，损坏无关文件
- **文件**：`functions/utils/indexManager.js:1438-1444`（map 构建 1417-1420，insertFileInOrder 1798+）
- **grep**：`grep -n "existingFilesMap\|insertFileInOrder" functions/utils/indexManager.js`
- **问题**：`existingFilesMap` 缓存 fileId→数组下标。新文件走 `insertFileInOrder`（unshift/splice）会把插入点之后所有元素下标 +1，但 map 不更新。同一批次后续若有对已存在文件的 UPDATE，`index.files[staleIndex] = fileItem` 会覆盖**另一个**文件，被覆盖文件的真条目保留旧值 → 静默数据损坏，updatedCount 仍正常。
- **触发**：batch_add 混合"新文件 + 对已索引文件的更新"。唯一源调用方 `tags/batch.js:149`（skipExisting=false）；DB 有记录 ≠ index 有记录，所以正常可达。
- **修法**：`existingFilesMap` 改存**对象引用**而非下标。更新分支 `const pos = index.files.indexOf(existing); if(pos!==-1) index.files[pos]=fileItem; existingFilesMap.set(fileId, fileItem)`；新文件分支 `insertFileInOrder` 后 `existingFilesMap.set(fileItem.id, fileItem)`，删掉 1441 的 indexOf。**顺带修掉 LOW（每个新文件一次 O(n) indexOf）**。
- **风险**：低，改动自包含，逻辑清晰。**这条我有把握，是 Tier 1 里最安全的一条。**

### H2. moments 相册 stateKey 无锁 RMW → 相册丢图
- **文件**：`functions/utils/telegramSync.js:665-710`（upsert 块 712-761，momentsStore.updatePost 删后重插）
- **grep**：`grep -n "buildTelegramMomentsStateKey\|db.put(stateKey" functions/utils/telegramSync.js`
- **问题**：Telegram 相册每张图是独立 webhook POST，共享 media_group_id → 同一 stateKey。dedupe 按 message_id 各自放行不串行化。`db.get(stateKey)→merge→db.put(stateKey)` 无锁，并发两张图都读到同一（常为空）previousState，各自只含自己的 fileId，last-writer-wins → 发布的 Moments 帖丢图。momentsStore.updatePost 是 `DELETE attachments WHERE post_id` 后重插，封死了损失。
- **修法**（属系统性主题1，需选策略）：(2) **store 层改加性**——按 message_id INSERT 单条 attachment，并发各加各的（**推荐**，KV 下唯一真原子方案）；或 (1) 乐观并发重试循环；或 (3) 按 stateKey 加锁。
- **风险**：中。方案 (2) 要动 momentsStore 的 attachment 主键（现在按数组 index `createAttachmentId(postId, index)`）。**需 Gilbert 定方案**。

> 注：原审计第 3 个 HIGH（upload/index.js:657-671 Telegram 上传 DB 写失败仍更新索引）被 refuter **下调为 MEDIUM**，见 Tier 2。

---

## Tier 2：MEDIUM（confirmed，adjustedSeverity=MEDIUM）— 真 bug/真损耗

### 数据完整性 / 错误处理
- **M1. `batch/restore/chunk.js:72-91`** 〔data-corruption〕files 类型 restore 把**任意 key** verbatim `db.put`，没校验是不是文件 id。payload 含 `manage@index`/`manage@sysConfig@...` 会**直接覆盖实时索引/系统设置**（HybridAdapter 按前缀路由）。admin-gated，但一个畸形/旧/跨实例备份就静默毁核心状态、还返回 success。**修**：files 分支拒绝 `key.startsWith('manage@')||startsWith('chunk_')`，计入 failedCount。export 侧（list.js:110）已有此过滤，restore 侧漏了。〔**这条是 Tier 2 里最该先做的，逻辑等同一个写入越权**〕
- **M2. `upload/index.js:657-671`** 〔wrong-error-handling，原 HIGH 降 MEDIUM〕Telegram 通道 metadata DB 写失败时，catch 只设 500 不 return，继续 `waitUntil(endUpload→addFileToIndex)` → 留下指向无 metadata 的悬空索引项。其余 4 个通道都先 return。仅 KV-index 模式中招（D1 模式 addFileToIndex early-return）。**修**：catch 里直接 return 500，或置 flag 守住 671。
- **M3. `upload/index.js:394,406-412`** 〔resource-leak〕R2 字节先写、metadata 后写；DB 写失败返回 500 但 R2 对象已留下成孤儿，无 GC 回收（孤儿扫描只看 DB 索引、不列 R2）。**修**：catch 里 best-effort `R2DataBase.delete(fullId)` 再返回。
- **M4. `albumsStore.js:263-297`** 〔non-atomic-write〕`replaceAlbumStateInD1` 先无条件 DELETE 所有 album_files（收藏+全部归属），再逐条重插，**无事务**。中途任一语句抛错 → 整个相册归属+收藏丢失无回滚。每次 POST {state}/{migrate} 可达，连单文件改动都走全表重写。**修**：用 `env.img_d1.batch([...])` 包成一个隐式事务（同时治 M-perf 的串行）。
- **M5. `finalize.js:385-394`** 〔wrong-ordering〕`cleanupOldIndexChunks` 在 `saveIndex` **之前**删旧 chunk，且 saveIndex 先写 meta 再写 chunk body。save 中途失败 → 磁盘索引截断/meta 指向半成品。canonical 的 `saveChunkedIndex` 是反过来的（先 body 后 meta）。**修**：先 saveIndex 成功再 cleanup。
- **M6. `d1Database.js:555-563`** 〔pagination〕`total` 取自首行的 `COUNT(*) OVER()`，offset 越过末行时返回空 → total=0，UI 页数/计数错乱、无法退回有效范围。`?page=9999` 可达（list.js 不按 total 上钳 page）。**修**：results 空且 offset>0 时补一次 `SELECT COUNT(*)`。
- **M7. `move/[[path]].js:62-74,118-123`** 〔data-corruption〕move **不查目标是否存在**（rename 有 409 检查），目标同名文件的 KV/D1 metadata + R2/S3 对象被静默覆盖、原文件永久丢失、仍返回 success。**修**：moveFile 前 `getWithMetadata(newFileId)`，存在则进 failedFiles/返回 409，照抄 rename:109-118。
- **M8. `tokenExpiration.js:12-19`** 〔fail-open，安全〕`isExpired` 对损坏/非 ISO 的 expiresAt → `new Date(x).getTime()=NaN`，`now>NaN` 恒 false → token 当**永不过期**。POST/PUT 端点直接存请求体的 expiresAt 无校验，所以可达。corrupt token 变永久有效且躲过 auto-delete。**修**：`if(Number.isNaN(t)) return true`（fail-closed）。
- **M9. `userConfig.js:32-43`** 〔fragile-parse〕**未鉴权、登录前**的公开端点，循环 `JSON.parse(config.value)`，首个解析失败即整体 500、丢所有 config。`USER_CONFIG={"siteTitle":"My Site"}` 这种文档化配置 + admin 保存的裸字符串都会触发。**修**：per-key try/catch，失败回退裸值/跳过，不要整体 500。
- **M10. `fileTools.js:134-142`** 〔secret-leak〕`getFileContent` 把**全部入站 header verbatim** 转发给第三方（telegra.ph / api.telegram.org / 代理）。WebDAV GET 代理注入的 `Authorization: Basic admin凭据` 因此外泄到外部主机。**修**：只 allowlist 转发 `Range/If-None-Match/If-Modified-Since/Accept-Encoding`，显式丢弃 Authorization/Cookie/authCode。

### KV 竞态（系统性主题1，需统一策略后再批量修）
- **M11. `indexManager.js:589-715,749-755`** 〔race〕merge 的 `getIndex→apply→saveChunkedIndex` 无锁（只有 rebuild 有锁），readIndex 每次读都触发 merge。并发下旧请求可在新请求之后 save，写回更旧 lastOperationId+更少文件；若新请求已 cleanup 删掉 op 记录，该 op 永久丢失直到 full rebuild。普通并发 list 流量可达。**修**：merge 临界区加短 TTL 锁，或 save 前乐观重读 INDEX_META_KEY 的 lastOperationId、确认提交后才删 op。
- **M12. `apiTokens.js:94-224`** 〔race〕全部 token 操作对 `manage@sysConfig@security`（**同一文档还存 admin 凭据**）做无锁 RMW。并发 GET（触发 auto-delete 写回）+ account.js 改密码可互相覆盖，最坏静默回退刚改的 admin 密码。**修**：token 拆独立键 `manage@apiTokens`，或 auto-delete 走锁/移出读路径。
- **M13. `telegramSync.js:431-450`** 〔race〕`updateTelegramChannels` 对 `manage@sysConfig@upload` 整 blob 无锁 RMW。公开 webhook（仅凭 secret）+ 手动 run + admin 存配置并发互相覆盖，丢 lastUpdateId/回退配置编辑。**修**：per-channel 状态拆独立键，或加锁。
- **M14. `rateLimiter.js:33-65`** 〔race〕`get→put` 非原子，并发 burst 各读同一数组各写回，last-writer-wins 只记 ~1 个 → 限流被绕过。login/auth-session 的唯一暴破防护。catch 和 !kv 分支还 fail-open。**修**：KV 无法完全原子，改 bucketed counter 键 `${key}:${floor(now/windowMs)}` 减少丢失，或敏感端点上 Durable Object。

### 性能（serial-io / O(n²)，confirmed MEDIUM）
- **M15. `albumsStore.js:239-297`** O(albums+assignments+favorites) 串行 D1 往返 → 用 `batch()`（同时治 M4）。
- **M16. `movieRepository.js:485-506`** `hydrateEntries` 每条 movie 串行 getRawMovieCache + 可能串行 TMDb 网络调用 → bounded-concurrency 批次。
- **M17. `chunkMerge.js`（chunkUpload.js:1018-1095）** `checkChunkUploadStatuses` 逐 chunk 串行读、每次 merge 跑最多 3 次 → Promise.all 批次，并删掉 line 97 冗余首扫。
- **M18. `tags/batch.js:100-145`** fileIds 无上限 + 全串行 RMW，大输入撞 subrequest 上限留半成品。**修**：照 bin/batch.js 上限 100 + 批次并发。
- **M19. `migrate/kv-to-d1.js:110-159`** limit 最高 2000，逐键串行 d1.put（最多 2000 次串行往返）→ 批次并发/`batch()`。项目已有 `promiseLimit` helper（indexManager.js:1840）可直接复用。

---

## Tier 3：被 refuter 下调为 LOW 的 confirmed（真 bug 但影响小）+ 51 个未验证 LOW

> 这一层量大、风险低，**时间不够可整层跳过**或只挑顺手的。完整明细见审计 JSON
> （temp：`...\tasks\wuatq7a72.output`，可能被清，需要时重跑）。代表性条目：

**被下调为 LOW 的 confirmed（影响小但已验证为真）：**
- `block/[[path]].js:29-33` + `white/[[path]].js:29-33` 文件不存在时 `value.metadata` null-deref → 500（应 404）。admin-gated。
- `random/index.js:34-41` + `dav/[[path]].js:51-55` 〔系统性主题2〕others-config 读失败 → fallback 缺 key → null-deref → 500（应 403/503）。**一处修 sysConfig.js fallback 形状即可同治**。
- `indexManager.js:1543-1546/1624-1626` cleanupOperations 异常路径返回 undefined，调用方 deref（但实际被外层 catch 兜住，近乎不可达）。
- `apiCache.js:61-70` read-through 回填可在 invalidate 后复活陈旧数据（60s TTL 自愈）。
- `momentsStore.js:240-307` 手动 rollback 自身失败时吞原错误（双重失败路径，对照 Phase 4 已修的 databaseAdapter 复合错误，这里漏了）。
- `adminProfile.js:37-41` getAdminProfile JSON.parse 无 try/catch，corrupt profile 崩且 save 也走 getAdminProfile 所以不可自愈。
- `tagHelpers.js:64-67` mergeTags remove 分支对非字符串 tag 元素 `.toLowerCase()` 崩（边缘）。
- `finalize.js:103-162` totalChunks 无上限 → readAllChunks 串行海量读（admin-gated + 平台 subrequest 兜底）。
- `r2Storage.js:35-45` range 请求 Content-Length 不按 EOF 钳制（仅本地 R2 shim）。
- `cusConfig/list.js:44-62` dealByIP O(U×N) 分组（admin-only）。

**51 个未验证 LOW 的主要类别**（未跑 refuter，可信度按 audit 自报）：
- **常量时间比较缺失**（防御纵深）：login.js:65、dualAuth.js:42、dav webhook secret、telegramSync webhook secret。项目自己在 userAuth/adminSession 已用常量时间，这几处不一致。
- **输入校验/边界**：tags/[[path]].js:35 decodeURIComponent 在 try 外（malformed → 500 应 400）、tags/autocomplete limit=NaN 静默返空、public/list.js count 负数错切片、directoryTree.js cacheTime 未校验进 header。
- **更多 serial-io**：list.js:486-504 KV supplement、batch/settings.js、batch/list.js、momentsStore validateAttachments(≤9)、albumsStore loadAlbumStateFromD1(3 SELECT)、captureTimeMetadata、dualAuth 同请求读 security blob 4 次。
- **更多 KV 竞态**：mindStore.js:147-196、movieRepository.js:466-483（仅比数组长度，等长并发编辑漏检）、blockip/whiteip（lost update + 空串/逗号污染 CSV）。
- **errorHandling.js**（未接线，潜在）：106 `process.env` 在 Pages 无 process 会崩、86-100 向客户端泄原始 error.message。
- **杂项**：userConfig.js:45 死代码、telegramSync 重复读/重复写、purgeCache.js:25 手拼 JSON body（特殊字符文件名静默不purge）、uploadTools getIPAddress IP header 未编码进外部 URL。

---

## 被对抗性验证**驳回**的 9 条（假阳性，别再报）

1. `d1Database.js:207-221` ensureSchema 永久缓存 rejected promise —— 驳回
2. `telegramSync.js:295-364` album command state RMW race —— 驳回
3. `purgeCache.js:3-14` 模块级 config 全局竞态 —— 驳回
4. `tagHelpers.js:88-99` parseSearchQuery 丢含 `.`/`+` 的 hashtag —— 驳回
5. `upload/index.js` tryRetry 复用可变 metadata 跨通道 —— 驳回
6. `tags/[[path]].js:152-176` tag 更新覆盖 chunked-file 的 KV value —— 驳回
7. `tags/batch.js:103-125` 同上批量版 —— 驳回
8. `bin/batch.js:108-114` 回收站 restore 覆盖 chunked value —— 驳回
9. `r2Storage.js:169-184` multipart complete 静默跳过缺失 part —— 驳回

> 6/7/8 看起来很像真 bug（chunked 文件 value 被 KV 覆盖），但 refuter 实际追了 chunked 存储路径后证伪。**别凭标题重开。**

---

## 覆盖说明

- **126 文件全部审完。** batch[11]（moments/movies/playlists/albums/mind 的 API handler）首轮没返回 StructuredOutput，已单独补跑：**这 5 个 handler 基本干净**，只出 2 条 LOW（无新 HIGH/MEDIUM）：
  - `moments.js:254-259`〔LOW〕PATCH 先传图后校验 id，缺 id 时照片已上传到 R2/Telegram 成孤儿、才抛 400。**修**：handlePatch 顶部先校验 id 再 `buildMomentMutationInput`。
  - `mind.js:36-51`〔LOW〕POST 未识别的 action 静默落到 `appendWebMindMessage`（带 text 的 typo 会被当新消息追加）。**修**：只在 `!action`/`action==='append'` 时追加，否则 400。
  这 5 文件的底层 store（momentsStore/movieRepository/albumsStore/mindStore/playlistsStore）已在 batch 5/6 审过（见上）。

---

## 建议执行顺序（待 Gilbert 定 scope）

1. **H1**（applyBatchAddOperation）— 安全自包含，直接做。
2. **M1**（restore 写越权）、**M8**（token fail-open）、**M9**（userConfig 500）、**M10**（header 泄凭据）— 单文件、低风险、收益清晰，可批量做。
3. **M2/M3/M5/M6/M7**（错误处理/数据完整性，单点）— 逐个做。
4. **系统性主题2**（sysConfig fallback 形状）— 一处修，同治 random/dav 两个 null-deref。
5. **H2 + M11/M12/M13/M14（KV 竞态）** — 需先定统一策略，Gilbert 拍板后做。
6. **性能 serial-io（M15-M19 + LOW 串行）** — 低风险高收益，批量做或挑重点。
7. **Tier 3 LOW** — 时间够再扫，或整层跳过。
