import SwiftUI
#if os(macOS)
import AppKit
#else
import UIKit
#endif

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
                WorkspaceScreen(
                    title: "SMILES Input",
                    subtitle: "Paste or type a SMILES string and load it into the native molecule viewer.",
                    systemImage: "textformat.abc"
                ) {
                    CVPanel("Structure notation", subtitle: "Whitespace is not allowed inside a single SMILES string.") {
                        TextEditor(text: $smiles)
                            .font(.body.monospaced())
                            .frame(minHeight: 140)
                            .padding(8)
                            .background(.background, in: RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.subtleStroke))
                        HStack {
                            Button("Load Molecule") { load() }.buttonStyle(.borderedProminent)
                            Button("Clear") { smiles = "" }.buttonStyle(.bordered)
                            Button("Copy") { copySmiles() }
                                .buttonStyle(.bordered)
                                .disabled(smiles.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }

                    CVPanel("Examples", subtitle: "Small molecules that load quickly during review.") {
                        ExampleButtonGrid(examples: examples) { example in
                            smiles = example
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

    private func load() {
        let trimmed = smiles.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { errorMessage = "Enter a SMILES string first."; return }
        guard trimmed.range(of: #"\s"#, options: .regularExpression) == nil else { errorMessage = "SMILES should not contain spaces."; return }
        errorMessage = nil
        selectedMolecule = MoleculeSummary(name: "SMILES Structure", canonicalSMILES: trimmed, source: .smiles)
    }

    private func copySmiles() {
#if os(macOS)
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(smiles, forType: .string)
#else
        UIPasteboard.general.string = smiles
#endif
    }
}
