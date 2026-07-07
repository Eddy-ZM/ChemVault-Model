import SwiftUI

struct SearchView: View {
    @Environment(AppState.self) private var appState
    @State private var query = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?
    @State private var candidateQuery = ""
    @State private var candidateMatches: [MoleculeSummary] = []
    @State private var isCandidateSheetPresented = false

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

                    CVPanel("Search tolerance", subtitle: "Close spellings and aliases are accepted.") {
                        ActionRow(title: "Candidate picker", subtitle: "When PubChem returns several possible compounds, choose the exact substance in a separate selection window.", systemImage: "list.bullet.rectangle")
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
        .sheet(isPresented: $isCandidateSheetPresented) {
            CandidateSelectionSheet(query: candidateQuery, candidates: candidateMatches) { summary in
                selectedMolecule = summary
                isCandidateSheetPresented = false
            } onCancel: {
                isCandidateSheetPresented = false
            }
        }
    }

    private func search(_ value: String) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            let candidates = try await appState.moleculeClient.searchCompoundCandidates(query: value)
            if candidates.count == 1 {
                selectedMolecule = candidates[0]
            } else {
                candidateQuery = value
                candidateMatches = candidates
                isCandidateSheetPresented = true
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct CandidateSelectionSheet: View {
    var query: String
    var candidates: [MoleculeSummary]
    var onSelect: (MoleculeSummary) -> Void
    var onCancel: () -> Void

    var body: some View {
        NavigationStack {
            List(candidates) { candidate in
                Button {
                    onSelect(candidate)
                } label: {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(candidate.name)
                            .font(.headline)
                            .foregroundStyle(.primary)
                        HStack {
                            if let cid = candidate.cid {
                                Label("CID \(cid)", systemImage: "number")
                            }
                            if let formula = candidate.formula {
                                Label(formula, systemImage: "function")
                            }
                            if let weight = candidate.molecularWeight {
                                Label(weight.chemFormatted, systemImage: "scalemass")
                            }
                        }
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 4)
                }
            }
            .navigationTitle("Choose compound")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
            .safeAreaInset(edge: .top) {
                Text("Select the exact PubChem substance for \"\(query)\"")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                    .background(.bar)
            }
        }
    }
}
