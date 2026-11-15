/** Small, deterministic pagination helpers for the public funding explorer. */
export const PAGE_SIZE = 10;

export function paginateRecords(records, requestedPage = 1) {
  const list = Array.isArray(records) ? records : [];
  const pageSize = PAGE_SIZE;
  const count = list.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const integerPage = Number.isFinite(Number(requestedPage)) ? Math.floor(Number(requestedPage)) : 1;
  const page = Math.max(1, Math.min(totalPages, integerPage));
  const startIndex = (page - 1) * pageSize;
  return {
    items: list.slice(startIndex, startIndex + pageSize),
    count, page, pageSize, totalPages,
    first: count ? startIndex + 1 : 0,
    last: count ? Math.min(count, startIndex + pageSize) : 0,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  };
}

/** Return a compact sequence of page numbers with null for skipped ranges. */
export function pageSequence(currentPage, totalPages) {
  const total = Math.max(1, Math.floor(Number(totalPages) || 1));
  const current = Math.max(1, Math.min(total, Math.floor(Number(currentPage) || 1)));
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const values = [...new Set([1, 2, total - 1, total, current - 1, current, current + 1]
    .filter(n => n >= 1 && n <= total))].sort((a, b) => a - b);
  const output = [];
  for (let i = 0; i < values.length; i++) {
    if (i && values[i] - values[i - 1] === 2) output.push(values[i - 1] + 1);
    else if (i && values[i] - values[i - 1] > 2) output.push(null);
    output.push(values[i]);
  }
  return output;
}
