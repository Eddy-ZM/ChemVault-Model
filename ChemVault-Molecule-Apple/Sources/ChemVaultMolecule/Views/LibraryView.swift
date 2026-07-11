import SwiftUI
import UniformTypeIdentifiers

struct LibraryView: View {
    @Environment(AppState.self) private var appState
    @State private var showImporter = false
    @State private var errorMessage: String?
    @State private var selectedMolecule: MoleculeSummary?

    var body: some View {
        WorkspaceScreen(
            title: "Molecule Library",
            subtitle: "Import local structures and reopen molecules saved from native detail views.",
            systemImage: "tray.full"
        ) {
            CVPanel("File Import", subtitle: "Import a supported structure file into the native 3D detail view.") {
                HStack {
                    Button("Import Structure File") { showImporter = true }
                        .buttonStyle(.borderedProminent)
                        .disabled(!appState.permissions.allows(.upload))
                    StatusPill(
                        title: appState.permissions.allows(.upload) ? "Upload enabled" : "Upload locked",
                        systemImage: appState.permissions.allows(.upload) ? "checkmark.seal" : "lock",
                        tint: appState.permissions.allows(.upload) ? .green : .secondary
                    )
                }

                if !appState.permissions.allows(.upload) {
                    Text("File import requires molecule.upload permission. Saved molecules remain available locally.")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            if let errorMessage { InlineErrorView(message: errorMessage) }

            CVPanel("Saved Molecules", subtitle: "Local molecules saved from Search, SMILES, Draw, Upload, or PDB workflows.") {
                if appState.libraryStore.projects.isEmpty {
                    EmptyStateBlock(
                        title: "No Saved Molecules",
                        message: "Save molecules from detail pages to build a local working set on this device.",
                        systemImage: "tray"
                    )
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(appState.libraryStore.projects) { project in
                            Button {
                                selectedMolecule = project.summary
                            } label: {
                                LibraryProjectRow(project: project)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                Button("Delete", role: .destructive) {
                                    appState.libraryStore.delete(project)
                                }
                            }
                        }
                    }
                }
            }
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: supportedImportTypes,
            allowsMultipleSelection: false
        ) { result in
            handleImport(result)
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private var supportedImportTypes: [UTType] {
        [.plainText, .data] + ["mol", "sdf", "xyz", "pdb", "smi", "smiles"].compactMap {
            UTType(filenameExtension: $0)
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
                selectedMolecule = MoleculeSummary(
                    name: url.deletingPathExtension().lastPathComponent,
                    canonicalSMILES: smiles,
                    source: .upload,
                    fileName: url.lastPathComponent
                )
            case .model(let model, let format, let raw):
                selectedMolecule = MoleculeSummary(
                    name: url.deletingPathExtension().lastPathComponent,
                    source: .upload,
                    structureData: raw,
                    structureFormat: format,
                    fileName: url.lastPathComponent,
                    model: model
                )
            }
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct LibraryProjectRow: View {
    let project: MoleculeProject

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon(for: project.summary.source))
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
                .frame(width: 36, height: 36)
                .background(AppTheme.brand.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text(project.summary.name)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                Text(project.summary.canonicalSMILES ?? project.summary.pdbID ?? project.summary.fileName ?? project.summary.source.rawValue)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(project.savedAt, style: .date)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(AppTheme.panelBackground.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.subtleStroke))
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
