import SwiftUI

struct PDBView: View {
    @Environment(AppState.self) private var appState
    @State private var pdbID = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    private let examples = ["1CRN", "4HHB", "1BNA"]

    var body: some View {
        ZStack {
            if !appState.permissions.allows(.pdbAccess) {
                PermissionLockedView(permission: .pdbAccess, requiredTier: .free)
            } else {
                Form {
                    Section("RCSB PDB") {
                        TextField("PDB ID", text: $pdbID)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await load(pdbID) } }
                        Button { Task { await load(pdbID) } } label: {
                            LoadingButtonLabel(title: "Load PDB", isLoading: isLoading)
                        }
                        .disabled(isLoading || pdbID.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }

                    Section("Examples") {
                        ForEach(examples, id: \ .self) { example in
                            Button(example) { Task { await load(example) } }
                        }
                    }

                    if let errorMessage { Section { InlineErrorView(message: errorMessage) } }
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
