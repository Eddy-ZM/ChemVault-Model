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
                List {
                    Section("Search PubChem") {
                        TextField("Molecule name or CID", text: $query)
                            .textFieldStyle(.roundedBorder)
                            .onSubmit { Task { await search(query) } }
                        Button { Task { await search(query) } } label: {
                            LoadingButtonLabel(title: "Search Molecule", isLoading: isLoading)
                        }
                        .disabled(isLoading || query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }

                    Section("Examples") {
                        FlowLayout(items: examples) { example in
                            Button(example) { Task { await search(example) } }
                                .buttonStyle(.bordered)
                        }
                    }

                    if let errorMessage {
                        Section { InlineErrorView(message: errorMessage) }
                    }

                    if let offline = appState.offlineMessage {
                        Section { Text(offline).foregroundStyle(.secondary) }
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

struct FlowLayout<Item: Hashable, Content: View>: View {
    let items: [Item]
    let content: (Item) -> Content

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(items, id: \ .self) { item in content(item) }
        }
    }
}
