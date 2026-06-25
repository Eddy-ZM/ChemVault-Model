import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    @Environment(AppState.self) private var appState
    @State private var showImporter = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    var body: some View {
        List {
            Section("File Import") {
                Button("Import Structure File") { showImporter = true }
                    .disabled(!appState.permissions.allows(.upload))
                if !appState.permissions.allows(.upload) {
                    Text("File upload requires molecule.upload permission. Local text import can be enabled once your account has access.")
                        .foregroundStyle(.secondary)
                }
            }

            if let errorMessage { Section { InlineErrorView(message: errorMessage) } }

            Section("Saved Molecules") {
                if appState.libraryStore.projects.isEmpty {
                    ContentUnavailableView("No Saved Molecules", systemImage: "tray", description: Text("Save molecules from detail pages to build a local library."))
                } else {
                    ForEach(appState.libraryStore.projects) { project in
                        Button {
                            selectedMolecule = project.summary
                        } label: {
                            VStack(alignment: .leading) {
                                Text(project.summary.name)
                                Text(project.summary.canonicalSMILES ?? project.summary.pdbID ?? project.summary.source.rawValue)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }
                    }
                    .onDelete { indexSet in
                        for index in indexSet { appState.libraryStore.delete(appState.libraryStore.projects[index]) }
                    }
                }
            }
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: [.plainText, .data, UTType(filenameExtension: "mol")!, UTType(filenameExtension: "sdf")!, UTType(filenameExtension: "xyz")!, UTType(filenameExtension: "pdb")!],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result)
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private func handleImport(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            guard url.startAccessingSecurityScopedResource() else { throw ChemVaultError.missingData("Could not access selected file.") }
            defer { url.stopAccessingSecurityScopedResource() }
            let data = try Data(contentsOf: url)
            switch try StructureParser().parseImportedFile(name: url.lastPathComponent, data: data) {
            case .smiles(let smiles):
                selectedMolecule = MoleculeSummary(name: url.deletingPathExtension().lastPathComponent, canonicalSMILES: smiles, source: .upload, fileName: url.lastPathComponent)
            case .model(let model, let format, let raw):
                selectedMolecule = MoleculeSummary(name: url.deletingPathExtension().lastPathComponent, source: .upload, structureData: raw, structureFormat: format, fileName: url.lastPathComponent, model: model)
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
