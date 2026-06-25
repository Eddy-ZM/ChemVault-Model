import SwiftUI

struct SmilesInputView: View {
    @Environment(AppState.self) private var appState
    @State private var smiles = ""
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    private let examples = ["CCO", "c1ccccc1", "CC(=O)OC1=CC=CC=C1C(=O)O"]

    var body: some View {
        Group {
            if !appState.permissions.allows(.smilesInput) {
                PermissionLockedView(permission: .smilesInput, requiredTier: .free)
            } else {
                Form {
                    Section("SMILES") {
                        TextEditor(text: $smiles)
                            .font(.body.monospaced())
                            .frame(minHeight: 140)
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(.quaternary))
                        HStack {
                            Button("Load Molecule") { load() }.buttonStyle(.borderedProminent)
                            Button("Clear") { smiles = "" }.buttonStyle(.bordered)
                        }
                    }

                    Section("Examples") {
                        ForEach(examples, id: \ .self) { example in
                            Button(example) { smiles = example }
                                .font(.body.monospaced())
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

    private func load() {
        let trimmed = smiles.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { errorMessage = "Enter a SMILES string first."; return }
        guard trimmed.range(of: #"\s"#, options: .regularExpression) == nil else { errorMessage = "SMILES should not contain spaces."; return }
        errorMessage = nil
        selectedMolecule = MoleculeSummary(name: "SMILES Structure", canonicalSMILES: trimmed, source: .smiles)
    }
}
