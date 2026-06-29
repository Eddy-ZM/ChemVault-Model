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
            actionsPanel
        }
        .navigationTitle(summary.name)
        .task { await loadIfNeeded() }
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

    private func exportXYZ() {
        let text = (["\(model.atoms.count)", summary.name] + model.atoms.map { "\($0.element) \($0.x) \($0.y) \($0.z)" }).joined(separator: "\n")
        copy(text)
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
