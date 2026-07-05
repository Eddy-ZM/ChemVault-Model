import SwiftUI
#if os(macOS)
import AppKit
#else
import UIKit
#endif

struct MoleculeDetailView: View {
    @Environment(AppState.self) private var appState
    @State private var summary: MoleculeSummary
    @State private var model = Molecule3DModel.empty
    @State private var properties: MoleculeProperties?
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var displayMode: MoleculeDisplayMode = .ballAndStick
    @State private var background: MoleculeViewerBackground = .system
    @State private var quantumMethod: QuantumCalculationMethod = .gfn2XTB
    @State private var quantumRoute: QuantumEngineRoute = .automatic
    @State private var quantumResult: QuantumCalculationResult?
    @State private var isRunningQuantumCalculation = false
    @State private var quantumErrorMessage: String?

    init(summary: MoleculeSummary) {
        _summary = State(initialValue: summary)
        _model = State(initialValue: summary.model ?? .empty)
        _properties = State(initialValue: summary.properties)
    }

    var body: some View {
        WorkspaceScreen(
            title: summary.name,
            subtitle: detailSubtitle,
            systemImage: icon(for: summary.source)
        ) {
            ViewThatFits(in: .horizontal) {
                HStack(alignment: .top, spacing: 16) {
                    viewerPanel
                        .frame(minWidth: 420)
                    inspectorPanel
                        .frame(width: 360)
                }
                VStack(spacing: 16) {
                    viewerPanel
                    inspectorPanel
                }
            }

            if let errorMessage { InlineErrorView(message: errorMessage) }

            propertiesPanel
            professionalCalculationPanel
            actionsPanel
        }
        .navigationTitle(summary.name)
        .task { await loadIfNeeded() }
        .onChange(of: quantumMethod) { _, _ in clearQuantumResult() }
        .onChange(of: quantumRoute) { _, _ in clearQuantumResult() }
    }

    private var viewerPanel: some View {
        CVPanel("3D Viewer", subtitle: model.isEmpty ? "Structure data is loading or unavailable." : "\(model.atoms.count) atoms, \(model.bonds.count) bonds") {
            NativeMolecule3DView(model: model, displayMode: displayMode, background: background)
                .frame(minHeight: 420)
                .clipShape(RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(AppTheme.subtleStroke))

            viewerControls

            if isLoading {
                HStack(spacing: 10) {
                    ProgressView()
                    Text("Loading structure")
                        .foregroundStyle(.secondary)
                }
                .font(.callout)
            }
        }
    }

