import {
  checkHallViolation,
  checkPerfectMatching,
  createSeededRng,
  findMaximumMatching,
  formatVertexList,
  generateGraph,
  getNeighbors,
  setGraphEdge,
  toggleGraphEdge,
} from "./graph.js";

const svg = document.querySelector("#graph-svg");
const controls = document.querySelector("#controls");
const nodeCountInput = document.querySelector("#node-count");
const densityInput = document.querySelector("#density");
const densityLabel = document.querySelector("#density-label");
const graphTitle = document.querySelector("#graph-title");
const graphEdgeCount = document.querySelector("#graph-edge-count");
const edgeCount = document.querySelector("#edge-count");
const subsetCount = document.querySelector("#subset-count");
const neighborCount = document.querySelector("#neighbor-count");
const matchingReadout = document.querySelector("#matching-readout");
const hallReadout = document.querySelector("#hall-readout");
const subsetSet = document.querySelector("#subset-set");
const neighborSet = document.querySelector("#neighbor-set");
const resultTitle = document.querySelector("#result-title");
const resultBody = document.querySelector("#result-body");
const editReadout = document.querySelector("#edit-readout");
const generateButton = document.querySelector("#generate-button");
const clearAllButton = document.querySelector("#clear-all-button");
const clearEdgesButton = document.querySelector("#clear-edges-button");
const clearSubsetButton = document.querySelector("#clear-subset-button");
const checkMatchingButton = document.querySelector("#check-matching-button");
const checkHallButton = document.querySelector("#check-hall-button");
const solveModeButton = document.querySelector("#solve-mode-button");
const editModeButton = document.querySelector("#edit-mode-button");
const editModePanelButton = document.querySelector("#edit-mode-panel-button");
const cancelEditButton = document.querySelector("#cancel-edit-button");
const hallLeftButton = document.querySelector("#hall-left-button");
const hallRightButton = document.querySelector("#hall-right-button");

let graph;
let selectedEdges = new Set();
let selectedHall = {
  left: new Set(),
  right: new Set(),
};
let hallSide = "left";
let interactionMode = "solve";
let editStart = null;
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
    selectedHall[hallSide] = new Set();
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
    const selected = Array.from(selectedHall[hallSide]);
    const result = checkHallViolation(graph, selected, hallSide);
    if (result.ok) {
      const shore = result.side === "left" ? "left" : "right";
      setResult("Correct", `Hall fails on the ${shore}: |S| = ${result.selected.length} and |N(S)| = ${result.neighbors.length}.`, "success");
      return;
    }

    const message = result.selected.length === 0
      ? `Select at least one ${hallSide} vertex.`
      : `This subset has |S| = ${result.selected.length} and |N(S)| = ${result.neighbors.length}.`;
    setResult("Not yet", message, "warn");
  });

  solveModeButton.addEventListener("click", () => setInteractionMode("solve"));
  editModeButton.addEventListener("click", () => setInteractionMode("edit"));
  editModePanelButton.addEventListener("click", () => setInteractionMode(interactionMode === "edit" ? "solve" : "edit"));
  cancelEditButton.addEventListener("click", () => {
    editStart = null;
    setResult("Ready", "Endpoint cleared.", "neutral");
    render();
  });

  hallLeftButton.addEventListener("click", () => setHallSide("left"));
  hallRightButton.addEventListener("click", () => setHallSide("right"));
}

function newGraph() {
  const n = clampInput(nodeCountInput, 2, 12);
  const density = Number(densityInput.value) / 100;
  const seed = lastSeed || `${Date.now()}-${Math.random()}`;
  lastSeed = "";
  const rng = createSeededRng(seed);

  graph = generateGraph({ n, density, rng });
  selectedEdges = new Set();
  selectedHall = {
    left: new Set(),
    right: new Set(),
  };
  editStart = null;

  generateButton.blur();
  setInteractionMode("solve", false);
  setResult("Ready", "Try a perfect matching or a Hall subset.", "neutral");
  render();
}

