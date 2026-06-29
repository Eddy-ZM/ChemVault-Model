import SwiftUI

struct PDBView: View {
    @Environment(AppState.self) private var appState
    @State private var pdbID = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    private let examples = ["1CRN", "4HHB", "1BNA"]

    var body: some View {
        Group {
            if !appState.permissions.allows(.pdbAccess) {
                PermissionLockedView(permission: .pdbAccess, requiredTier: .free)
            } else {
                WorkspaceScreen(
                    title: "PDB Structure",
                    subtitle: "Load protein or nucleic acid structures by four-character RCSB PDB ID.",
                    systemImage: "atom"
                ) {
                    CVPanel("RCSB PDB", subtitle: "Use IDs such as 1CRN, 4HHB, or 1BNA.") {
                        TextField("PDB ID", text: $pdbID)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await load(pdbID) } }
                        HStack {
                            Button { Task { await load(pdbID) } } label: {
                                LoadingButtonLabel(title: "Load PDB", isLoading: isLoading)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isLoading || pdbID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                            Button("Clear") { pdbID = "" }
                                .buttonStyle(.bordered)
                                .disabled(pdbID.isEmpty || isLoading)
                        }
                    }

                    CVPanel("Examples", subtitle: "Reference structures for quick validation.") {
                        ExampleButtonGrid(examples: examples) { example in
                            Task { await load(example) }
                        }
                    }

                    if let errorMessage { InlineErrorView(message: errorMessage) }
                }
            }
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private func load(_ value: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let result = try await appState.moleculeClient.loadPDB(id: value)
            let model = try PDBParser().parse(result.pdbData)
            selectedMolecule = MoleculeSummary(
                name: result.metadata?.title ?? "PDB \(result.id)",
                source: .pdb,
                structureData: result.pdbData,
                structureFormat: .pdb,
                pdbID: result.id,
                model: model
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
