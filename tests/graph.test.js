import test from "node:test";
import assert from "node:assert/strict";
import {
  checkHallViolation,
  checkPerfectMatching,
  createGraph,
  createSeededRng,
  findMaximumMatching,
  generateGraph,
  setGraphEdge,
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
  const graph = createGraph(3, [[0], [0], [1, 2]]);

  assert.deepEqual(checkHallViolation(graph, [0, 1]), {
    ok: true,
    side: "left",
    selected: [0, 1],
    neighbors: [0],
  });

  assert.deepEqual(checkHallViolation(graph, [2]), {
    ok: false,
    side: "left",
    selected: [2],
    neighbors: [1, 2],
  });
});

test("Hall violation checker also works from the right side", () => {
  const graph = createGraph(3, [[0], [0], [1, 2]]);

  assert.deepEqual(checkHallViolation(graph, [1, 2], "right"), {
    ok: true,
    side: "right",
    selected: [1, 2],
    neighbors: [2],
  });

  assert.deepEqual(checkHallViolation(graph, [0], "right"), {
    ok: false,
    side: "right",
    selected: [0],
    neighbors: [0, 1],
  });
});

test("setGraphEdge adds and removes edges while rebuilding lookup data", () => {
  let graph = createGraph(3, [[], [], []]);

  graph = setGraphEdge(graph, 0, 2, true);
  assert.deepEqual(graph.adjacency, [[2], [], []]);
  assert.equal(graph.edgeById.has("L0-R2"), true);

  graph = setGraphEdge(graph, 0, 2, false);
  assert.deepEqual(graph.adjacency, [[], [], []]);
  assert.equal(graph.edgeById.has("L0-R2"), false);
});
