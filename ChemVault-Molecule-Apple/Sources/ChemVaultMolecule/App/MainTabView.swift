import SwiftUI

enum AppSection: String, CaseIterable, Identifiable, Hashable {
    case search = "Search"
    case smiles = "SMILES"
    case draw = "Draw"
    case pdb = "PDB"
    case library = "Library"
    case account = "Account"

    var id: String { rawValue }

    var systemImage: String {
        switch self {
        case .search: "magnifyingglass"
        case .smiles: "textformat.abc"
        case .draw: "pencil.and.outline"
        case .pdb: "atom"
        case .library: "tray.full"
        case .account: "person.crop.circle"
        }
    }

    var subtitle: String {
        switch self {
        case .search: "PubChem lookup"
        case .smiles: "Notation input"
        case .draw: "Native sketcher"
        case .pdb: "RCSB structure"
        case .library: "Local workspace"
        case .account: "Access and quota"
        }
    }

    @ViewBuilder
    var content: some View {
        switch self {
        case .search: SearchView()
        case .smiles: SmilesInputView()
        case .draw: DrawView()
        case .pdb: PDBView()
        case .library: LibraryView()
        case .account: AccountView()
        }
    }
}

struct MainTabView: View {
    @Environment(AppState.self) private var appState
#if !os(macOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
#endif
    @State private var selection: AppSection = .search

    private var sections: [AppSection] {
        let visibleSections = AppSection.allCases.filter(appState.remoteConfig.isSectionEnabled)
        return visibleSections.isEmpty ? AppSection.allCases : visibleSections
    }

    var body: some View {
        Group {
#if os(macOS)
            SidebarMainView(selection: $selection, sections: sections)
#else
            if horizontalSizeClass == .regular {
                SidebarMainView(selection: $selection, sections: sections)
            } else {
                PhoneTabMainView(selection: $selection, sections: sections)
            }
#endif
        }
        .onAppear(perform: normalizeSelection)
        .onChange(of: appState.remoteConfig.enabledModuleIDs) { _ in
            normalizeSelection()
        }
    }

    private func normalizeSelection() {
        if !sections.contains(selection) {
            selection = sections.first ?? .search
        }
    }
}

private struct PhoneTabMainView: View {
    @Binding var selection: AppSection
    let sections: [AppSection]

    var body: some View {
        TabView(selection: $selection) {
            ForEach(sections) { section in
                NavigationStack {
                    section.content
                        .navigationTitle(section.rawValue)
                }
                .tabItem { Label(section.rawValue, systemImage: section.systemImage) }
                .tag(section)
            }
        }
    }
}

private struct SidebarMainView: View {
    @Binding var selection: AppSection
    let sections: [AppSection]

    var body: some View {
        NavigationSplitView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ChemVault")
                        .font(.title3.weight(.semibold))
                    Text("Molecule Studio")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.horizontal, 16)
                .padding(.top, 16)

                sectionList
                .listStyle(.sidebar)
            }
            .background(AppTheme.workspaceBackground)
        } detail: {
            NavigationStack {
                selection.content
                    .navigationTitle(selection.rawValue)
            }
        }
    }

    @ViewBuilder
    private var sectionList: some View {
#if os(macOS)
        List(sections, selection: $selection) { section in
            NavigationRow(section: section)
                .tag(section)
        }
#else
        List(sections) { section in
            Button {
                selection = section
            } label: {
                NavigationRow(section: section)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
            .listRowBackground(
                selection == section ? Color.accentColor.opacity(0.12) : Color.clear
            )
        }
#endif
    }
}

private struct NavigationRow: View {
    let section: AppSection

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(section.rawValue)
                    .font(.subheadline.weight(.medium))
                Text(section.subtitle)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: section.systemImage)
        }
    }
}
