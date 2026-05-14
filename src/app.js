import {
  checkHallViolation,
  checkPerfectMatching,
  createSeededRng,
  findMaximumMatching,
  formatVertexList,
  generateGraph,
  getNeighbors,
} from "./graph.js";

const svg = document.querySelector("#graph-svg");
const controls = document.querySelector("#controls");
const nodeCountInput = document.querySelector("#node-count");
const densityInput = document.querySelector("#density");
const densityLabel = document.querySelector("#density-label");
const graphTitle = document.querySelector("#graph-title");
const edgeCount = document.querySelector("#edge-count");
const subsetCount = document.querySelector("#subset-count");
const neighborCount = document.querySelector("#neighbor-count");
const matchingReadout = document.querySelector("#matching-readout");
const hallReadout = document.querySelector("#hall-readout");
const subsetSet = document.querySelector("#subset-set");
const neighborSet = document.querySelector("#neighbor-set");
const resultTitle = document.querySelector("#result-title");
const resultBody = document.querySelector("#result-body");
const generateButton = document.querySelector("#generate-button");
const clearAllButton = document.querySelector("#clear-all-button");
const clearEdgesButton = document.querySelector("#clear-edges-button");
const clearSubsetButton = document.querySelector("#clear-subset-button");
const checkMatchingButton = document.querySelector("#check-matching-button");
const checkHallButton = document.querySelector("#check-hall-button");

let graph;
let selectedEdges = new Set();
let selectedLeft = new Set();
let lastSeed = "";

initFromUrl();
wireEvents();
newGraph();

function initFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const n = params.get("n");
  const density = params.get("density");
  const seed = params.get("seed");

  if (n) {
    nodeCountInput.value = n;
  }

  if (density) {
    const parsedDensity = Number(density);
    densityInput.value = parsedDensity <= 1
      ? Math.round(parsedDensity * 100)
      : Math.round(parsedDensity);
  }

  if (seed) {
    lastSeed = seed;
  }

  updateDensityLabel();
}

function wireEvents() {
  controls.addEventListener("submit", (event) => {
    event.preventDefault();
    newGraph();
  });

  densityInput.addEventListener("input", updateDensityLabel);

  clearAllButton.addEventListener("click", () => {
    clearSelections();
    setResult("Ready", "Selections cleared.", "neutral");
  });

  clearEdgesButton.addEventListener("click", () => {
    selectedEdges = new Set();
    setResult("Ready", "Edge selection cleared.", "neutral");
    render();
  });

  clearSubsetButton.addEventListener("click", () => {
    selectedLeft = new Set();
    setResult("Ready", "Subset cleared.", "neutral");
    render();
  });

  checkMatchingButton.addEventListener("click", () => {
    const result = checkPerfectMatching(graph, Array.from(selectedEdges));
    if (result.ok) {
      setResult("Correct", result.reason, "success");
      return;
    }

    const maximum = findMaximumMatching(graph);
    const suffix = maximum.size === graph.n
      ? "This graph does have a perfect matching."
      : `This graph has no perfect matching; the largest matching has ${maximum.size} edges.`;
    setResult("Not yet", `${result.reason} ${suffix}`, "warn");
  });

  checkHallButton.addEventListener("click", () => {
    const result = checkHallViolation(graph, Array.from(selectedLeft));
    if (result.ok) {
      setResult("Correct", `Hall fails here: |S| = ${result.selected.length} and |N(S)| = ${result.neighbors.length}.`, "success");
      return;
    }

    const message = result.selected.length === 0
      ? "Select at least one left vertex."
      : `This subset has |S| = ${result.selected.length} and |N(S)| = ${result.neighbors.length}.`;
    setResult("Not yet", message, "warn");
  });
}

function newGraph() {
  const n = clampInput(nodeCountInput, 2, 12);
  const density = Number(densityInput.value) / 100;
  const seed = lastSeed || `${Date.now()}-${Math.random()}`;
  lastSeed = "";
  const rng = createSeededRng(seed);

  graph = generateGraph({ n, density, rng });
  selectedEdges = new Set();
  selectedLeft = new Set();

  generateButton.blur();
  setResult("Ready", "Try a perfect matching or a Hall subset.", "neutral");
  render();
}

function render() {
  svg.replaceChildren();

  const layout = makeLayout(graph.n);
  const selectedNeighbors = getNeighbors(graph, Array.from(selectedLeft));
  const selectedNeighborSet = new Set(selectedNeighbors);
  const matchedVertices = getMatchedVertices();

  drawEdges(layout, selectedNeighborSet);
  drawVertices(layout, selectedNeighborSet, matchedVertices);
  updateReadouts(selectedNeighbors);
}

