import Foundation

struct QuantumCalculationService: Sendable {
    var baseURL: URL
    var session: URLSession
    var accessToken: String?

    init(baseURL: URL, session: URLSession = .chemVaultQuantum, accessToken: String? = nil) {
        self.baseURL = baseURL
        self.session = session
        self.accessToken = accessToken
    }

    func calculate(
        model: Molecule3DModel,
        moleculeName: String,
        method: QuantumCalculationMethod,
        route: QuantumEngineRoute,
        charge: Int,
        multiplicity: Int = 1
    ) async throws -> QuantumCalculationResult {
        guard !model.atoms.isEmpty else {
            throw ChemVaultError.invalidInput("Load a 3D structure before running a professional calculation.")
        }

        switch route {
        case .automatic:
            if method.supportsLocalXTB {
                do {
                    return try await runLocalXTB(model: model, moleculeName: moleculeName, method: method, charge: charge, multiplicity: multiplicity)
                } catch {
                    return try await runCloud(model: model, moleculeName: moleculeName, method: method, charge: charge, multiplicity: multiplicity)
                }
            }
            return try await runCloud(model: model, moleculeName: moleculeName, method: method, charge: charge, multiplicity: multiplicity)
        case .localXTB:
            return try await runLocalXTB(model: model, moleculeName: moleculeName, method: method, charge: charge, multiplicity: multiplicity)
        case .cloud:
            return try await runCloud(model: model, moleculeName: moleculeName, method: method, charge: charge, multiplicity: multiplicity)
        }
    }

    private func runCloud(
        model: Molecule3DModel,
        moleculeName: String,
        method: QuantumCalculationMethod,
        charge: Int,
        multiplicity: Int
    ) async throws -> QuantumCalculationResult {
        let requestBody = QuantumCloudRequest(
            moleculeName: moleculeName,
            structureData: Self.xyz(from: model, moleculeName: moleculeName),
            format: "xyz",
            method: method.serviceValue,
            charge: charge,
            multiplicity: multiplicity
        )
        let body = try JSONEncoder().encode(requestBody)
        let data = try await postData(baseURL.appending(path: "quantum/calculate"), body: body)
        return try Self.decodeCloudResult(data: data, atoms: model.atoms, fallbackMethod: method.title)
    }

    private func postData(_ url: URL, body: Data) async throws -> Data {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let accessToken, !accessToken.isEmpty {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw ChemVaultError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let message = Self.errorMessage(from: data) ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
            throw ChemVaultError.requestFailed(http.statusCode, message)
        }
        return data
    }

