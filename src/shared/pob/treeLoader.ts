/**
 * Passive Tree Template Loader
 * 
 * Loads processed tree JSON and generates SVG templates + node lookups.
 * This runs at build time (imported by main process).
 * Supports both PoE1 (3.26, 3.27, 3.28, 3.30) and PoE2 trees.
 */

import { SkillTreeData, NodeLookup, buildTemplate } from './treeSvg';
import tree326 from '../../data/leveling-data/trees/3_26_processed.json';
import tree327 from '../../data/leveling-data/trees/3_27_processed.json';
import tree328 from '../../data/leveling-data/trees/3_28_processed.json';
import tree330 from '../../data/leveling-data/trees/3_30_processed.json';
import treePoe2Legacy from '../../data/leveling-data/trees/poe2_processed.json';
import treePoe2v44 from '../../data/leveling-data/trees/poe2_4.4_processed.json';

// Type assertions for imported JSON
const tree326Data: SkillTreeData = tree326 as unknown as SkillTreeData;
const tree327Data: SkillTreeData = tree327 as unknown as SkillTreeData;
const tree328Data: SkillTreeData = tree328 as unknown as SkillTreeData;
const tree330Data: SkillTreeData = tree330 as unknown as SkillTreeData;
const treePoe2LegacyData: SkillTreeData = treePoe2Legacy as unknown as SkillTreeData;
const treePoe2v44Data: SkillTreeData = treePoe2v44 as unknown as SkillTreeData;

// Build node lookups for 3.26 (flatten all graphs)
export const nodeLookup326: NodeLookup = Object.assign(
  {},
  ...tree326Data.graphs.map((graph) => graph.nodes)
);

// Build node lookups for 3.27 (flatten all graphs)
export const nodeLookup327: NodeLookup = Object.assign(
  {},
  ...tree327Data.graphs.map((graph) => graph.nodes)
);

// Build node lookups for 3.28 (flatten all graphs)
export const nodeLookup328: NodeLookup = Object.assign(
  {},
  ...tree328Data.graphs.map((graph) => graph.nodes)
);

// Build node lookups for PoE2 Legacy (pre-4.4)
export const nodeLookup330: NodeLookup = Object.assign(
  {},
  ...tree330Data.graphs.map((graph) => graph.nodes)
);

/**
 * PoE1 tree to use for a Path of Building treeVersion ("3_26", "3_29", ...).
 * Versions without bundled data (3.29, anything newer, or missing) use the
 * newest bundled tree, which is also what the tree window draws.
 */
export type Poe1TreeKey = '3_26' | '3_27' | '3_28' | '3_30';
export function resolvePoe1TreeKey(treeVersion?: string | null): Poe1TreeKey {
  if (treeVersion === '3_26' || treeVersion === '3_27' || treeVersion === '3_28') return treeVersion;
  return '3_30';
}
export function getPoe1NodeLookup(treeVersion?: string | null): NodeLookup {
  switch (resolvePoe1TreeKey(treeVersion)) {
    case '3_26': return nodeLookup326;
    case '3_27': return nodeLookup327;
    case '3_28': return nodeLookup328;
    default: return nodeLookup330;
  }
}

export const nodeLookupPoe2Legacy: NodeLookup = Object.assign(
  {},
  ...treePoe2LegacyData.graphs.map((graph) => graph.nodes)
);

// Build node lookups for PoE2 v4.4+
export const nodeLookupPoe2v44: NodeLookup = Object.assign(
  {},
  ...treePoe2v44Data.graphs.map((graph) => graph.nodes)
);

// Default to latest PoE2 tree
export const nodeLookupPoe2 = nodeLookupPoe2v44;

// Generate SVG templates for PoE1 3.26
export const template326 = buildTemplate(tree326Data, nodeLookup326);

// Generate SVG templates for PoE1 3.27
export const template327 = buildTemplate(tree327Data, nodeLookup327);

// Generate SVG templates for PoE1 3.28
export const template328 = buildTemplate(tree328Data, nodeLookup328);

// Generate SVG templates for PoE1 3.30 (Covens of Umbra; adds the Luminary ascendancy).
// Built from GGG's 3.30.0 export with scripts/build-poe1-tree.mjs.
export const template330 = buildTemplate(tree330Data, nodeLookup330);

// Generate SVG templates for PoE2 Legacy
export const poe2TemplateLegacy = buildTemplate(treePoe2LegacyData, nodeLookupPoe2Legacy);

// Generate SVG templates for PoE2 v4.4+
export const poe2Templatev44 = buildTemplate(treePoe2v44Data, nodeLookupPoe2v44);

