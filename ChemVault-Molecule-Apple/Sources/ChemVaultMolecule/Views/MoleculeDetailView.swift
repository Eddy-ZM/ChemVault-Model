import SwiftUI

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
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                NativeMolecule3DView(model: model, displayMode: displayMode, background: background)
                    .frame(minHeight: 360)
                    .clipShape(RoundedRectangle(cornerRadius: 18))

                viewerControls

                if isLoading { ProgressView("Loading structure") }
                if let errorMessage { InlineErrorView(message: errorMessage) }

                detailsGrid
                actions
            }
            .padding()
        }
        .navigationTitle(summary.name)
        .task { await loadIfNeeded() }
    }

    private var viewerControls: some View {
        HStack {
            Picker("Display", selection: $displayMode) {
                ForEach(MoleculeDisplayMode.allCases) { mode in Text(mode.title).tag(mode) }
            }
            Picker("Background", selection: $background) {
                ForEach(MoleculeViewerBackground.allCases) { bg in Text(bg.title).tag(bg) }
            }
            Spacer()
            Button("Reset View") { }
        }
    }

    private var detailsGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 12)], spacing: 12) {
            DetailRow(title: "Name", value: summary.name)
            DetailRow(title: "Formula", value: properties?.formula ?? summary.formula)
            DetailRow(title: "Molecular Weight", value: (properties?.molecularWeight ?? summary.molecularWeight).map { $0.chemFormatted })
            DetailRow(title: "Canonical SMILES", value: summary.canonicalSMILES)
            DetailRow(title: "InChIKey", value: summary.inchiKey)
            DetailRow(title: "IUPAC Name", value: summary.iupacName)
            DetailRow(title: "Source", value: summary.source.rawValue)
            DetailRow(title: "PDB ID", value: summary.pdbID)
            DetailRow(title: "File", value: summary.fileName)
        }
    }

    private var actions: some View {
        HStack {
            Button("Save to Library") { appState.saveToLibrary(summary) }
                .buttonStyle(.borderedProminent)
            if let smiles = summary.canonicalSMILES {
                ShareLink("Share Summary", item: "\(summary.name)\n\(smiles)")
                Button("Copy SMILES") {
#if os(macOS)
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(smiles, forType: .string)
#else
                    UIPasteboard.general.string = smiles
#endif
                }
            }
            Button("Export XYZ") { exportXYZ() }
                .disabled(model.atoms.isEmpty)
        }
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
#if os(macOS)
        let pasteboard = NSPasteboard.general
        pasteboard.clearContents()
        pasteboard.setString(text, forType: .string)
#else
        UIPasteboard.general.string = text
#endif
    }
}
