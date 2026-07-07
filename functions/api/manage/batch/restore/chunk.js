/**
 * BatchRestoreChunkAPI - 分批恢复数据的 API 端点
 * 
 * 接收并写入一批文件数据到 KV
 */

import { getDatabase } from '../../../../utils/databaseAdapter.js';

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 创建错误响应
 */
function errorResponse(message, status = 400, details = null) {
  const responseData = { success: false, error: message };
  if (details) {
    responseData.details = details;
  }
  return jsonResponse(responseData, status);
}

/**
 * 处理 POST 请求 - 恢复一批文件数据
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // 验证请求体
    const { type, data } = body;
    
    if (!type || !['files', 'settings'].includes(type)) {
      return errorResponse('type must be "files" or "settings"', 400);
    }
    
    if (!data || typeof data !== 'object') {
      return errorResponse('data must be an object', 400);
    }

    const db = getDatabase(env);
    let restoredCount = 0;
    let failedCount = 0;
    const errors = [];

    if (type === 'files') {
      // 恢复文件数据 - 并行写入
      const filePromises = Object.entries(data).map(async ([key, fileData]) => {
        try {
          // files 分支只能写真正的文件 key。拒绝写到 HybridAdapter 按前缀路由的
          // 管理键（manage@ -> 索引/系统设置）和内部分块键（chunk_）：否则一个畸形/
          // 旧/跨实例的备份就能 verbatim 覆盖实时索引或系统配置（等同写入越权）。
          // 与导出侧（batch/list.js 的 manage@ / chunk_ 跳过）对称。
          if (key.startsWith('manage@') || key.startsWith('chunk_')) {
            return { success: false, key, error: 'Refused: reserved key prefix (manage@ / chunk_) not allowed in files restore' };
          }
          if (fileData.value) {
            // 有 value 的文件（如 Telegram/Discord 分块文件）
            await db.put(key, fileData.value, {
              metadata: fileData.metadata
            });
          } else if (fileData.metadata) {
            // 只有元数据的文件
            await db.put(key, '', {
              metadata: fileData.metadata
            });
          }
          return { success: true };
        } catch (error) {
          console.error(`Failed to restore file ${key}:`, error);
          return { success: false, key, error: 'Failed to restore file' };
        }
      });

      const results = await Promise.all(filePromises);
      for (const result of results) {
        if (result.success) {
          restoredCount++;
        } else {
          failedCount++;
          errors.push({ key: result.key, error: result.error });
        }
      }
    } else if (type === 'settings') {
      // 恢复系统设置 - 并行写入
      // 备份时移除了 manage@ 前缀，恢复时需要加回来
      const settingPromises = Object.entries(data).map(async ([key, value]) => {
        try {
          // 设置值可能是对象或字符串
          const valueToStore = typeof value === 'string' ? value : JSON.stringify(value);
          // 加回 manage@ 前缀
          const fullKey = key.startsWith('manage@') ? key : `manage@${key}`;
          await db.put(fullKey, valueToStore);
          return { success: true };
        } catch (error) {
          console.error(`Failed to restore setting ${key}:`, error);
          return { success: false, key, error: 'Failed to restore setting' };
        }
      });

      const results = await Promise.all(settingPromises);
      for (const result of results) {
        if (result.success) {
          restoredCount++;
        } else {
          failedCount++;
          errors.push({ key: result.key, error: result.error });
        }
      }
    }

    return jsonResponse({
      success: true,
      restoredCount,
      failedCount,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // 只返回前10个错误
    });

  } catch (error) {
    console.error('Error in BatchRestoreChunkAPI:', error);
    return errorResponse('Server error', 500);
  }
}

/**
 * 处理 OPTIONS 请求 - CORS 预检
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * 默认请求处理器
 */
export async function onRequest(context) {
  const { request } = context;

  if (request.method === 'POST') {
    return onRequestPost(context);
  }

  if (request.method === 'OPTIONS') {
    return onRequestOptions();
  }

  return errorResponse('Method not allowed', 405);
}
