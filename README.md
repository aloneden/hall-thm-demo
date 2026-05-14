# Hall's Theorem Lab

A dependency-free classroom web app for practicing Hall's marriage theorem on random balanced bipartite graphs.

Students can either:

- tap edges to certify a perfect matching, or
- tap vertices on either side to certify a Hall violation, with the neighbor set highlighted on the opposite side.

They can also switch to edit mode to add or remove edges from the generated graph.

## Run Locally

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

For phones on the same Wi-Fi, use the computer's local network address, for example:

```text
http://YOUR-LAPTOP-IP:4173
```

## Teacher Parameters

The controls in the page set the graph size and edge density. You can also preload them in the URL:

```text
http://localhost:4173/?n=7&density=45
```

Supported values:

- `n`: vertices per side, from `2` to `12`
- `density`: edge density as `45` or `0.45`

## Deploy Online

This app is static, so it can be hosted on GitHub Pages, Netlify, Vercel, or any plain web server. For GitHub Pages, enable Pages for the repository's `main` branch and root folder.

## Test

```bash
npm test
```