function render() {
  svg.replaceChildren();

  const layout = makeLayout(graph.n);
  const selectedSubset = selectedHall[hallSide];
  const selectedNeighbors = getNeighbors(graph, Array.from(selectedSubset), hallSide);
  const selectedNeighborSet = new Set(selectedNeighbors);
  const matchedVertices = getMatchedVertices();

  drawEdges(layout, selectedSubset, selectedNeighborSet);
  drawVertices(layout, selectedSubset, selectedNeighborSet, matchedVertices);
  updateReadouts(selectedNeighbors);
  updateButtons();
}

function drawEdges(layout, selectedSubset, selectedNeighborSet) {
  const edgeLayer = makeSvgElement("g", { class: "edge-layer" });
  svg.append(edgeLayer);

  graph.edges.forEach((edge) => {
    const left = layout.left[edge.left];
    const right = layout.right[edge.right];
    const isSelected = selectedEdges.has(edge.id);
    const touchesSubset = hallSide === "left"
      ? selectedSubset.has(edge.left)
      : selectedSubset.has(edge.right);
    const touchesNeighbor = hallSide === "left"
      ? selectedNeighborSet.has(edge.right)
      : selectedNeighborSet.has(edge.left);
    const group = makeSvgElement("g", { class: "edge-group" });
    const lineClass = [
      "edge-line",
      isSelected ? "is-selected" : "",
      touchesSubset && touchesNeighbor ? "is-neighbor-edge" : "",
      selectedSubset.size > 0 && !touchesSubset ? "is-muted" : "",
      interactionMode === "edit" ? "is-editable" : "",
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
      "aria-label": `${interactionMode === "edit" ? "Remove" : "Select"} edge ${edge.left + 1} to ${edge.right + 1}`,
    });

    hit.addEventListener("click", () => handleEdgeClick(edge));
    hit.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleEdgeClick(edge);
      }
    });

    group.append(visible, hit);
    edgeLayer.append(group);
  });
}

function drawVertices(layout, selectedSubset, selectedNeighborSet, matchedVertices) {
  const vertexLayer = makeSvgElement("g", { class: "vertex-layer" });
  svg.append(vertexLayer);

  layout.left.forEach((point, index) => {
    const selected = hallSide === "left" && selectedSubset.has(index);
    const neighbor = hallSide === "right" && selectedNeighborSet.has(index);
    const matched = matchedVertices.left.has(index);
    const interactive = interactionMode === "edit" || hallSide === "left";
    const group = makeVertex(point, `L${index + 1}`, [
      "left-vertex",
      selected ? "is-subset" : "",
      neighbor ? "is-neighbor" : "",
      matched ? "is-matched" : "",
      isEditStart("left", index) ? "is-edit-source" : "",
      interactive ? "is-interactive" : "",
    ], interactive);

    wireVertexEvents(group, "left", index);
    vertexLayer.append(group);
  });

  layout.right.forEach((point, index) => {
    const selected = hallSide === "right" && selectedSubset.has(index);
    const neighbor = hallSide === "left" && selectedNeighborSet.has(index);
    const matched = matchedVertices.right.has(index);
    const interactive = interactionMode === "edit" || hallSide === "right";
    const group = makeVertex(point, `R${index + 1}`, [
      "right-vertex",
      selected ? "is-subset" : "",
      neighbor ? "is-neighbor" : "",
      matched ? "is-matched" : "",
      isEditStart("right", index) ? "is-edit-source" : "",
      interactive ? "is-interactive" : "",
    ], interactive);

    wireVertexEvents(group, "right", index);
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

function wireVertexEvents(group, side, index) {
  group.addEventListener("click", () => handleVertexClick(side, index));
  group.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleVertexClick(side, index);
    }
  });
}

function updateReadouts(selectedNeighbors) {
  const selectedSubset = selectedHall[hallSide];
  const shoreLabel = hallSide === "left" ? "left" : "right";

  graphTitle.textContent = `${graph.n} by ${graph.n} graph`;
  graphEdgeCount.textContent = `${graph.edges.length}`;
  edgeCount.textContent = `${selectedEdges.size} / ${graph.n}`;
  subsetCount.textContent = `${selectedSubset.size} ${pluralize("vertex", selectedSubset.size)}`;
  neighborCount.textContent = `${selectedNeighbors.length} ${pluralize("vertex", selectedNeighbors.length)}`;
  matchingReadout.textContent = `${selectedEdges.size} ${pluralize("edge", selectedEdges.size)} selected.`;
  hallReadout.textContent = `${shoreLabel} side: |S| = ${selectedSubset.size}, |N(S)| = ${selectedNeighbors.length}`;
  subsetSet.textContent = formatVertexList("S", Array.from(selectedSubset).sort((a, b) => a - b));
  neighborSet.textContent = formatVertexList("N(S)", selectedNeighbors);
  editReadout.textContent = makeEditReadout();
}

