const DEFAULT_DENSITY = 0.42;

export function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

export function createSeededRng(seedText) {
  let h = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    h ^= seedText.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return function rng() {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateGraph(options = {}) {
  const n = clampInteger(options.n ?? 6, 2, 12);
  const density = clampDensity(options.density ?? DEFAULT_DENSITY);
  const rng = options.rng ?? Math.random;
  const target = options.target ?? (rng() < 0.52 ? "matchable" : "blocked");

  const adjacencySets = Array.from({ length: n }, () => new Set());

  if (target === "matchable") {
    addGuaranteedPerfectMatching(adjacencySets, n, rng);
    addRandomEdges(adjacencySets, n, density, rng);
  } else {
    addGuaranteedHallBlock(adjacencySets, n, density, rng);
  }

  const graph = buildGraph(n, adjacencySets);
  const matching = findMaximumMatching(graph);

  return {
    ...graph,
    kind: matching.size === n ? "matchable" : "blocked",
    maximumMatchingSize: matching.size,
  };
}

export function findMaximumMatching(graph) {
  const matchRightToLeft = Array(graph.n).fill(-1);

  for (let left = 0; left < graph.n; left += 1) {
    const seenRight = Array(graph.n).fill(false);
    tryAugment(left, seenRight, matchRightToLeft, graph.adjacency);
  }

  const pairs = [];
  matchRightToLeft.forEach((left, right) => {
    if (left !== -1) {
      pairs.push({ left, right, id: edgeId(left, right) });
    }
  });

  pairs.sort((a, b) => a.left - b.left);
  return { size: pairs.length, pairs };
}

export function getNeighbors(graph, leftVertices) {
  const neighbors = new Set();

  leftVertices.forEach((left) => {
    graph.adjacency[left]?.forEach((right) => {
      neighbors.add(right);
    });
  });

  return Array.from(neighbors).sort((a, b) => a - b);
}

export function checkHallViolation(graph, leftVertices) {
  const selected = Array.from(new Set(leftVertices)).sort((a, b) => a - b);
  const neighbors = getNeighbors(graph, selected);

  return {
    ok: selected.length > 0 && neighbors.length < selected.length,
    selected,
    neighbors,
  };
}

export function checkPerfectMatching(graph, selectedEdgeIds) {
  const selectedEdges = selectedEdgeIds
    .map((id) => graph.edgeById.get(id))
    .filter(Boolean);
  const lefts = new Set(selectedEdges.map((edge) => edge.left));
  const rights = new Set(selectedEdges.map((edge) => edge.right));

  if (selectedEdges.length !== graph.n) {
    return {
      ok: false,
      reason: `A perfect matching needs ${graph.n} edges.`,
    };
  }

  if (lefts.size !== graph.n || rights.size !== graph.n) {
    return {
      ok: false,
      reason: "Each vertex must be used exactly once.",
    };
  }

  return {
    ok: true,
    reason: "Perfect matching found.",
  };
}

export function formatVertexList(prefix, vertices) {
  if (vertices.length === 0) {
    return `${prefix} = { }`;
  }

  return `${prefix} = { ${vertices.map((vertex) => vertex + 1).join(", ")} }`;
}

export function edgeId(left, right) {
  return `L${left}-R${right}`;
}

function clampDensity(value) {
  const number = Number(value);
  if (Number.isNaN(number)) {
    return DEFAULT_DENSITY;
  }
  return Math.min(0.85, Math.max(0.1, number));
}

function addGuaranteedPerfectMatching(adjacencySets, n, rng) {
  const rightOrder = shuffled(range(n), rng);

  rightOrder.forEach((right, left) => {
    adjacencySets[left].add(right);
  });
}

function addGuaranteedHallBlock(adjacencySets, n, density, rng) {
  const subsetSize = randomInteger(2, n, rng);
  const neighborLimit = randomInteger(1, subsetSize - 1, rng);
  const blockedLeft = shuffled(range(n), rng).slice(0, subsetSize);
  const limitedRight = shuffled(range(n), rng).slice(0, neighborLimit);
  const outsideLeft = range(n).filter((left) => !blockedLeft.includes(left));

  blockedLeft.forEach((left) => {
    adjacencySets[left].add(sample(limitedRight, rng));
    limitedRight.forEach((right) => {
      if (rng() < Math.max(0.45, density)) {
        adjacencySets[left].add(right);
      }
    });
  });

  outsideLeft.forEach((left) => {
    adjacencySets[left].add(randomInteger(0, n - 1, rng));
    range(n).forEach((right) => {
      if (rng() < Math.min(0.88, density + 0.16)) {
        adjacencySets[left].add(right);
      }
    });
  });
}

function addRandomEdges(adjacencySets, n, density, rng) {
  range(n).forEach((left) => {
    range(n).forEach((right) => {
      if (rng() < density) {
        adjacencySets[left].add(right);
      }
    });
  });
}

function buildGraph(n, adjacencySets) {
  const adjacency = adjacencySets.map((set) => Array.from(set).sort((a, b) => a - b));
  const edges = [];
  const edgeById = new Map();

  adjacency.forEach((rights, left) => {
    rights.forEach((right) => {
      const edge = { left, right, id: edgeId(left, right) };
      edges.push(edge);
      edgeById.set(edge.id, edge);
    });
  });

  return { n, adjacency, edges, edgeById };
}

function tryAugment(left, seenRight, matchRightToLeft, adjacency) {
  for (const right of adjacency[left]) {
    if (seenRight[right]) {
      continue;
    }

    seenRight[right] = true;

    if (matchRightToLeft[right] === -1 || tryAugment(matchRightToLeft[right], seenRight, matchRightToLeft, adjacency)) {
      matchRightToLeft[right] = left;
      return true;
    }
  }

  return false;
}

function randomInteger(min, max, rng) {
  return min + Math.floor(rng() * (max - min + 1));
}

function sample(items, rng) {
  return items[Math.floor(rng() * items.length)];
}

function shuffled(items, rng) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function range(length) {
  return Array.from({ length }, (_, index) => index);
}
