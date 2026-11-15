#!/usr/bin/env node
/**
 * Convert GGG's official passive tree export (data.json from
 * https://github.com/grindinggear/skilltree-export) into the "processed" tree
 * format in src/data/leveling-data/trees/*_processed.json.
 *
 * Usage: node scripts/build-poe1-tree.mjs <ggg data.json> <output.json>
 *
 * The format and layout rules follow exile-leveling's seeding/src/build-tree
 * (MIT, https://github.com/HeartofPhos/exile-leveling), which this app's tree
 * files were originally generated with. Ascendancy offsets come from Path of
 * Building's fix_ascendancy_positions.py. Validate a new version by running
 * this on the 3.28 export and comparing with the bundled 3_28_processed.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const ANGLES_16 = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330];
const ANGLES_40 = [
  0, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100, 110, 120, 130, 135, 140, 150,
  160, 170, 180, 190, 200, 210, 220, 225, 230, 240, 250, 260, 270, 280, 290,
  300, 310, 315, 320, 330, 340, 350,
];

// Where each class ascendancy's start node is drawn (Path of Building's layout).
// Bloodline (alternate) ascendancies have no entry and stay at GGG's raw
// positions, matching the bundled 3.26-3.28 files.
const ASCENDANCY_OFFSETS = {
  Juggernaut: { x: -10400, y: 5200 }, Berserker: { x: -10400, y: 3700 }, Chieftain: { x: -10400, y: 2200 },
  Raider: { x: 10200, y: 5200 }, Deadeye: { x: 10200, y: 2200 }, Pathfinder: { x: 10200, y: 3700 },
  Occultist: { x: -1500, y: -9850 }, Elementalist: { x: 0, y: -9850 }, Necromancer: { x: 1500, y: -9850 },
  Slayer: { x: 1500, y: 9800 }, Gladiator: { x: -1500, y: 9800 }, Champion: { x: 0, y: 9800 },
  Inquisitor: { x: -10400, y: -2200 }, Hierophant: { x: -10400, y: -3700 }, Guardian: { x: -10400, y: -5200 },
  Assassin: { x: 10200, y: -5200 }, Trickster: { x: 10200, y: -3700 }, Saboteur: { x: 10200, y: -2200 },
  Ascendant: { x: -7800, y: 7200 }, Reliquarian: { x: -7800, y: 8900 }, Luminary: { x: -7800, y: 10600 },
  Necromantic: { x: -11500, y: 9750 },
  Warden: { x: 8250, y: 8350 }, Primalist: { x: 7200, y: 9400 }, Warlock: { x: 9300, y: 7300 },
};

const TWO_PI = Math.PI * 2;
const DEG_2_RAD = Math.PI / 180;

function getPosition(data, node) {
  const radius = data.constants.orbitRadii[node.orbit];
  const skillsPerOrbit = data.constants.skillsPerOrbit[node.orbit];
  const orbitIndex = node.orbitIndex || 0;
  const group = data.groups[node.group];
  let angle;
  if (skillsPerOrbit === 16) angle = ANGLES_16[orbitIndex] * DEG_2_RAD;
  else if (skillsPerOrbit === 40) angle = ANGLES_40[orbitIndex] * DEG_2_RAD;
  else angle = (TWO_PI / skillsPerOrbit) * orbitIndex;
  const x = group.x + radius * Math.sin(angle);
  const y = group.y - radius * Math.cos(angle);
  return [angle % TWO_PI, Math.round(x), Math.round(y)];
}

const isClassStart = (node) => node.classStartIndex !== undefined;

function nodeKind(node) {
  if (node.isAscendancyStart) return 'Ascendancy_Start';
  if (node.isMastery) return 'Mastery';
  if (node.isKeystone) return 'Keystone';
  if (node.isNotable) return 'Notable';
  if (node.isJewelSocket) return 'Jewel';
  return 'Normal';
}

function connectionAllowed(a, b, options) {
  if (!options.keepClassStarts && isClassStart(b)) return false;
  if (b.isBlighted) return false;
  if (b.isProxy) return false;
  // Mastery connections are kept: the bundled files include them.
  return a.ascendancyName === b.ascendancyName;
}

export function buildSkillTree(raw, options = { keepClassStarts: true }) {
  const tree = {
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    classes: raw.classes.map((c) => ({ name: c.name, ascendancies: c.ascendancies.map((a) => a.id) })),
    graphIndex: 0,
    graphs: [{ nodes: {}, connections: [] }],
    ascendancies: {},
    masteryEffects: {},
  };

  const addAscendancy = (id) => {
    tree.ascendancies[id] = { graphIndex: tree.graphs.length };
    tree.graphs.push({ nodes: {}, connections: [] });
  };
  for (const c of raw.classes) for (const a of c.ascendancies) addAscendancy(a.id);
  for (const a of raw.alternate_ascendancies || []) addAscendancy(a.id);

  const grow = (x, y) => {
    tree.bounds.minX = Math.min(tree.bounds.minX, x);
    tree.bounds.minY = Math.min(tree.bounds.minY, y);
    tree.bounds.maxX = Math.max(tree.bounds.maxX, x);
    tree.bounds.maxY = Math.max(tree.bounds.maxY, y);
  };

  // Proxy groups (cluster jewel socket placeholders) are kept, like the
  // bundled files.
  for (const group of Object.values(raw.groups)) {
    for (const nodeIdRaw of group.nodes) {
      const nodeId = String(nodeIdRaw);
      const node = raw.nodes[nodeId];
      if (!node) continue;
      if (!options.keepClassStarts && isClassStart(node)) continue;
      if (node.isBlighted) continue; // anoint-only notables, never on the tree
      if (node.isProxy) continue; // 'Position Proxy' placeholders for cluster jewel layout

      if (node.isMastery) {
        for (const effect of node.masteryEffects || []) {
          tree.masteryEffects[effect.effect] = { stats: effect.stats };
        }
      }

      const [angle, x, y] = getPosition(raw, node);
      let graph;
      if (node.ascendancyName !== undefined) {
        const asc = tree.ascendancies[node.ascendancyName];
        if (!asc) continue;
        if (node.isAscendancyStart) {
          asc.startNodeId = nodeId;
          asc.id = node.ascendancyName;
        }
        graph = tree.graphs[asc.graphIndex];
      } else {
        grow(x, y);
        graph = tree.graphs[tree.graphIndex];
      }

      if (!node.name) continue;
      graph.nodes[nodeId] = { x, y, k: nodeKind(node), text: node.name, stats: node.stats };

      for (const outIdRaw of node.out || []) {
        const outId = String(outIdRaw);
        const out = raw.nodes[outId];
        if (!out || !connectionAllowed(node, out, options)) continue;
        const [outAngle] = getPosition(raw, out);
        let s;
        if (node.group === out.group && node.orbit === out.orbit) {
          const rotation = (angle - outAngle + TWO_PI) % TWO_PI;
          s = { w: rotation > Math.PI ? 'CW' : 'CCW', r: raw.constants.orbitRadii[node.orbit] };
        }
        graph.connections.push(s ? { a: nodeId, b: outId, s } : { a: nodeId, b: outId });
      }
    }
  }

  for (const asc of Object.values(tree.ascendancies)) {
    const graph = tree.graphs[asc.graphIndex];
    const start = graph.nodes[asc.startNodeId];
    const offset = ASCENDANCY_OFFSETS[asc.id];
    if (!start) {
      console.warn(`ascendancy ${asc.id ?? '(unknown)'}: no start node, leaving in place`);
      continue;
    }
    if (!offset) {
      for (const n of Object.values(graph.nodes)) grow(n.x, n.y);
      continue;
    }
    const dx = offset.x - start.x;
    const dy = offset.y - start.y;
    for (const n of Object.values(graph.nodes)) {
      n.x += dx;
      n.y += dy;
      grow(n.x, n.y);
    }
  }

  return tree;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node scripts/build-poe1-tree.mjs <ggg data.json> <output.json>');
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(input, 'utf8'));
  writeFileSync(output, JSON.stringify(buildSkillTree(raw), null, 2) + '\n');
  console.log(`Wrote ${output}`);
}
