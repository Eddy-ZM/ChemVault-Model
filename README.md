# ChemVault Molecule Studio

## ChemVault Molecule Studio

ChemVault Molecule Studio is the molecular modeling workspace for ChemVault. It provides a browser-based page for chemistry students, instructors, and researchers to search compounds, enter SMILES, inspect molecular properties, render 3D structures, export files, and load PDB protein structures.

Access path:

```text
/molecule
```

Local URL after starting the app:

```text
http://localhost:3000/molecule
```

### Features

- PubChem search by molecule name, CID, SMILES, or InChIKey
- SMILES input with quick atom, ring, and functional group controls
- 3D molecule rendering with 3Dmol.js
- Representation controls for ball-and-stick, stick, sphere, line, surface, and cartoon modes
- PNG screenshot export from the 3D viewer
- File import for `.mol`, `.sdf`, `.xyz`, `.pdb`, `.cif`, `.smi`, `.smiles`, and `.txt`
- File export for SMILES, Molfile, SDF, XYZ, PDB, and PNG
- Molecular property cards for formula, molecular weight, exact mass, LogP, TPSA, donors, acceptors, rings, heavy atoms, and charge
- PDB structure loading from RCSB PDB
- Optional RDKit backend for local 3D conformer generation and property calculation

### Local Development

Install dependencies:

```bash
npm install
```

Start the Next.js development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000/molecule
```

Run the production build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

### PubChem Search

Use the Molecule Search panel on `/molecule`.

Supported query examples:

- `water`
- `ethanol`
- `benzene`
- `caffeine`
- `aspirin`
- `2244`
- `CCO`

The app calls the same-origin chemistry API:

```text
GET /api/chem/pubchem/search?query=
```

On Cloudflare, these endpoints are served by Cloudflare Pages Functions. The route uses PubChem PUG-REST. No API key is required.

### SMILES Input

Use the 2D Sketch Area to paste or edit SMILES. Example inputs:

```text
CCO
c1ccccc1
CC(=O)OC1=CC=CC=C1C(=O)O
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

Click `Set SMILES` to update the current molecule, then click `Generate 3D Model` to request a 3D structure.

### 3D Model Generation

The frontend calls:

```text
POST /api/chem/generate-3d
```

Request body:

```json
{
  "smiles": "CCO"
}
```

Resolution order:

1. If `MOLECULE_API_URL` or `NEXT_PUBLIC_MOLECULE_API_URL` is configured, the route tries the RDKit backend.
2. If the RDKit backend is unavailable or not configured, it falls back to PubChem 3D SDF.
3. If PubChem has no 3D conformer, it falls back to PubChem 2D SDF when available.
4. If all sources fail, the page shows a user-facing error and does not crash.

RDKit is optional. The page remains usable without an RDKit backend.

### PDB Loading

Use the Protein / PDB panel on `/molecule`.

Examples:

```text
1CRN
4HHB
1BNA
```

The app calls:

```text
GET /api/chem/pdb/[id]
```

The route downloads structure data from RCSB PDB and attempts to fetch title, resolution, and experimental method. If metadata is unavailable, the viewer can still load the structure when the PDB file download succeeds.

### Optional RDKit Backend

The Python backend is optional and lives in:

```text
python-backend/
```

Run locally:

