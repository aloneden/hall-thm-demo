import test from "node:test";
import assert from "node:assert/strict";
import {
  checkHallViolation,
  checkPerfectMatching,
  createSeededRng,
  findMaximumMatching,
  generateGraph,
} from "../src/graph.js";

test("matchable generator always includes a perfect matching", () => {
  for (let i = 0; i < 120; i += 1) {
    const graph = generateGraph({
      n: 7,
      density: 0.32,
      target: "matchable",
      rng: createSeededRng(`matchable-${i}`),
    });
    const matching = findMaximumMatching(graph);
    const check = checkPerfectMatching(graph, matching.pairs.map((pair) => pair.id));

    assert.equal(matching.size, graph.n);
    assert.equal(check.ok, true);
  }
});

test("blocked generator creates a graph with no perfect matching", () => {
  for (let i = 0; i < 120; i += 1) {
    const graph = generateGraph({
      n: 8,
      density: 0.45,
      target: "blocked",
      rng: createSeededRng(`blocked-${i}`),
    });
    const matching = findMaximumMatching(graph);

    assert.ok(matching.size < graph.n);
  }
});

test("Hall violation checker compares selected side against its neighbor set", () => {
  const graph = {
    n: 3,
    adjacency: [[0], [0], [1, 2]],
    edges: [],
    edgeById: new Map(),
  };

  assert.deepEqual(checkHallViolation(graph, [0, 1]), {
    ok: true,
    selected: [0, 1],
    neighbors: [0],
  });

  assert.deepEqual(checkHallViolation(graph, [2]), {
    ok: false,
    selected: [2],
    neighbors: [1, 2],
  });
});
