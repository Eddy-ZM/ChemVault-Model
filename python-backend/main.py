from __future__ import annotations

import json
import math
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from rdkit import Chem
from rdkit.Chem import AllChem, Descriptors

app = FastAPI(title='ChemVault Molecule Backend')

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SmilesPayload(BaseModel):
    smiles: str


class QuantumPayload(BaseModel):
    moleculeName: str | None = None
    structureData: str
    format: str = 'xyz'
    method: str = 'gfn2-xTB'
    charge: int = 0
    multiplicity: int = 1


@app.get('/health')
def health() -> dict[str, str]:
    return {'status': 'ok'}


@app.post('/generate-3d')
def generate(payload: SmilesPayload):
    mol = Chem.MolFromSmiles(payload.smiles)
    if mol is None:
        return {
            'success': False,
            'format': 'sdf',
            'data': '',
            'optimized': False,
            'method': 'RDKit',
            'error': 'Invalid smiles'
        }

    mol = Chem.AddHs(mol)
    code = AllChem.EmbedMolecule(mol, randomSeed=0x123)
    if code != 0:
        return {
            'success': False,
            'format': 'sdf',
            'data': '',
            'optimized': False,
            'method': 'RDKit',
            'error': 'Failed to embed conformer'
        }

    uff_result = AllChem.UFFOptimizeMolecule(mol)
    optimized = uff_result == 0
    sdf = Chem.MolToMolBlock(mol)

    return {
        'success': True,
        'format': 'sdf',
        'data': sdf,
        'optimized': bool(optimized),
        'method': 'RDKit UFF'
    }


@app.post('/properties')
def properties(payload: SmilesPayload):
    mol = Chem.MolFromSmiles(payload.smiles)
    if mol is None:
        return {
            'error': 'Invalid smiles'
        }

    heavy_atom_count = mol.GetNumHeavyAtoms()
    ring_count = Chem.rdMolDescriptors.CalcNumRings(mol)

    return {
        'formula': Chem.rdMolDescriptors.CalcMolFormula(mol),
        'molecularWeight': float(Descriptors.MolWt(mol)),
        'exactMass': float(Descriptors.ExactMolWt(mol)),
        'logP': float(Chem.Crippen.MolLogP(mol)),
        'tpsa': float(Descriptors.TPSA(mol)),
        'hbd': int(Descriptors.NumHDonors(mol)),
        'hba': int(Descriptors.NumHAcceptors(mol)),
        'rotatableBonds': int(Descriptors.NumRotatableBonds(mol)),
        'ringCount': int(ring_count),
        'heavyAtomCount': int(heavy_atom_count),
        'formalCharge': int(sum(atom.GetFormalCharge() for atom in mol.GetAtoms()))
    }


@app.post('/quantum/calculate')
def quantum_calculate(payload: QuantumPayload):
    method = normalize_quantum_method(payload.method)
    if method not in {'gfn2-xTB', 'gfn1-xTB'}:
        raise HTTPException(status_code=400, detail='This backend currently supports GFN1-xTB and GFN2-xTB.')

    if payload.format.lower() != 'xyz':
        raise HTTPException(status_code=400, detail='Professional xTB calculation requires XYZ input.')

    atoms = parse_xyz_atoms(payload.structureData)
    if not atoms:
        raise HTTPException(status_code=400, detail='XYZ structure did not contain atoms.')

    xtb_path = shutil.which('xtb')
    if not xtb_path:
        raise HTTPException(status_code=503, detail='xTB executable was not found on this backend.')

    with tempfile.TemporaryDirectory(prefix='chemvault-xtb-') as tmp:
        workdir = Path(tmp)
        xyz_path = workdir / 'input.xyz'
        xyz_path.write_text(payload.structureData, encoding='utf-8')

        command = [
            xtb_path,
            xyz_path.name,
            '--gfn',
            '2' if method == 'gfn2-xTB' else '1',
            '--chrg',
            str(payload.charge),
            '--json'
        ]
        if payload.multiplicity > 1:
            command.extend(['--uhf', str(max(0, payload.multiplicity - 1))])

        completed = subprocess.run(
            command,
            cwd=workdir,
            text=True,
            capture_output=True,
            timeout=180,
            check=False
        )

        if completed.returncode != 0:
            raise HTTPException(
                status_code=502,
                detail=completed.stderr.strip() or completed.stdout.strip() or 'xTB calculation failed.'
            )

        json_payload = read_xtb_json(workdir / 'xtbout.json')
        charges = read_xtb_charges(workdir / 'charges')
        charge_rows = [
            {'atomIndex': index + 1, 'element': atom['element'], 'charge': charge}
            for index, (atom, charge) in enumerate(zip(atoms, charges))
        ]
        dipole = read_dipole(json_payload, completed.stdout)
        magnitude = math.sqrt(sum(component * component for component in dipole)) if dipole else None

        return {
            'success': True,
            'status': 'completed',
            'engine': 'xTB CLI',
            'method': method,
            'totalEnergyHartree': read_total_energy(json_payload, completed.stdout),
            'homoLumoGapEV': read_homo_lumo_gap(json_payload, completed.stdout),
            'dipoleDebye': None if dipole is None else {
                'x': dipole[0],
                'y': dipole[1],
                'z': dipole[2],
                'magnitude': magnitude
            },
            'atomCharges': charge_rows,
            'warnings': []
        }