    private var viewerControls: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 10) { controlContent }
            VStack(alignment: .leading, spacing: 10) { controlContent }
        }
    }

    private var controlContent: some View {
        Group {
            Picker("Display", selection: $displayMode) {
                ForEach(MoleculeDisplayMode.allCases) { mode in Text(mode.title).tag(mode) }
            }
            .pickerStyle(.menu)

            Picker("Background", selection: $background) {
                ForEach(MoleculeViewerBackground.allCases) { bg in Text(bg.title).tag(bg) }
            }
            .pickerStyle(.menu)

            StatusPill(title: model.isEmpty ? "No structure" : "Loaded", systemImage: model.isEmpty ? "circle" : "checkmark.circle", tint: model.isEmpty ? .secondary : .green)
        }
    }

    private var inspectorPanel: some View {
        CVPanel("Structure Details", subtitle: "Identifiers and source metadata for the current molecule.") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                MetricTile(title: "Source", value: summary.source.rawValue.capitalized)
                MetricTile(title: "Formula", value: properties?.formula ?? summary.formula ?? "N/A")
                MetricTile(title: "Molecular Weight", value: (properties?.molecularWeight ?? summary.molecularWeight).map { $0.chemFormatted } ?? "N/A")
                MetricTile(title: "CID", value: summary.cid ?? "N/A")
                MetricTile(title: "PDB ID", value: summary.pdbID ?? "N/A")
                MetricTile(title: "File", value: summary.fileName ?? "N/A")
            }
        }
    }

    private var propertiesPanel: some View {
        CVPanel("Properties", subtitle: "Computed and source-backed molecular descriptors when available.") {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 180), spacing: 12)], spacing: 12) {
                MetricTile(title: "Exact Mass", value: properties?.exactMass.map { $0.chemFormatted } ?? "N/A")
                MetricTile(title: "LogP", value: properties?.logP.map { $0.chemFormatted } ?? "N/A")
                MetricTile(title: "TPSA", value: properties?.tpsa.map { $0.chemFormatted } ?? "N/A")
                MetricTile(title: "H Donors", value: properties?.hbd.map(String.init) ?? "N/A")
                MetricTile(title: "H Acceptors", value: properties?.hba.map(String.init) ?? "N/A")
                MetricTile(title: "Rotatable Bonds", value: properties?.rotatableBonds.map(String.init) ?? "N/A")
                MetricTile(title: "Rings", value: properties?.ringCount.map(String.init) ?? "N/A")
                MetricTile(title: "Heavy Atoms", value: properties?.heavyAtomCount.map(String.init) ?? "N/A")
                MetricTile(title: "Formal Charge", value: properties?.formalCharge.map(String.init) ?? "N/A")
            }

            if let smiles = summary.canonicalSMILES {
                MetricTile(title: "Canonical SMILES", value: smiles)
            }
            if let inchiKey = summary.inchiKey {
                MetricTile(title: "InChIKey", value: inchiKey)
            }
            if let iupacName = summary.iupacName {
                MetricTile(title: "IUPAC Name", value: iupacName)
            }
        }
    }

    private var professionalCalculationPanel: some View {
        CVPanel("Professional Calculation", subtitle: "Native app quantum workflow for energy, charges, and dipole moment.") {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { quantumControls }
                VStack(alignment: .leading, spacing: 10) { quantumControls }
            }

            if let quantumErrorMessage {
                InlineErrorView(message: quantumErrorMessage)
            }

            if let quantumResult {
                quantumResultView(quantumResult)
            } else {
                EmptyStateBlock(
                    title: "No calculation result",
                    message: "Professional calculation results will appear here.",
                    systemImage: "function"
                )
            }
        }
    }

    private var quantumControls: some View {
        Group {
            Picker("Method", selection: $quantumMethod) {
                ForEach(QuantumCalculationMethod.allCases) { method in Text(method.title).tag(method) }
            }
            .pickerStyle(.menu)

            Picker("Engine", selection: $quantumRoute) {
                ForEach(QuantumEngineRoute.allCases) { route in Text(route.title).tag(route) }
            }
            .pickerStyle(.menu)

            Button {
                Task { await runQuantumCalculation() }
            } label: {
                LoadingButtonLabel(title: "Run Calculation", isLoading: isRunningQuantumCalculation)
            }
            .buttonStyle(.borderedProminent)
            .disabled(model.isEmpty || isRunningQuantumCalculation)

            StatusPill(
                title: quantumResult == nil ? "Not run" : "Completed",
                systemImage: quantumResult == nil ? "circle" : "checkmark.circle",
                tint: quantumResult == nil ? .secondary : .green
            )
        }
    }

    private func quantumResultView(_ result: QuantumCalculationResult) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 170), spacing: 12)], spacing: 12) {
                MetricTile(title: "Engine", value: result.engine, systemImage: "server.rack")
                MetricTile(title: "Method", value: result.method, systemImage: "function")
                MetricTile(title: "Total Energy", value: formatOptional(result.totalEnergyHartree, unit: "Eh"), systemImage: "sum")
                MetricTile(title: "HOMO-LUMO Gap", value: formatOptional(result.homoLumoGapEV, unit: "eV"), systemImage: "arrow.up.arrow.down")
                MetricTile(title: "Dipole", value: result.dipoleDebye.map { "\($0.magnitude.chemFormatted) D" } ?? "N/A", systemImage: "arrow.up.right")
                MetricTile(title: "Runtime", value: formatOptional(result.runtimeSeconds, unit: "s"), systemImage: "timer")
            }

            if let dipole = result.dipoleDebye {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                    MetricTile(title: "Dipole X", value: "\(dipole.x.chemFormatted) D")
                    MetricTile(title: "Dipole Y", value: "\(dipole.y.chemFormatted) D")
                    MetricTile(title: "Dipole Z", value: "\(dipole.z.chemFormatted) D")
                }
            }

            if !result.atomCharges.isEmpty {
                chargeTable(result.atomCharges)
            }

            ForEach(result.warnings, id: \.self) { warning in
                Label(warning, systemImage: "exclamationmark.triangle")
                    .font(.caption)
                    .foregroundStyle(.orange)
            }
        }
    }

    private func chargeTable(_ charges: [QuantumAtomicCharge]) -> some View {
        let rows = Array(charges.sorted { abs($0.charge) > abs($1.charge) }.prefix(12))
        return VStack(alignment: .leading, spacing: 8) {
            Text("Atomic Charges")
                .font(.subheadline.weight(.semibold))
            Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 7) {
                GridRow {
                    Text("Atom").foregroundStyle(.secondary)
                    Text("Element").foregroundStyle(.secondary)
                    Text("Charge").foregroundStyle(.secondary)
                }
                .font(.caption.weight(.medium))

                ForEach(rows) { row in
                    GridRow {
                        Text("\(row.atomIndex)").font(.body.monospaced())
                        Text(row.element).font(.body.weight(.semibold))
                        Text("\(row.charge >= 0 ? "+" : "")\(row.charge.chemFormatted) e")
                            .font(.body.monospaced())
                            .foregroundStyle(row.charge >= 0 ? .red : .blue)
                    }
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AppTheme.panelBackground.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.subtleStroke))
        }
    }

    private var actionsPanel: some View {
        CVPanel("Actions") {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { actionContent }
                VStack(alignment: .leading, spacing: 10) { actionContent }
            }
        }
    }

    private var actionContent: some View {
        Group {
            Button("Save to Library") { appState.saveToLibrary(summary) }
                .buttonStyle(.borderedProminent)

            if let smiles = summary.canonicalSMILES {
                ShareLink("Share Summary", item: "\(summary.name)\n\(smiles)")
                Button("Copy SMILES") { copy(smiles) }
                    .buttonStyle(.bordered)
            }

            Button("Copy XYZ") { exportXYZ() }
                .buttonStyle(.bordered)
                .disabled(model.atoms.isEmpty)
        }
    }

    private var detailSubtitle: String {
        if let smiles = summary.canonicalSMILES { return smiles }
        if let pdbID = summary.pdbID { return "PDB \(pdbID)" }
        if let fileName = summary.fileName { return fileName }
        return summary.source.rawValue.capitalized
    }

    private func loadIfNeeded() async {
        guard model.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            if let data = summary.structureData, let format = summary.structureFormat {
                model = try StructureParser().parse(data: data, format: format)
                return
            }
            if let cid = summary.cid {
                let sdf = try await appState.moleculeClient.getCompoundSDF3D(cid: cid)
                model = try SDFParser().parse(sdf)
                summary.structureData = sdf
                summary.structureFormat = .sdf
                if let smiles = summary.canonicalSMILES {
                    properties = try? await appState.moleculeClient.getCompoundProperties(smiles: smiles)
                }
            } else if let smiles = summary.canonicalSMILES {
                let file = try await appState.moleculeClient.generate3DFromSMILES(smiles: smiles)
                summary.structureData = file.data
                summary.structureFormat = file.format
                model = try StructureParser().parse(data: file.data, format: file.format)
                properties = try? await appState.moleculeClient.getCompoundProperties(smiles: smiles)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func runQuantumCalculation() async {
        guard !model.isEmpty else { return }
        isRunningQuantumCalculation = true
        quantumErrorMessage = nil
        defer { isRunningQuantumCalculation = false }

        do {
            quantumResult = try await appState.quantumService.calculate(
                model: model,
                moleculeName: summary.name,
                method: quantumMethod,
                route: quantumRoute,
                charge: properties?.formalCharge ?? summary.properties?.formalCharge ?? 0
            )
        } catch {
            quantumResult = nil
            quantumErrorMessage = error.localizedDescription
        }
    }

    private func clearQuantumResult() {
        quantumResult = nil
        quantumErrorMessage = nil
    }

    private func exportXYZ() {
        let text = (["\(model.atoms.count)", summary.name] + model.atoms.map { "\($0.element) \($0.x) \($0.y) \($0.z)" }).joined(separator: "\n")
        copy(text)
    }

    private func formatOptional(_ value: Double?, unit: String) -> String {
        value.map { "\($0.chemFormatted) \(unit)" } ?? "N/A"
    }

    private func copy(_ value: String) {
#if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(value, forType: .string)
#else
        UIPasteboard.general.string = value
#endif
    }

    private func icon(for source: MoleculeSource) -> String {
        switch source {
        case .search: "magnifyingglass"
        case .smiles: "textformat.abc"
        case .draw: "pencil.and.outline"
        case .upload: "doc"
        case .pdb: "atom"
        case .manual: "cube"
        }
    }
}
