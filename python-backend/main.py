from __future__ import annotations

from fastapi import FastAPI
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