def normalize_quantum_method(value: str) -> str:
    normalized = value.strip().lower().replace('_', '-').replace(' ', '-')
    if normalized in {'gfn1-xtb', 'gfn1xtb'}:
        return 'gfn1-xTB'
    return 'gfn2-xTB'


def parse_xyz_atoms(data: str) -> list[dict[str, float | str]]:
    lines = [line.strip() for line in data.replace('\r', '').split('\n') if line.strip()]
    if len(lines) < 2:
        return []

    try:
        declared_count = int(lines[0])
        atom_lines = lines[2:2 + declared_count]
    except ValueError:
        atom_lines = lines

    atoms: list[dict[str, float | str]] = []
    for line in atom_lines:
        parts = line.split()
        if len(parts) < 4:
            continue
        try:
            atoms.append({
                'element': parts[0],
                'x': float(parts[1]),
                'y': float(parts[2]),
                'z': float(parts[3])
            })
        except ValueError:
            continue
    return atoms


def read_xtb_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError):
        return {}


def read_xtb_charges(path: Path) -> list[float]:
    if not path.exists():
        return []
    values: list[float] = []
    for token in path.read_text(encoding='utf-8').split():
        try:
            values.append(float(token))
        except ValueError:
            continue
    return values


def read_total_energy(payload: dict, stdout: str) -> float | None:
    value = find_number(payload, {'total energy', 'total_energy', 'energy'})
    if value is not None:
        return value
    match = re.search(r'TOTAL\s+ENERGY\s+(-?\d+(?:\.\d+)?)', stdout, flags=re.IGNORECASE)
    return float(match.group(1)) if match else None


def read_homo_lumo_gap(payload: dict, stdout: str) -> float | None:
    value = find_number(payload, {'homo-lumo gap', 'homo_lumo_gap', 'hl gap', 'gap'})
    if value is not None:
        return value
    match = re.search(r'HOMO-?LUMO\s+GAP\s+(-?\d+(?:\.\d+)?)', stdout, flags=re.IGNORECASE)
    return float(match.group(1)) if match else None


def read_dipole(payload: dict, stdout: str) -> list[float] | None:
    values = find_number_list(payload, {'dipole', 'dipole moment', 'molecular dipole'})
    if values and len(values) >= 3:
        return values[:3]
    match = re.search(
        r'dipole[^\n\r]*?x\s+(-?\d+(?:\.\d+)?)[^\n\r]*?y\s+(-?\d+(?:\.\d+)?)[^\n\r]*?z\s+(-?\d+(?:\.\d+)?)',
        stdout,
        flags=re.IGNORECASE | re.DOTALL
    )
    return [float(match.group(index)) for index in range(1, 4)] if match else None


def find_number(value, names: set[str]) -> float | None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if normalize_key(key) in {normalize_key(name) for name in names}:
                parsed = number_from_value(nested)
                if parsed is not None:
                    return parsed
            found = find_number(nested, names)
            if found is not None:
                return found
    if isinstance(value, list):
        for item in value:
            found = find_number(item, names)
            if found is not None:
                return found
    return None


def find_number_list(value, names: set[str]) -> list[float] | None:
    if isinstance(value, dict):
        for key, nested in value.items():
            if normalize_key(key) in {normalize_key(name) for name in names}:
                parsed = list_from_value(nested)
                if parsed:
                    return parsed
            found = find_number_list(nested, names)
            if found:
                return found
    if isinstance(value, list):
        for item in value:
            found = find_number_list(item, names)
            if found:
                return found
    return None


def number_from_value(value) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def list_from_value(value) -> list[float]:
    if isinstance(value, list):
        numbers = [number_from_value(item) for item in value]
        return [number for number in numbers if number is not None]
    return []


def normalize_key(value: str) -> str:
    return re.sub(r'[^a-z0-9]', '', value.lower())