```bash
cd python-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then set:

```bash
MOLECULE_API_URL=http://localhost:8000
```

For hosted deployments, deploy the RDKit backend separately to Render, Railway, Fly.io, or a VPS. RDKit Python should not be deployed inside Cloudflare Pages or Cloudflare Workers.

### Environment Variables

See `.env.example`.

```bash
MOLECULE_API_URL=
NEXT_PUBLIC_MOLECULE_API_URL=
VITE_MOLECULE_API_URL=
```

Notes:

- `MOLECULE_API_URL` is the preferred server-side URL for the optional RDKit backend.
- `NEXT_PUBLIC_MOLECULE_API_URL` can be used when the deployment platform exposes only public build/runtime variables.
- `VITE_MOLECULE_API_URL` is reserved for a future Vite migration and is not required by the current Next.js app.
- If all values are empty, PubChem fallback still works.

## Deploy to Cloudflare

Cloudflare deployment is the primary deployment target for this project.

ChemVault Molecule Studio uses a static Next.js export for the website and Cloudflare Pages Functions for `/api/chem/*`. This keeps deployment simple while preserving PubChem search, property lookup, 3D SDF fallback, and PDB loading without requiring OpenNext or a Python RDKit backend.

Selected deployment approach:

- Scheme: Cloudflare Pages static deployment plus Pages Functions
- Static output directory: `out`
- Functions directory: `functions`
- API runtime: Cloudflare Pages Functions using standard `fetch`
- RDKit backend: optional external service only

Cloudflare Pages settings:

- Framework preset: `Next.js` or `None`
- Build command: `npm run build`
- Output directory: `out`
- Functions directory: `functions`
- Node.js version: `20`
- Root directory: repository root

Local Cloudflare preview:

```bash
npm run preview
```

This builds the static export and serves it through Wrangler Pages dev with the `functions/` API routes enabled.

Production deploy from local CLI:

```bash
npm run deploy
```

For Git-based Cloudflare Pages deploys, connect the GitHub repository and use the same build settings above.

Environment variables:

```bash
MOLECULE_API_URL=
NEXT_PUBLIC_MOLECULE_API_URL=
VITE_MOLECULE_API_URL=
```

All are optional.

- If `MOLECULE_API_URL` is empty, Cloudflare Pages Functions do not call an external RDKit service.
- Without RDKit, `Generate 3D Model` falls back to PubChem SDF.
- PubChem search, PubChem structure loading, RCSB PDB loading, and the 3D viewer work without RDKit.
- Deploy the optional RDKit Python backend separately to Render, Railway, Fly.io, or a VPS, then set `MOLECULE_API_URL` in Cloudflare Pages project settings.

### Cloudflare API Routes

Cloudflare Pages Functions provide these same-origin endpoints:

```text
GET  /api/chem/pubchem/search?query=
GET  /api/chem/pubchem/structure?cid=&format=sdf3d
POST /api/chem/generate-3d
POST /api/chem/properties
GET  /api/chem/pdb/[id]
```

The functions live in:

```text
functions/api/chem/
```

They do not use Node-only APIs such as `fs` or `path`.

## Custom Domain

Target domain:

```text
model.chemvault.science
```

Cloudflare setup:

1. Open the Cloudflare Pages project.
2. Go to `Custom domains`.
3. Select `Add custom domain`.
4. Enter `model.chemvault.science`.
5. Follow Cloudflare's DNS verification prompt.

If the `chemvault.science` zone is already managed in Cloudflare, Cloudflare Pages can usually bind the custom domain directly.

## Deploy to Vercel

Vercel remains an optional alternative for standard Next.js hosting. Cloudflare is the primary deployment target for this repository.

For the current Cloudflare-first layout, `/api/chem/*` is implemented in Cloudflare Pages Functions. If deploying to Vercel, either recreate equivalent Vercel route handlers or point the frontend at an external chemistry API.

Suggested Vercel settings for a static deployment:

- Framework Preset: `Next.js`
- Install Command: `npm install` or Vercel default
- Build Command: `npm run build`
- Output Directory: `out`
- Node.js Version: `20.x`
- Root Directory: repository root

### Common Issues

3D viewer stays on loading:

- Check that the browser can load the 3Dmol.js CDN script.
- Check the browser console for blocked network requests.

RDKit generation fails:

- Confirm `MOLECULE_API_URL` points to the Python backend.
- If no backend is configured, this is expected; PubChem fallback is used.

PubChem has no 3D conformer:

- The app falls back to 2D SDF when available.
- The model may display as a flat structure.

PDB metadata is missing:

- The PDB file can still render when structure download succeeds.
- Missing title, resolution, or method fields are shown as unavailable.

Cloudflare Pages build confusion:

- Use Next.js deployment guidance, not Vite `dist` output.
- Use OpenNext/Cloudflare for dynamic Next.js API routes, or move `/api/chem/*` to Workers/external services.

### API Endpoints

- `GET /api/chem/pubchem/search?query=`
- `GET /api/chem/pubchem/structure?cid=&format=sdf3d`
- `POST /api/chem/generate-3d`
- `POST /api/chem/properties`
- `GET /api/chem/pdb/[id]`

### License Notes

- Next.js, React, Tailwind CSS, Vitest: open-source packages distributed by their upstream projects
- 3Dmol.js: loaded from its public distribution endpoint
- PubChem and RCSB PDB: public web services, no API key required
- RDKit, FastAPI, and Uvicorn: optional Python backend dependencies in `python-backend/requirements.txt`

### Disclaimer

ChemVault Molecule Studio is an independent educational chemistry tool. It is not affiliated with MolView, PubChem, or RCSB PDB.
