import SwiftUI

struct ElementPicker: View {
    @Binding var activeElement: String
    @State private var showPeriodicTable = false

    private let common = ["C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I"]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 48))], spacing: 8) {
                ForEach(common, id: \.self) { element in
                    Button(element) { activeElement = element }
                        .buttonStyle(.bordered)
                        .tint(activeElement == element ? AppTheme.brand : .secondary)
                }
                Button("Table") { showPeriodicTable = true }.buttonStyle(.borderedProminent)
            }
        }
        .sheet(isPresented: $showPeriodicTable) {
            PeriodicTableView(activeElement: $activeElement)
        }
    }
}

struct PeriodicElement: Identifiable, Hashable {
    var atomicNumber: Int
    var symbol: String
    var name: String
    var id: Int { atomicNumber }
}

struct PeriodicTableView: View {
    @Binding var activeElement: String
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    private let elements: [PeriodicElement] = [
        .init(atomicNumber: 1, symbol: "H", name: "Hydrogen"), .init(atomicNumber: 2, symbol: "He", name: "Helium"),
        .init(atomicNumber: 3, symbol: "Li", name: "Lithium"), .init(atomicNumber: 4, symbol: "Be", name: "Beryllium"),
        .init(atomicNumber: 5, symbol: "B", name: "Boron"), .init(atomicNumber: 6, symbol: "C", name: "Carbon"),
        .init(atomicNumber: 7, symbol: "N", name: "Nitrogen"), .init(atomicNumber: 8, symbol: "O", name: "Oxygen"),
        .init(atomicNumber: 9, symbol: "F", name: "Fluorine"), .init(atomicNumber: 10, symbol: "Ne", name: "Neon"),
        .init(atomicNumber: 11, symbol: "Na", name: "Sodium"), .init(atomicNumber: 12, symbol: "Mg", name: "Magnesium"),
        .init(atomicNumber: 13, symbol: "Al", name: "Aluminium"), .init(atomicNumber: 14, symbol: "Si", name: "Silicon"),
        .init(atomicNumber: 15, symbol: "P", name: "Phosphorus"), .init(atomicNumber: 16, symbol: "S", name: "Sulfur"),
        .init(atomicNumber: 17, symbol: "Cl", name: "Chlorine"), .init(atomicNumber: 18, symbol: "Ar", name: "Argon"),
        .init(atomicNumber: 19, symbol: "K", name: "Potassium"), .init(atomicNumber: 20, symbol: "Ca", name: "Calcium"),
        .init(atomicNumber: 21, symbol: "Sc", name: "Scandium"), .init(atomicNumber: 22, symbol: "Ti", name: "Titanium"),
        .init(atomicNumber: 23, symbol: "V", name: "Vanadium"), .init(atomicNumber: 24, symbol: "Cr", name: "Chromium"),
        .init(atomicNumber: 25, symbol: "Mn", name: "Manganese"), .init(atomicNumber: 26, symbol: "Fe", name: "Iron"),
        .init(atomicNumber: 27, symbol: "Co", name: "Cobalt"), .init(atomicNumber: 28, symbol: "Ni", name: "Nickel"),
        .init(atomicNumber: 29, symbol: "Cu", name: "Copper"), .init(atomicNumber: 30, symbol: "Zn", name: "Zinc"),
        .init(atomicNumber: 31, symbol: "Ga", name: "Gallium"), .init(atomicNumber: 32, symbol: "Ge", name: "Germanium"),
        .init(atomicNumber: 33, symbol: "As", name: "Arsenic"), .init(atomicNumber: 34, symbol: "Se", name: "Selenium"),
        .init(atomicNumber: 35, symbol: "Br", name: "Bromine"), .init(atomicNumber: 36, symbol: "Kr", name: "Krypton")
    ]

    private var filtered: [PeriodicElement] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return elements }
        return elements.filter { $0.symbol.lowercased().contains(q) || $0.name.lowercased().contains(q) || String($0.atomicNumber) == q }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 86), spacing: 10)], spacing: 10) {
                    ForEach(filtered) { element in
                        Button {
                            activeElement = element.symbol
                            dismiss()
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("\(element.atomicNumber)").font(.caption2).foregroundStyle(.secondary)
                                Text(element.symbol).font(.title3.bold())
                                Text(element.name).font(.caption).lineLimit(1)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(10)
                        }
                        .buttonStyle(.bordered)
                    }
                }
                .padding()
            }
            .searchable(text: $query, prompt: "Symbol or name")
            .navigationTitle("Periodic Table")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}
