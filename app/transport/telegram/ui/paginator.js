export function paginate(items, page = 0, pageSize = 5) {
  const totalPages = Math.ceil(items.length / pageSize);

  return {
    items: items.slice(
      page * pageSize,
      page * pageSize + pageSize
    ),
    page,
    totalPages,
    hasPrev: page > 0,
    hasNext: page < totalPages - 1
  };
}
