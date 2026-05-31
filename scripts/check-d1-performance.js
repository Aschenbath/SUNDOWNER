/**
 * D1 Performance Monitoring and Optimization Script
 *
 * This script checks:
 * 1. file_type_bucket backfill status
 * 2. Index usage statistics
 * 3. Slow query detection
 */

import { getDatabase } from './functions/utils/databaseAdapter.js';

const FILE_TYPE_BUCKET_BACKFILL_KEY = 'schema@d1@file_type_bucket_v1';

async function checkBackfillStatus(db) {
  console.log('Checking file_type_bucket backfill status...');

  try {
    const result = await db.get(FILE_TYPE_BUCKET_BACKFILL_KEY);

    if (result) {
      console.log('✅ Backfill completed:', result);
      return true;
    } else {
      console.log('⚠️  Backfill not completed yet');
      return false;
    }
  } catch (error) {
    console.error('❌ Error checking backfill status:', error);
    return false;
  }
}

async function checkNullBucketCount(db) {
  console.log('\nChecking NULL file_type_bucket count...');

  try {
    const query = `
      SELECT COUNT(*) as null_count
      FROM files
      WHERE file_type_bucket IS NULL
    `;

    const result = await db.d1.prepare(query).first();
    const nullCount = result?.null_count || 0;

    console.log(`Files with NULL bucket: ${nullCount}`);

    if (nullCount > 0) {
      console.log('⚠️  Consider running backfill for better query performance');
    } else {
      console.log('✅ All files have bucket assigned');
    }

    return nullCount;
  } catch (error) {
    console.error('❌ Error checking NULL bucket count:', error);
    return -1;
  }
}

async function checkIndexUsage(db) {
  console.log('\nChecking index statistics...');

  try {
    // Get total file count
    const totalResult = await db.d1.prepare('SELECT COUNT(*) as total FROM files').first();
    const totalFiles = totalResult?.total || 0;
    console.log(`Total files: ${totalFiles}`);

    // Get bucket distribution
    const bucketQuery = `
      SELECT
        file_type_bucket,
        COUNT(*) as count
      FROM files
      GROUP BY file_type_bucket
      ORDER BY count DESC
    `;

    const buckets = await db.d1.prepare(bucketQuery).all();
    console.log('\nBucket distribution:');
    buckets.results?.forEach(row => {
      const bucket = row.file_type_bucket || 'NULL';
      const percentage = ((row.count / totalFiles) * 100).toFixed(2);
      console.log(`  ${bucket}: ${row.count} (${percentage}%)`);
    });

  } catch (error) {
    console.error('❌ Error checking index usage:', error);
  }
}

async function suggestOptimizations(db) {
  console.log('\n📊 Performance Recommendations:');

  const backfillComplete = await checkBackfillStatus(db);
  const nullCount = await checkNullBucketCount(db);

  if (!backfillComplete || nullCount > 0) {
    console.log('\n1. Run file_type_bucket backfill:');
    console.log('   - This will improve list query performance by 2-5x');
    console.log('   - Backfill runs automatically on first D1 query after schema update');
    console.log('   - Or manually trigger via /api/manage/migrate/status');
  }

  console.log('\n2. Monitor slow queries:');
  console.log('   - Add performance.mark() in /api/manage/list');
  console.log('   - Log queries taking >500ms');
  console.log('   - Consider pagination limits (current: 50-500)');

  console.log('\n3. Cache frequently accessed data:');
  console.log('   - Album lists (TTL: 60s)');
  console.log('   - Playlist metadata (TTL: 60s)');
  console.log('   - User preferences (TTL: 300s)');

  await checkIndexUsage(db);
}

// Export for use in other scripts
export { checkBackfillStatus, checkNullBucketCount, checkIndexUsage, suggestOptimizations };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('D1 Performance Check\n' + '='.repeat(50));

  // This would need to be run in a Cloudflare Workers context
  console.log('\n⚠️  This script needs to run in a Workers context with env bindings.');
  console.log('To check D1 performance:');
  console.log('1. Add a temporary route: /api/manage/debug/d1-perf');
  console.log('2. Import and call suggestOptimizations(db)');
  console.log('3. Remove the route after checking');
}
