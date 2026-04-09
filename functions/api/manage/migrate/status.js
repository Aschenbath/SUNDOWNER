import {
    KV_TO_D1_MIGRATION_STATE_KEY,
    checkDatabaseConfig,
    getDatabase,
} from '../../../utils/databaseAdapter.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
        },
    });
}

function parseMigrationStatus(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        return JSON.parse(rawValue);
    } catch {
        return 'corrupted';
    }
}

function buildMigrationSummary(dbConfig, migrationStatus) {
    if (!dbConfig.usingD1) {
        return {
            state: 'disabled',
            complete: false,
            nextCursor: null,
            updatedAt: null,
        };
    }

    if (!migrationStatus) {
        return {
            state: 'not_started',
            complete: false,
            nextCursor: null,
            updatedAt: null,
        };
    }

    return {
        state: migrationStatus.complete === true ? 'complete' : 'in_progress',
        complete: migrationStatus.complete === true,
        nextCursor: migrationStatus.nextCursor || null,
        updatedAt: migrationStatus.updatedAt || null,
    };
}

export function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

export async function onRequestGet(context) {
    const dbConfig = checkDatabaseConfig(context.env);

    if (!dbConfig.usingD1) {
        return jsonResponse({
            success: true,
            database: dbConfig,
            migration: buildMigrationSummary(dbConfig, null),
        });
    }

    const db = getDatabase(context.env);
    const rawMigrationStatus = await db.get(KV_TO_D1_MIGRATION_STATE_KEY);
    const migrationStatus = parseMigrationStatus(rawMigrationStatus);

    if (migrationStatus === 'corrupted') {
        return jsonResponse({
            success: false,
            error: 'Corrupted migration status data',
        }, 500);
    }

    return jsonResponse({
        success: true,
        database: dbConfig,
        migration: buildMigrationSummary(dbConfig, migrationStatus),
    });
}

export async function onRequest(context) {
    const { request } = context;

    if (request.method === 'OPTIONS') {
        return onRequestOptions();
    }

    if (request.method !== 'GET') {
        return jsonResponse({
            success: false,
            error: 'Method not allowed',
        }, 405);
    }

    return onRequestGet(context);
}
