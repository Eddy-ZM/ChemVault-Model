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
#if !os(macOS)
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
#endif
    @State private var selection: AppSection = .search

    var body: some View {
#if os(macOS)
        SidebarMainView(selection: $selection)
#else
        if horizontalSizeClass == .regular {
            SidebarMainView(selection: $selection)
        } else {
            PhoneTabMainView(selection: $selection)
        }
#endif
    }
}

private struct PhoneTabMainView: View {
    @Binding var selection: AppSection

    var body: some View {
        TabView(selection: $selection) {
            ForEach(AppSection.allCases) { section in
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

    var body: some View {
        NavigationSplitView {
            List(AppSection.allCases, selection: $selection) { section in
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
