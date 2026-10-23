'use strict';

/**
 * mzakkaCategoryResolver.js
 *
 * Maps an mzakka item to one of the 257 REAL taxonomy nodes
 * (data/mzakka-taxonomy.json), using the precomputed item->leaf map
 * (data/mzakka-item-leaf-map.json, built from real category list pages +
 * item-page breadcrumb arbitration).
 *
 * The old import behaviour built category rows out of the full breadcrumb
 * string (brands/materials/ranking facets included), which produced 25k junk
 * categories. New/unknown items not in the map fall back to their root name
 * parsed from the breadcrumb string; truly unknown items return null so the
 * caller can flag them instead of inventing a category.
 */

const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = path.join(__dirname, '..', 'data');

// taxonomy root id by display name, including the promo prefix seen in
// raw_payload.category strings
const ROOT_IDS = [
  1792, 1801, 1808, 1811, 1820, 1826, 1831, 1837, 1841, 1851, 1852, 1861, 1865,
];

let taxonomy = null;
let itemMap = null;
let rootByName = null;
let nodeIds = null;

function load() {
  if (taxonomy && itemMap) return;
  taxonomy = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'mzakka-taxonomy.json'), 'utf8'));
  const mapFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'mzakka-item-leaf-map.json'), 'utf8'));
  // supports both full ({items:{id:{canonical}}}) and slim ({items:{id:{c}}})
  itemMap = {};
  for (const [k, v] of Object.entries(mapFile.items || {})) {
    itemMap[String(k)] = v.canonical || v.c;
  }
  rootByName = new Map();
  nodeIds = new Set();
  const walk = (n) => {
    nodeIds.add(n.id);
    (n.children || []).forEach(walk);
  };
  for (const r of taxonomy.roots) {
    rootByName.set(r.name, r.id);
    walk(r);
  }
}

function stripPromoPrefix(s) {
  return String(s || '')
    .replace(/^アダルトグッズ実演販売\s*>\s*/, '')
    .trim();
}

/**
 * Resolve an item to a real mzakka taxonomy node id.
 * @param {object} item parsed item (needs item.id and item.category string)
 * @returns {{nodeId:number|null, via:'map'|'root-fallback'|null}}
 */
function resolveItemNode(item) {
  load();
  const id = String((item && item.id) || '').trim();
  if (id && itemMap[id] != null && nodeIds.has(itemMap[id])) {
    return { nodeId: itemMap[id], via: 'map' };
  }

  // fallback: root name from the breadcrumb string
  const s = stripPromoPrefix(item && item.category);
  // longest root name first so prefix collisions resolve correctly
  for (const name of [...rootByName.keys()].sort((a, b) => b.length - a.length)) {
    if (s.startsWith(name)) return { nodeId: rootByName.get(name), via: 'root-fallback' };
  }
  return { nodeId: null, via: null };
}

/**
 * Build an in-memory lookup from real mzakka node id -> our DB categories.id.
 * Only the 257 real nodes have numeric source_key under source='mzakka'.
 * @param {import('pg').Pool|import('pg').PoolClient} pg
 */
async function loadDbNodeMap(pg) {
  const { rows } = await pg.query(
    `SELECT id, source_key FROM categories
     WHERE source='mzakka' AND status='active'
       AND source_key ~ '^[0-9]+$'`
  );
  const byNode = new Map();
  for (const r of rows) byNode.set(Number(r.source_key), r.id);
  return byNode;
}

module.exports = { resolveItemNode, loadDbNodeMap, ROOT_IDS };