// Default to latest PoE2 template
export const poe2Template = poe2Templatev44;

// Export tree data for reference
export const skillTree326 = tree326Data;
export const skillTree327 = tree327Data;
export const skillTree328 = tree328Data;
export const skillTree330 = tree330Data;
export const skillTreePoe2Legacy = treePoe2LegacyData;
export const skillTreePoe2v44 = treePoe2v44Data;
export const skillTreePoe2 = treePoe2v44Data;

/**
 * Detect which PoE2 tree version to use based on allocated nodes and build source
 * Returns the appropriate node lookup and tree data
 */
export function detectPoe2TreeVersion(
  allocatedNodes: number[], 
  buildSource?: 'pob' | 'mobalytics' | 'maxroll',
  pobUrlVersion?: number
): {
  nodeLookup: NodeLookup;
  template: ReturnType<typeof buildTemplate>;
  treeData: SkillTreeData;
  version: 'legacy' | 'v4.4';
} {
  if (!allocatedNodes || allocatedNodes.length === 0) {
    // Default to latest for empty builds
    return {
      nodeLookup: nodeLookupPoe2v44,
      template: poe2Templatev44,
      treeData: treePoe2v44Data,
      version: 'v4.4',
    };
  }

  // For Mobalytics/Maxroll imports: always use NEW tree (their data is current)
  if (buildSource === 'mobalytics' || buildSource === 'maxroll') {
    console.log(`[Tree Loader] Using PoE2 v4.4 tree (${buildSource} import)`);
    return {
      nodeLookup: nodeLookupPoe2v44,
      template: poe2Templatev44,
      treeData: treePoe2v44Data,
      version: 'v4.4',
    };
  }

  // For PoB imports with URL version info: version 4 is legacy, future versions use new tree
  if (buildSource === 'pob' && pobUrlVersion !== undefined) {
    if (pobUrlVersion <= 4) {
      console.log(`[Tree Loader] Using PoE2 Legacy tree (PoB URL version ${pobUrlVersion})`);
      return {
        nodeLookup: nodeLookupPoe2Legacy,
        template: poe2TemplateLegacy,
        treeData: treePoe2LegacyData,
        version: 'legacy',
      };
    } else {
      console.log(`[Tree Loader] Using PoE2 v4.4 tree (PoB URL version ${pobUrlVersion})`);
      return {
        nodeLookup: nodeLookupPoe2v44,
        template: poe2Templatev44,
        treeData: treePoe2v44Data,
        version: 'v4.4',
      };
    }
  }

  // Fallback: Check if any nodes exist only in the new tree
  const hasNewTreeNodes = allocatedNodes.some(nodeId => {
    const nodeIdStr = nodeId.toString();
    return nodeLookupPoe2v44[nodeIdStr] && !nodeLookupPoe2Legacy[nodeIdStr];
  });

  if (hasNewTreeNodes) {
    console.log('[Tree Loader] Detected PoE2 v4.4 tree (has new nodes)');
    return {
      nodeLookup: nodeLookupPoe2v44,
      template: poe2Templatev44,
      treeData: treePoe2v44Data,
      version: 'v4.4',
    };
  }

  // If all nodes exist in both trees, default to NEW tree (not legacy)
  // This ensures recent builds without new nodes still use the latest tree
  console.log('[Tree Loader] Using PoE2 v4.4 tree (default - no version indicators)');
  return {
    nodeLookup: nodeLookupPoe2v44,
    template: poe2Templatev44,
    treeData: treePoe2v44Data,
    version: 'v4.4',
  };
}

// Legacy exports (default to 3.26 for backward compatibility)
export const nodeLookup = nodeLookup326;
export const { svg, viewBox, styleTemplate } = template326;
export const skillTree = tree326Data;

console.log(`[Tree Loader] Loaded PoE1 3.26 tree: ${Object.keys(nodeLookup326).length} nodes`);
console.log(`[Tree Loader] Loaded PoE1 3.27 tree: ${Object.keys(nodeLookup327).length} nodes`);
console.log(`[Tree Loader] Loaded PoE1 3.28 tree: ${Object.keys(nodeLookup328).length} nodes`);
console.log(`[Tree Loader] Loaded PoE1 3.30 tree: ${Object.keys(nodeLookup330).length} nodes`);
console.log(`[Tree Loader] Loaded PoE2 Legacy tree: ${Object.keys(nodeLookupPoe2Legacy).length} nodes`);
console.log(`[Tree Loader] Loaded PoE2 v4.4 tree: ${Object.keys(nodeLookupPoe2v44).length} nodes`);
