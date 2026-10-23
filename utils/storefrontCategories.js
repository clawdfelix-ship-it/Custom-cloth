function normalizeNode(row) {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    count: Number(row.count || 0),
    parentId: row.parentId != null ? Number(row.parentId) : row.parent_id != null ? Number(row.parent_id) : null,
    children: Array.isArray(row.children) ? row.children.map(normalizeNode) : [],
  };
}

function sortNodes(nodes = []) {
  nodes.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.name).localeCompare(String(b.name), 'ja');
  });
  nodes.forEach((node) => sortNodes(node.children));
  return nodes;
}

function buildTreeFromNestedRows(rows = []) {
  return sortNodes(rows.map(normalizeNode));
}

function buildTreeFromFlatRows(rows = []) {
  const map = new Map();
  const roots = [];

  for (const row of rows) {
    const node = normalizeNode(row);
    node.children = [];
    map.set(node.id, node);
  }

  for (const node of map.values()) {
    if (node.parentId != null && map.has(node.parentId)) {
      map.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return sortNodes(roots);
}

function flattenTree(nodes = [], flat = [], trail = [], slugTrail = []) {
  for (const node of nodes) {
    const pathNames = [...trail, node.name];
    const pathSlugs = [...slugTrail, node.slug];
    flat.push({
      id: node.id,
      slug: node.slug,
      name: pathNames.join(' / '),
      count: node.count,
      parentSlug: slugTrail.length ? slugTrail[slugTrail.length - 1] : null,
      depth: trail.length,
    });
    flattenTree(node.children, flat, pathNames, pathSlugs);
  }
  return flat;
}

function buildCategoryTree(rows = [], { includeAll = true, totalCount = 0 } = {}) {
  const hasParentRefs = rows.some((row) => row && (row.parentId != null || row.parent_id != null));
  const tree = hasParentRefs ? buildTreeFromFlatRows(rows) : buildTreeFromNestedRows(rows);
  const flat = [];

  if (includeAll) {
    flat.push({
      id: 0,
      slug: 'all',
      name: '全部商品',
      count: Number(totalCount || 0),
      children: [],
      depth: 0,
      parentSlug: null,
    });
  }

  flattenTree(tree, flat, []);

  return { flat, tree };
}

module.exports = {
  buildCategoryTree,
};
