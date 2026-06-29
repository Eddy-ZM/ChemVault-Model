import SwiftUI

struct SearchView: View {
    @Environment(AppState.self) private var appState
    @State private var query = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    private let examples = ["Water", "Ethanol", "Benzene", "Caffeine", "Aspirin", "Paracetamol", "Ibuprofen", "Glucose"]

    var body: some View {
        Group {
            if !appState.permissions.allows(.search) {
                PermissionLockedView(permission: .search, requiredTier: .free)
            } else {
                WorkspaceScreen(
                    title: "Compound Search",
                    subtitle: "Search PubChem by compound name or CID, then open a native 3D detail view.",
                    systemImage: "magnifyingglass"
                ) {
                    CVPanel("Search PubChem", subtitle: "Use a precise molecule name, common name, or PubChem CID.") {
                        TextField("Molecule name or CID", text: $query)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await search(query) } }
                        HStack {
                            Button { Task { await search(query) } } label: {
                                LoadingButtonLabel(title: "Search Molecule", isLoading: isLoading)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(isLoading || query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                            Button("Clear") { query = "" }
                                .buttonStyle(.bordered)
                                .disabled(query.isEmpty || isLoading)
                        }
                    }

                    CVPanel("Examples", subtitle: "Known compounds for a fast structure check.") {
                        ExampleButtonGrid(examples: examples) { example in
                            Task { await search(example) }
                        }
                    }

                    if let errorMessage {
                        InlineErrorView(message: errorMessage)
                    }

                    if let offline = appState.offlineMessage {
                        CVPanel {
                            ActionRow(title: "Limited mode", subtitle: offline, systemImage: "wifi.exclamationmark")
                        }
                    }
                }
            }
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private func search(_ value: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            selectedMolecule = try await appState.moleculeClient.searchCompound(query: value)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