function updateButtons() {
  solveModeButton.setAttribute("aria-pressed", String(interactionMode === "solve"));
  editModeButton.setAttribute("aria-pressed", String(interactionMode === "edit"));
  hallLeftButton.setAttribute("aria-pressed", String(hallSide === "left"));
  hallRightButton.setAttribute("aria-pressed", String(hallSide === "right"));
  editModePanelButton.textContent = interactionMode === "edit" ? "Stop editing" : "Edit graph";
  cancelEditButton.disabled = editStart === null;
}

function handleEdgeClick(edge) {
  if (interactionMode === "edit") {
    graph = setGraphEdge(graph, edge.left, edge.right, false);
    selectedEdges.delete(edge.id);
    editStart = null;
    setResult("Graph edited", `Removed edge L${edge.left + 1}-R${edge.right + 1}.`, "neutral");
    render();
    return;
  }

  toggleMatchingEdge(edge.id);
}

function handleVertexClick(side, index) {
  if (interactionMode === "edit") {
    handleEditVertex(side, index);
    return;
  }

  if (side !== hallSide) {
    return;
  }

  toggleHallVertex(side, index);
}

function handleEditVertex(side, index) {
  if (editStart === null || editStart.side === side) {
    editStart = { side, index };
    setResult("Editing graph", `${vertexName(side, index)} selected.`, "neutral");
    render();
    return;
  }

  const left = side === "left" ? index : editStart.index;
  const right = side === "right" ? index : editStart.index;
  const wasPresent = graph.edgeById.has(`L${left}-R${right}`);
  graph = toggleGraphEdge(graph, left, right);
  selectedEdges = new Set(Array.from(selectedEdges).filter((edgeId) => graph.edgeById.has(edgeId)));
  editStart = null;
  setResult("Graph edited", `${wasPresent ? "Removed" : "Added"} edge L${left + 1}-R${right + 1}.`, "neutral");
  render();
}

function toggleMatchingEdge(edgeId) {
  if (selectedEdges.has(edgeId)) {
    selectedEdges.delete(edgeId);
  } else {
    selectedEdges.add(edgeId);
  }

  setResult("Ready", "Selection updated.", "neutral");
  render();
}

function toggleHallVertex(side, index) {
  if (selectedHall[side].has(index)) {
    selectedHall[side].delete(index);
  } else {
    selectedHall[side].add(index);
  }

  setResult("Ready", "Subset updated.", "neutral");
  render();
}

function setInteractionMode(mode, shouldRender = true) {
  interactionMode = mode;
  editStart = null;

  if (mode === "edit") {
    setResult("Editing graph", "Choose endpoints or tap an edge.", "neutral");
  }

  if (shouldRender) {
    render();
  }
}

function setHallSide(side) {
  hallSide = side;
  editStart = null;
  setInteractionMode("solve", false);
  setResult("Ready", `${side === "left" ? "Left" : "Right"} side selected for Hall.`, "neutral");
  render();
}

function clearSelections() {
  selectedEdges = new Set();
  selectedHall = {
    left: new Set(),
    right: new Set(),
  };
  editStart = null;
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

function makeEditReadout() {
  if (interactionMode !== "edit") {
    return "Mode: solve";
  }

  if (editStart === null) {
    return "Mode: edit, no endpoint selected";
  }

  return `Mode: edit, endpoint ${vertexName(editStart.side, editStart.index)}`;
}

function isEditStart(side, index) {
  return editStart?.side === side && editStart.index === index;
}

function vertexName(side, index) {
  return `${side === "left" ? "L" : "R"}${index + 1}`;
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
