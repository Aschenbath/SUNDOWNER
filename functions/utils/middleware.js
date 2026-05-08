import { checkDatabaseConfig as checkDbConfig } from './databaseAdapter.js';

export async function errorHandling(context) {
  return context.next();
}

export async function telemetryData(context) {
  return context.next();
}

export async function traceData(context, span) {
  void context;
  if (span) {
    span.finish?.();
  }
}

// 检查数据库是否配置
export async function checkDatabaseConfig(context) {
  const env = context.env;
  const dbConfig = checkDbConfig(env);

  if (!dbConfig.configured) {
    return new Response(
      JSON.stringify({
        success: false,
        error: '数据库未配置 / Database not configured',
        message: '请配置 KV 存储 (env.img_url) 或 D1 数据库 (env.img_d1)。 / Please configure KV storage (env.img_url) or D1 database (env.img_d1).'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  return context.next();
}
