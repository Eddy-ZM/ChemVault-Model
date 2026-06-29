import SwiftUI

struct DrawView: View {
    @Environment(AppState.self) private var appState
    @State private var graph = MoleculeGraph()
    @State private var undoStack: [MoleculeGraph] = []
    @State private var redoStack: [MoleculeGraph] = []
    @State private var selectedTool: DrawTool = .select
    @State private var activeElement = "C"
    @State private var message = "Click to place atoms. Drag from an atom to create a bond."
    @State private var selectedMolecule: MoleculeSummary?

    var body: some View {
        Group {
            if !appState.permissions.allows(.drawAccess) {
                PermissionLockedView(permission: .drawAccess, requiredTier: .free)
            } else {
                WorkspaceScreen(
                    title: "Native Sketcher",
                    subtitle: "Create a basic 2D molecular graph, generate SMILES, and open the native 3D viewer.",
                    systemImage: "pencil.and.outline"
                ) {
                    ViewThatFits(in: .horizontal) {
                        HStack(alignment: .top, spacing: 16) {
                            sketchArea
                            controls.frame(width: 300)
                        }
                        VStack(spacing: 16) {
                            sketchArea
                            controls
                        }
                    }
                }
            }
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private var sketchArea: some View {
        CVPanel("Canvas", subtitle: "\(graph.atoms.count) atoms, \(graph.bonds.count) bonds") {
            NativeSketchCanvas(graph: $graph, selectedTool: $selectedTool, activeElement: $activeElement) { next in
                undoStack.append(graph)
                redoStack.removeAll()
                graph = next
            }
            Text(message).font(.callout).foregroundStyle(.secondary)
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 14) {
            CVPanel("Tools") {
                DrawingToolbar(selectedTool: $selectedTool)
                HStack {
                    Button("Undo") { undo() }.disabled(undoStack.isEmpty)
                    Button("Redo") { redo() }.disabled(redoStack.isEmpty)
                    Button("Clear", role: .destructive) { clear() }
                }
                .buttonStyle(.bordered)
            }

            CVPanel("Elements") {
                ElementPicker(activeElement: $activeElement)
            }

            CVPanel("Generated SMILES") {
                Text(graph.generateSMILES() ?? "SMILES is not available for this sketch. Use Search, SMILES, or Import for complex structures.")
                    .font(.body.monospaced())
                    .textSelection(.enabled)
                    .foregroundStyle(graph.generateSMILES() == nil ? .secondary : .primary)
                Button("Generate 3D Model") { generate3D() }
                    .buttonStyle(.borderedProminent)
                    .disabled(graph.generateSMILES()?.isEmpty ?? true)
            }
        }
    }

    private func undo() {
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(graph)
        graph = previous
    }

    private func redo() {
        guard let next = redoStack.popLast() else { return }
        undoStack.append(graph)
        graph = next
    }

    private func clear() {
        undoStack.append(graph)
        graph = MoleculeGraph()
        redoStack.removeAll()
    }

    private func generate3D() {
        guard let smiles = graph.generateSMILES(), !smiles.isEmpty else {
            message = "SMILES is not available for this drawing. Use Search, SMILES, or Import for complex structures."
            return
        }
        selectedMolecule = MoleculeSummary(name: "Drawn Molecule", canonicalSMILES: smiles, source: .draw)
    }
}

struct DrawingToolbar: View {
    @Binding var selectedTool: DrawTool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 82))], spacing: 8) {
                ForEach(DrawTool.allCases) { tool in
                    Button(tool.rawValue) { selectedTool = tool }
                        .buttonStyle(.bordered)
                        .tint(selectedTool == tool ? AppTheme.brand : .secondary)
                }
            }
        }
    }
}
