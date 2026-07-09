// functions/utils/batchRunner.js

/**
 * Helper to run a large async operation in batches.
 * @param {Array<any>} items - array of items to process
 * @param {function(any):Promise<any>} handler - async function handling a single item
 * @param {number} batchSize - number of items per batch (default 100)
 * @returns {Promise<Array<any>>} array of handler results (null for failures)
 */
export async function runInBatches(items, handler, batchSize = 100) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    // Process batch in parallel but limit concurrency to batchSize
    const batchResults = await Promise.all(
      batch.map(item =>
        handler(item).catch(err => {
          console.error('Batch item error', err)
          return null
        })
      )
    )
    results.push(...batchResults)
  }
  return results
}
