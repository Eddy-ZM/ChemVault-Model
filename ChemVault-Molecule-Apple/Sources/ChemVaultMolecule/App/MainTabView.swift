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
            List(sections, selection: $selection) { section in
                Label(section.rawValue, systemImage: section.systemImage)
                    .tag(section)
            }
            .navigationTitle("ChemVault")
        } detail: {
            NavigationStack {
                selection.content
                    .navigationTitle(selection.rawValue)
            }
        }
    }
}