function drawEdges(layout, selectedNeighborSet) {
  const edgeLayer = makeSvgElement("g", { class: "edge-layer" });
  svg.append(edgeLayer);

  graph.edges.forEach((edge) => {
    const left = layout.left[edge.left];
    const right = layout.right[edge.right];
    const isSelected = selectedEdges.has(edge.id);
    const touchesSubset = selectedLeft.has(edge.left);
    const isSubsetNeighbor = selectedNeighborSet.has(edge.right);
    const group = makeSvgElement("g", { class: "edge-group" });
    const lineClass = [
      "edge-line",
      isSelected ? "is-selected" : "",
      touchesSubset && isSubsetNeighbor ? "is-neighbor-edge" : "",
      selectedLeft.size > 0 && !touchesSubset ? "is-muted" : "",
    ].filter(Boolean).join(" ");

    const visible = makeSvgElement("line", {
      class: lineClass,
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
    });

    const hit = makeSvgElement("line", {
      class: "edge-hit",
      x1: left.x,
      y1: left.y,
      x2: right.x,
      y2: right.y,
      tabindex: 0,
      role: "button",
      "aria-label": `Edge ${edge.left + 1} to ${edge.right + 1}`,
    });

    hit.addEventListener("click", () => toggleEdge(edge.id));
    hit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleEdge(edge.id);
      }
    });

    group.append(visible, hit);
    edgeLayer.append(group);
  });
}

function drawVertices(layout, selectedNeighborSet, matchedVertices) {
  const vertexLayer = makeSvgElement("g", { class: "vertex-layer" });
  svg.append(vertexLayer);

  layout.left.forEach((point, index) => {
    const selected = selectedLeft.has(index);
    const matched = matchedVertices.left.has(index);
    const group = makeVertex(point, `L${index + 1}`, [
      "left-vertex",
      selected ? "is-subset" : "",
      matched ? "is-matched" : "",
    ], true);

    group.addEventListener("click", () => toggleLeft(index));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleLeft(index);
      }
    });
    vertexLayer.append(group);
  });

  layout.right.forEach((point, index) => {
    const neighbor = selectedNeighborSet.has(index);
    const matched = matchedVertices.right.has(index);
    const group = makeVertex(point, `R${index + 1}`, [
      "right-vertex",
      neighbor ? "is-neighbor" : "",
      matched ? "is-matched" : "",
    ], false);
    vertexLayer.append(group);
  });
}

function makeVertex(point, label, classes, interactive) {
  const group = makeSvgElement("g", {
    class: ["vertex", ...classes].filter(Boolean).join(" "),
    transform: `translate(${point.x} ${point.y})`,
  });

  if (interactive) {
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${label} vertex`);
  }

  const circle = makeSvgElement("circle", { r: 28 });
  const text = makeSvgElement("text", {
    "text-anchor": "middle",
    "dominant-baseline": "central",
  });
  text.textContent = label;

  group.append(circle, text);
  return group;
}

function updateReadouts(selectedNeighbors) {
  graphTitle.textContent = `${graph.n} by ${graph.n} graph`;
  edgeCount.textContent = `${selectedEdges.size} / ${graph.n}`;
  subsetCount.textContent = `${selectedLeft.size} ${pluralize("vertex", selectedLeft.size)}`;
  neighborCount.textContent = `${selectedNeighbors.length} ${pluralize("vertex", selectedNeighbors.length)}`;
  matchingReadout.textContent = `${selectedEdges.size} ${pluralize("edge", selectedEdges.size)} selected.`;
  hallReadout.textContent = `|S| = ${selectedLeft.size}, |N(S)| = ${selectedNeighbors.length}`;
  subsetSet.textContent = formatVertexList("S", Array.from(selectedLeft).sort((a, b) => a - b));
  neighborSet.textContent = formatVertexList("N(S)", selectedNeighbors);
}

function toggleEdge(edgeId) {
  if (selectedEdges.has(edgeId)) {
    selectedEdges.delete(edgeId);
  } else {
    selectedEdges.add(edgeId);
  }

  setResult("Ready", "Selection updated.", "neutral");
  render();
}

function toggleLeft(index) {
  if (selectedLeft.has(index)) {
    selectedLeft.delete(index);
  } else {
    selectedLeft.add(index);
  }

  setResult("Ready", "Subset updated.", "neutral");
  render();
}

function clearSelections() {
  selectedEdges = new Set();
  selectedLeft = new Set();
  render();
}

function getMatchedVertices() {
  const left = new Set();
  const right = new Set();

  selectedEdges.forEach((edgeId) => {
    const edge = graph.edgeById.get(edgeId);
    if (edge) {
      left.add(edge.left);
      right.add(edge.right);
    }
  });

  return { left, right };
}

function makeLayout(n) {
  const top = 72;
  const bottom = 548;
  const span = n === 1 ? 0 : bottom - top;

  return {
    left: Array.from({ length: n }, (_, index) => ({
      x: 150,
      y: n === 1 ? 310 : top + (span * index) / (n - 1),
    })),
    right: Array.from({ length: n }, (_, index) => ({
      x: 750,
      y: n === 1 ? 310 : top + (span * index) / (n - 1),
    })),
  };
}

function makeSvgElement(tag, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  return element;
}

function setResult(title, body, tone) {
  resultTitle.textContent = title;
  resultBody.textContent = body;
  document.body.dataset.tone = tone;
}

function updateDensityLabel() {
  densityLabel.textContent = `${densityInput.value}%`;
}

function clampInput(input, min, max) {
  const parsed = Number.parseInt(input.value, 10);
  const next = Number.isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
  input.value = String(next);
  return next;
}

function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}
