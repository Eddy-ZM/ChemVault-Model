import Foundation

struct MoleculeAPIClient: Sendable {
    var baseURL: URL
    var session: URLSession = .chemVault

    func searchCompound(query: String) async throws -> MoleculeSummary {
        guard let first = try await searchCompoundCandidates(query: query).first else {
            throw ChemVaultError.missingData("No PubChem result was returned.")
        }
        return first
    }

    func searchCompoundCandidates(query: String) async throws -> [MoleculeSummary] {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ChemVaultError.invalidInput("Enter a molecule name, SMILES, or PubChem CID.") }
        let url = baseURL.appending(path: "pubchem/search").appending(queryItems: [
            URLQueryItem(name: "query", value: trimmed),
            URLQueryItem(name: "limit", value: "8")
        ])
        let data = try await fetchData(url)
        let response = try JSONDecoder().decode(PubChemSearchEnvelope.self, from: data)
        let results = response.allResults.map { $0.summary(source: .search) }
        guard !results.isEmpty else { throw ChemVaultError.missingData("No PubChem result was returned.") }
        return results
    }

    func getCompoundProperties(smiles: String) async throws -> MoleculeProperties {
        let body = try JSONEncoder().encode(["smiles": smiles])
        let data = try await postData(baseURL.appending(path: "properties"), body: body)
        return try JSONDecoder().decode(MoleculeProperties.self, from: data)
    }

    func getCompoundSDF3D(cid: String) async throws -> String {
        try await getStructure(cid: cid, format: "sdf3d")
    }

    func getCompoundSDF2D(cid: String) async throws -> String {
        try await getStructure(cid: cid, format: "sdf2d")
    }

    func generate3DFromSMILES(smiles: String) async throws -> MoleculeFile {
        let trimmed = smiles.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { throw ChemVaultError.invalidInput("Enter a SMILES string first.") }
        let body = try JSONEncoder().encode(["smiles": trimmed])
        let data = try await postData(baseURL.appending(path: "generate-3d"), body: body)
        let response = try JSONDecoder().decode(Generate3DResponse.self, from: data)
        guard response.success, let structure = response.data else {
            throw ChemVaultError.requestFailed(502, response.error ?? "3D generation failed.")
        }
        return MoleculeFile(format: MoleculeFileFormat(rawValue: response.format ?? "sdf") ?? .sdf, data: structure, optimized: response.optimized, method: response.method)
    }

    func loadPDB(id: String) async throws -> PDBResult {
        let pdbID = id.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        guard pdbID.count == 4 else { throw ChemVaultError.invalidInput("Enter a 4-character PDB ID.") }
        let data = try await fetchData(baseURL.appending(path: "pdb/\(pdbID)"))
        if let response = try? JSONDecoder().decode(PDBEnvelope.self, from: data), let pdb = response.pdbData ?? response.data {
            return PDBResult(id: pdbID, pdbData: pdb, metadata: response.metadata)
        }
        guard let raw = String(data: data, encoding: .utf8), raw.contains("ATOM") || raw.contains("HETATM") else {
            throw ChemVaultError.parserFailed("PDB response did not include structure data.")
        }
        return PDBResult(id: pdbID, pdbData: raw, metadata: nil)
    }

    private func getStructure(cid: String, format: String) async throws -> String {
        let url = baseURL.appending(path: "pubchem/structure").appending(queryItems: [
            URLQueryItem(name: "cid", value: cid),
            URLQueryItem(name: "format", value: format)
        ])
        let data = try await fetchData(url)
        if let envelope = try? JSONDecoder().decode(StructureEnvelope.self, from: data), let structure = envelope.data ?? envelope.structure {
            return structure
        }
        guard let text = String(data: data, encoding: .utf8), !text.isEmpty else { throw ChemVaultError.missingData("Structure response was empty.") }
        return text
    }

    private func fetchData(_ url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        try validate(response: response, data: data)
        return data
    }

    private func postData(_ url: URL, body: Data) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let (data, response) = try await session.data(for: request)
        try validate(response: response, data: data)
        return data
    }

    private func validate(response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else { throw ChemVaultError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = String(data: data, encoding: .utf8) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw ChemVaultError.requestFailed(http.statusCode, message)
        }
    }
}

private struct PubChemSearchEnvelope: Decodable {
    var results: [CompoundDTO]?
    var result: CompoundDTO?
    var compounds: [CompoundDTO]?

    var firstResult: CompoundDTO? { result ?? results?.first ?? compounds?.first }
    var allResults: [CompoundDTO] {
        if let results, !results.isEmpty { return results }
        if let compounds, !compounds.isEmpty { return compounds }
        return firstResult.map { [$0] } ?? []
    }
}

private struct CompoundDTO: Decodable {
    var name: String?
    var cid: FlexibleString?
    var smiles: String?
    var canonicalSMILES: String?
    var canonicalSmiles: String?
    var formula: String?
    var molecularFormula: String?
    var weight: FlexibleDouble?
    var molecularWeight: FlexibleDouble?
    var inchi: String?
    var inchikey: String?
    var inchiKey: String?
    var iupacName: String?
    var matchedName: String?
    var matchType: String?
    var matchScore: FlexibleDouble?

    func summary(source: MoleculeSource) -> MoleculeSummary {
        MoleculeSummary(
            name: name ?? matchedName ?? iupacName ?? "PubChem Compound",
            cid: cid?.value,
            canonicalSMILES: canonicalSMILES ?? canonicalSmiles ?? smiles,
            formula: formula ?? molecularFormula,
            molecularWeight: molecularWeight?.value ?? weight?.value,
            inchi: inchi,
            inchiKey: inchiKey ?? inchikey,
            iupacName: iupacName,
            source: source
        )
    }
}

private struct Generate3DResponse: Decodable {
    var success: Bool
    var format: String?
    var data: String?
    var optimized: Bool?
    var method: String?
    var error: String?
}

private struct StructureEnvelope: Decodable {
    var data: String?
    var structure: String?
    var format: String?
}

struct PDBResult: Sendable {
    var id: String
    var pdbData: String
    var metadata: PDBMetadata?
}

struct PDBMetadata: Codable, Hashable, Sendable {
    var title: String?
    var resolution: Double?
    var experimentalMethod: String?
}

private struct PDBEnvelope: Decodable {
    var data: String?
    var pdbData: String?
    var metadata: PDBMetadata?
}

struct FlexibleString: Decodable, Hashable, Sendable {
    var value: String
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) { value = string; return }
        if let int = try? container.decode(Int.self) { value = String(int); return }
        throw DecodingError.typeMismatch(String.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected string or int"))
    }
}

struct FlexibleDouble: Decodable, Hashable, Sendable {
    var value: Double
    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let double = try? container.decode(Double.self) { value = double; return }
        if let string = try? container.decode(String.self), let double = Double(string) { value = double; return }
        throw DecodingError.typeMismatch(Double.self, DecodingError.Context(codingPath: decoder.codingPath, debugDescription: "Expected double or string"))
    }
}

extension URL {
    func appending(queryItems: [URLQueryItem]) -> URL {
        guard var components = URLComponents(url: self, resolvingAgainstBaseURL: false) else { return self }
        components.queryItems = (components.queryItems ?? []) + queryItems
        return components.url ?? self
    }
}