    private func runLocalXTB(
        model: Molecule3DModel,
        moleculeName: String,
        method: QuantumCalculationMethod,
        charge: Int,
        multiplicity: Int
    ) async throws -> QuantumCalculationResult {
        guard method.supportsLocalXTB else {
            throw ChemVaultError.unsupportedFormat("\(method.title) requires a configured cloud quantum engine.")
        }

#if os(macOS)
        return try await withCheckedThrowingContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let result = try Self.executeLocalXTB(
                        model: model,
                        moleculeName: moleculeName,
                        method: method,
                        charge: charge,
                        multiplicity: multiplicity
                    )
                    continuation.resume(returning: result)
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
#else
        throw ChemVaultError.unsupportedFormat("Local xTB execution is available only in the macOS app.")
#endif
    }

#if os(macOS)
    private static func executeLocalXTB(
        model: Molecule3DModel,
        moleculeName: String,
        method: QuantumCalculationMethod,
        charge: Int,
        multiplicity: Int
    ) throws -> QuantumCalculationResult {
        let startedAt = Date()
        let fileManager = FileManager.default
        let workdir = fileManager.temporaryDirectory.appendingPathComponent("ChemVaultQuantum-\(UUID().uuidString)", isDirectory: true)
        try fileManager.createDirectory(at: workdir, withIntermediateDirectories: true)
        defer { try? fileManager.removeItem(at: workdir) }

        let inputURL = workdir.appendingPathComponent("input.xyz")
        try xyz(from: model, moleculeName: moleculeName).write(to: inputURL, atomically: true, encoding: .utf8)

        let executable = resolvedXTBExecutable()
        let process = Process()
        process.executableURL = executable.url
        process.currentDirectoryURL = workdir
        process.arguments = executable.argumentPrefix + [
            inputURL.lastPathComponent,
            "--gfn",
            method == .gfn1XTB ? "1" : "2",
            "--chrg",
            "\(charge)",
            "--json"
        ] + (multiplicity > 1 ? ["--uhf", "\(max(0, multiplicity - 1))"] : [])

        let outputPipe = Pipe()
        let errorPipe = Pipe()
        process.standardOutput = outputPipe
        process.standardError = errorPipe

        try process.run()
        process.waitUntilExit()

        let stdout = String(data: outputPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""
        let stderr = String(data: errorPipe.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8) ?? ""

        guard process.terminationStatus == 0 else {
            let message = stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? stdout : stderr
            throw ChemVaultError.requestFailed(Int(process.terminationStatus), message.trimmingCharacters(in: .whitespacesAndNewlines))
        }

        let jsonURL = workdir.appendingPathComponent("xtbout.json")
        let jsonObject = try? JSONSerialization.jsonObject(with: Data(contentsOf: jsonURL))
        let charges = readChargesFile(workdir.appendingPathComponent("charges"), atoms: model.atoms)
        let dipole = findVector(jsonObject, keys: ["dipole", "dipole moment", "molecular dipole"]) ?? parseDipole(from: stdout)

        return QuantumCalculationResult(
            status: .completed,
            engine: "xTB CLI",
            method: method.title,
            totalEnergyHartree: findNumber(jsonObject, keys: ["total energy", "total_energy", "energy"]) ?? parseNumber(from: stdout, pattern: #"TOTAL\s+ENERGY\s+(-?\d+(?:\.\d+)?)"#),
            homoLumoGapEV: findNumber(jsonObject, keys: ["homo-lumo gap", "homo_lumo_gap", "hl gap", "gap"]) ?? parseNumber(from: stdout, pattern: #"HOMO-?LUMO\s+GAP\s+(-?\d+(?:\.\d+)?)"#),
            dipoleDebye: dipole,
            atomCharges: charges,
            runtimeSeconds: Date().timeIntervalSince(startedAt),
            warnings: charges.isEmpty ? ["xTB completed, but no atomic charge file was produced."] : []
        )
    }

    private static func resolvedXTBExecutable() -> (url: URL, argumentPrefix: [String]) {
        let candidates = [
            ProcessInfo.processInfo.environment["CHEMVAULT_XTB_PATH"],
            "/opt/homebrew/bin/xtb",
            "/usr/local/bin/xtb",
            "/usr/bin/xtb"
        ].compactMap { $0 }

        for path in candidates where FileManager.default.isExecutableFile(atPath: path) {
            return (URL(fileURLWithPath: path), [])
        }

        return (URL(fileURLWithPath: "/usr/bin/env"), ["xtb"])
    }
#endif

    private static func decodeCloudResult(data: Data, atoms: [Atom3D], fallbackMethod: String) throws -> QuantumCalculationResult {
        let object = try JSONSerialization.jsonObject(with: data)
        guard let envelope = object as? [String: Any] else {
            throw ChemVaultError.decodingFailed("Quantum response was not a JSON object.")
        }

        if let success = envelope["success"] as? Bool, success == false {
            throw ChemVaultError.requestFailed(502, errorMessage(from: data) ?? "Quantum calculation failed.")
        }

        let result = (envelope["result"] as? [String: Any]) ?? envelope
        let charges = decodeCharges(from: result, atoms: atoms)
        let dipole = decodeDipole(from: result)

        return QuantumCalculationResult(
            status: QuantumCalculationStatus(rawValue: stringValue(result["status"]) ?? "completed") ?? .completed,
            engine: stringValue(result["engine"]) ?? "Cloud quantum engine",
            method: stringValue(result["method"]) ?? fallbackMethod,
            totalEnergyHartree: doubleValue(result["totalEnergyHartree"]) ?? doubleValue(result["total_energy_hartree"]) ?? findNumber(result, keys: ["total energy", "total_energy", "energy"]),
            homoLumoGapEV: doubleValue(result["homoLumoGapEV"]) ?? doubleValue(result["homo_lumo_gap_ev"]) ?? findNumber(result, keys: ["homo-lumo gap", "homo_lumo_gap", "gap"]),
            dipoleDebye: dipole,
            atomCharges: charges,
            runtimeSeconds: doubleValue(result["runtimeSeconds"]) ?? doubleValue(result["runtime_seconds"]),
            warnings: stringArray(result["warnings"])
        )
    }

    private static func decodeCharges(from result: [String: Any], atoms: [Atom3D]) -> [QuantumAtomicCharge] {
        if let rows = result["atomCharges"] as? [[String: Any]] {
            return rows.compactMap { row in
                guard let index = intValue(row["atomIndex"]) ?? intValue(row["index"]),
                      let charge = doubleValue(row["charge"]) else { return nil }
                let element = stringValue(row["element"]) ?? atoms[safe: index - 1]?.element ?? "?"
                return QuantumAtomicCharge(atomIndex: index, element: element, charge: charge)
            }
        }

        let values = doubleArray(result["charges"])
            ?? doubleArray(result["partialCharges"])
            ?? doubleArray(result["mullikenCharges"])
            ?? findNumberArray(result, keys: ["charges", "partial charges", "mulliken charges"])
            ?? []

        return values.enumerated().map { offset, charge in
            QuantumAtomicCharge(atomIndex: offset + 1, element: atoms[safe: offset]?.element ?? "?", charge: charge)
        }
    }

    private static func decodeDipole(from result: [String: Any]) -> QuantumVector3D? {
        if let object = (result["dipoleDebye"] as? [String: Any]) ?? (result["dipole"] as? [String: Any]),
           let x = doubleValue(object["x"]),
           let y = doubleValue(object["y"]),
           let z = doubleValue(object["z"]) {
            return QuantumVector3D(x: x, y: y, z: z)
        }

        if let values = doubleArray(result["dipoleDebye"]) ?? doubleArray(result["dipole"]) ?? findNumberArray(result, keys: ["dipole", "dipole moment", "molecular dipole"]),
           values.count >= 3 {
            return QuantumVector3D(x: values[0], y: values[1], z: values[2])
        }

        return nil
    }

    private static func readChargesFile(_ url: URL, atoms: [Atom3D]) -> [QuantumAtomicCharge] {
        guard let content = try? String(contentsOf: url, encoding: .utf8) else { return [] }
        return content
            .split(whereSeparator: { $0.isWhitespace })
            .compactMap { Double($0) }
            .enumerated()
            .map { offset, charge in
                QuantumAtomicCharge(atomIndex: offset + 1, element: atoms[safe: offset]?.element ?? "?", charge: charge)
            }
    }

    private static func xyz(from model: Molecule3DModel, moleculeName: String) -> String {
        let title = moleculeName.replacingOccurrences(of: "\n", with: " ")
        let atomLines = model.atoms.map { atom in
            String(format: "%@ %.8f %.8f %.8f", atom.element, atom.x, atom.y, atom.z)
        }
        return (["\(model.atoms.count)", title] + atomLines).joined(separator: "\n")
    }

    private static func errorMessage(from data: Data) -> String? {
        guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            return String(data: data, encoding: .utf8)
        }
        if let detail = stringValue(object["detail"]) { return detail }
        if let error = stringValue(object["error"]) { return error }
        if let message = stringValue(object["message"]) { return message }
        return String(data: data, encoding: .utf8)
    }

    private static func findNumber(_ value: Any?, keys: Set<String>) -> Double? {
        guard let value else { return nil }
        if let dictionary = value as? [String: Any] {
            for (key, nested) in dictionary {
                if keys.map(normalizedKey).contains(normalizedKey(key)), let number = doubleValue(nested) {
                    return number
                }
                if let found = findNumber(nested, keys: keys) {
                    return found
                }
            }
        }
        if let array = value as? [Any] {
            for item in array {
                if let found = findNumber(item, keys: keys) {
                    return found
                }
            }
        }
        return nil
    }

    private static func findNumberArray(_ value: Any?, keys: Set<String>) -> [Double]? {
        guard let value else { return nil }
        if let dictionary = value as? [String: Any] {
            for (key, nested) in dictionary {
                if keys.map(normalizedKey).contains(normalizedKey(key)), let numbers = doubleArray(nested), !numbers.isEmpty {
                    return numbers
                }
                if let found = findNumberArray(nested, keys: keys), !found.isEmpty {
                    return found
                }
            }
        }
        if let array = value as? [Any] {
            for item in array {
                if let found = findNumberArray(item, keys: keys), !found.isEmpty {
                    return found
                }
            }
        }
        return nil
    }

    private static func findVector(_ value: Any?, keys: Set<String>) -> QuantumVector3D? {
        guard let values = findNumberArray(value, keys: keys), values.count >= 3 else { return nil }
        return QuantumVector3D(x: values[0], y: values[1], z: values[2])
    }

    private static func parseNumber(from text: String, pattern: String) -> Double? {
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range), match.numberOfRanges > 1,
              let valueRange = Range(match.range(at: 1), in: text) else { return nil }
        return Double(text[valueRange])
    }

    private static func parseDipole(from text: String) -> QuantumVector3D? {
        guard let regex = try? NSRegularExpression(
            pattern: #"dipole[\s\S]*?x\s+(-?\d+(?:\.\d+)?)[\s\S]*?y\s+(-?\d+(?:\.\d+)?)[\s\S]*?z\s+(-?\d+(?:\.\d+)?)"#,
            options: [.caseInsensitive]
        ) else { return nil }
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        guard let match = regex.firstMatch(in: text, range: range), match.numberOfRanges > 3,
              let xRange = Range(match.range(at: 1), in: text),
              let yRange = Range(match.range(at: 2), in: text),
              let zRange = Range(match.range(at: 3), in: text),
              let x = Double(text[xRange]),
              let y = Double(text[yRange]),
              let z = Double(text[zRange]) else { return nil }
        return QuantumVector3D(x: x, y: y, z: z)
    }

    private static func doubleValue(_ value: Any?) -> Double? {
        if let value = value as? Double { return value }
        if let value = value as? Int { return Double(value) }
        if let value = value as? String { return Double(value) }
        return nil
    }

    private static func intValue(_ value: Any?) -> Int? {
        if let value = value as? Int { return value }
        if let value = value as? Double { return Int(value) }
        if let value = value as? String { return Int(value) }
        return nil
    }

    private static func stringValue(_ value: Any?) -> String? {
        value as? String
    }

    private static func stringArray(_ value: Any?) -> [String] {
        value as? [String] ?? []
    }

    private static func doubleArray(_ value: Any?) -> [Double]? {
        if let values = value as? [Double] { return values }
        if let values = value as? [Int] { return values.map(Double.init) }
        if let values = value as? [Any] {
            let numbers = values.compactMap(doubleValue)
            return numbers.isEmpty ? nil : numbers
        }
        return nil
    }

    private static func normalizedKey(_ value: String) -> String {
        value.lowercased().filter { $0.isLetter || $0.isNumber }
    }
}

private struct QuantumCloudRequest: Encodable {
    var moleculeName: String
    var structureData: String
    var format: String
    var method: String
    var charge: Int
    var multiplicity: Int
}

extension URLSession {
    static let chemVaultQuantum: URLSession = {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 120
        configuration.timeoutIntervalForResource = 240
        return URLSession(configuration: configuration)
    }()
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
