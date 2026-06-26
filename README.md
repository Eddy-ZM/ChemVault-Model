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

- Product-level workflow tabs for Search, SMILES, Draw, Upload, and PDB
- PubChem search by molecule name or CID
- Dedicated SMILES input with load, clear, copy, and example controls
- Draw workspace with drawing toolbar, common fragments, and periodic table picker
- Dedicated Upload tab for structure files
- 3D molecule rendering with 3Dmol.js
- Representation controls for ball-and-stick, stick, sphere, line, surface, and cartoon modes
- PNG screenshot export from the 3D viewer
- File import for `.mol`, `.sdf`, `.xyz`, `.pdb`, `.cif`, `.smi`, `.smiles`, and `.txt`
- File export for SMILES, Molfile, SDF, XYZ, PDB, and PNG
- Molecular property cards for formula, molecular weight, exact mass, LogP, TPSA, donors, acceptors, rings, heavy atoms, and charge
- PDB structure loading from RCSB PDB
- Optional RDKit backend for local 3D conformer generation and property calculation

## Molecule Studio Workflows

The `/molecule` page is organised as a focused modeling workbench. Users start from one workflow instead of seeing every tool at once.

1. Search by name or PubChem CID

Use the `Search` tab to query PubChem with examples such as `caffeine`, `aspirin`, `benzene`, or CID `2244`. Search results load into the shared 3D viewer and property panel.

2. Enter SMILES

Use the `SMILES` tab to paste or type strings such as `CCO` or `c1ccccc1`. The tab has dedicated `Load SMILES`, `Clear`, and `Copy SMILES` controls.

3. Draw molecule

Use the `Draw` tab for the 2D drawing workflow. It includes a lightweight SVG sketcher for placing atoms, single bonds, double bonds, triple bonds, six-member rings, and aromatic rings. The `Open Periodic Table` modal includes all 118 elements and lets users select or replace the active atom. The sketcher generates basic SMILES for the existing 3D generation workflow; complex fragment editing can still be enhanced later with Ketcher, Kekule.js, or RDKit.js.

4. Upload structure file

Use the `Upload` tab to import `.mol`, `.sdf`, `.xyz`, `.pdb`, `.cif`, `.smi`, `.smiles`, or `.txt` files. File upload is no longer placed at the bottom of the page. SMILES text files are parsed from the first non-empty line.

5. Load PDB structure

Use the `PDB` tab for protein and nucleic acid structures such as `1CRN`, `4HHB`, and `1BNA`. PDB metadata is displayed when RCSB provides it, and missing metadata does not block structure rendering.

After any workflow loads a structure, the result appears in the shared result workspace:

- `3D Viewer`
- `Structure Details`
- `Display Controls`
- `Export Actions`

Export controls appear in the result workspace after a molecule or structure is loaded. Display controls are located near the 3D viewer and include representation mode, background, hydrogen visibility, atom labels, reset view, and PNG download.

## Draw Molecule Workflow

The `Draw` tab is implemented with a ChemVault custom SVG sketcher rather than a third-party editor. This keeps the Cloudflare static export stable and avoids browser-only package SSR issues. No Ketcher, Kekule.js, or RDKit.js sketcher dependency is currently bundled.

Supported draw workflow:

- Click blank canvas to place the active element; carbon is the default.
- Drag from an atom to create a new atom and bond.
- Select single, double, triple, aromatic, wedge, or dash bond tools; wedge and dash export as single bonds in generated SMILES and MOL fallback.
- Click an existing bond to cycle bond order, or apply the active bond tool.
- Select common elements from the element picker; double-click an element to lock atom placement mode.
- Open the full 118-element periodic table and search by symbol, name, or atomic number.
- Place ring templates including cyclopropane, cyclobutane, cyclopentane, cyclohexane, benzene, pyridine, furan, and thiophene.
- Attach basic functional groups including OH, NH2, COOH, CHO, NO2, OMe, acetyl, and phenyl.
- Generate SMILES for acyclic sketches and simple standalone rings, then send the result to the existing 3D viewer. Complex fused or heavily substituted cyclic systems may require the Search or SMILES workflow until a full chemical layout engine is added.

License note: no new third-party sketcher library was added for this workflow. If Ketcher, Kekule.js, or RDKit.js is added later, its license must be listed here before deployment.

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

### PubChem Search

Use the `Search` tab on `/molecule`.

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

Use the `SMILES` tab to paste or edit SMILES. Example inputs:

```text
CCO
c1ccccc1
CC(=O)OC1=CC=CC=C1C(=O)O
CN1C=NC2=C1C(=O)N(C(=O)N2C)C
```

Click `Load SMILES` to request a 3D structure. If the optional RDKit backend is unavailable, the Cloudflare function falls back to PubChem SDF.

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

Use the `PDB` tab on `/molecule`.

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
AUTH_SECRET=
AUTH_URL=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

Notes:

- `MOLECULE_API_URL` is the preferred server-side URL for the optional RDKit backend.
- `NEXT_PUBLIC_MOLECULE_API_URL` can be used when the deployment platform exposes only public build/runtime variables.
- `VITE_MOLECULE_API_URL` is reserved for a future Vite migration and is not required by the current Next.js app.
- `AUTH_*` values are reserved for a future production authentication backend. They are optional for the current Cloudflare static deployment.
- If all values are empty, PubChem fallback still works.

## Authentication

Authentication is currently optional. Users who are not signed in can still use the full Molecule Studio workflow:

- Search
- SMILES input
- Draw
- Upload
- PDB loading
- 3D viewer
- Export actions

The top-right header includes a `Sign in` entry. After signing in, the header shows a circular initials avatar, user name or email, and a menu with:

- `Profile`
- `My Molecules`
- `Settings`
- `Sign out`

Current implementation:

- Uses a Cloudflare-compatible client-side auth shell.
- Stores only a local demo display profile in browser `localStorage`.
- Does not store passwords.
- Does not unlock paid/server-side features.
- Does not require any OAuth environment variables to build.
- Leaves Molecule Studio public and fully usable without login.

Placeholder pages:

- `/login`
- `/profile`
- `/molecules`
- `/settings`

Future production auth should be connected through ChemVault-user, preferably using an OAuth/token handoff flow or an Auth.js-compatible backend that runs outside the static export path. Because this repository currently uses `output: export` plus Cloudflare Pages Functions, standard NextAuth/Auth.js API routes are not enabled in this phase. If Auth.js is added later, deploy it through a Cloudflare-compatible server runtime or external auth service and keep secrets server-side only.

Reserved environment variables:

```bash
AUTH_SECRET=
AUTH_URL=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
```

Do not commit real secrets. OAuth provider secrets must never be exposed to client code.

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

### License

This repository is source-available but not open source. Public visibility is
for review and reference only; no rights are granted to use, copy, modify,
distribute, host, deploy, or create derivative works without prior written
permission from Ziwen Mu or the repository owner.

See [LICENSE](./LICENSE). All rights reserved.

### Third-Party License Notes

- Next.js, React, and Tailwind CSS: open-source packages distributed by their upstream projects
- 3Dmol.js: loaded from its public distribution endpoint
- PubChem and RCSB PDB: public web services, no API key required
- RDKit, FastAPI, and Uvicorn: optional Python backend dependencies in `python-backend/requirements.txt`

### Disclaimer

ChemVault Molecule Studio is an independent educational chemistry tool. It is not affiliated with MolView, PubChem, or RCSB PDB.
