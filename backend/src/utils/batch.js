/**
 * Firestore batches are capped at 500 operations. This helper commits
 * arbitrarily large workloads in chunks of 400 operations.
 *
 * Usage:
 *   await commitInChunks(db, docs, (batch, doc) => batch.update(doc.ref, {...}));
 */
const CHUNK_SIZE = 400;

export const commitInChunks = async (db, items, applyFn, chunkSize = CHUNK_SIZE) => {
  if (items.length === 0) return 0;
  let committed = 0;
  // Callers whose applyFn writes N ops per item must pass chunkSize <= 500 / N.
  for (let i = 0; i < items.length; i += chunkSize) {
    const batch = db.batch();
    const slice = items.slice(i, i + chunkSize);
    for (const item of slice) {
      applyFn(batch, item);
    }
    await batch.commit();
    committed += slice.length;
  }
  return committed;
};
