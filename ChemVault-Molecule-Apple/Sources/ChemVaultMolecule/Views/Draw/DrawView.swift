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
                ViewThatFits {
                    HStack(alignment: .top, spacing: 16) { sketchArea; controls.frame(width: 260) }
                    VStack(spacing: 16) { sketchArea; controls }
                }
                .padding()
            }
        }
        .navigationDestination(item: $selectedMolecule) { summary in
            MoleculeDetailView(summary: summary)
        }
    }

    private var sketchArea: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Native 2D Sketcher").font(.title2.bold())
            NativeSketchCanvas(graph: $graph, selectedTool: $selectedTool, activeElement: $activeElement) { next in
                undoStack.append(graph)
                redoStack.removeAll()
                graph = next
            }
            Text(message).font(.callout).foregroundStyle(.secondary)
        }
    }

    private var controls: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                DrawingToolbar(selectedTool: $selectedTool)
                ElementPicker(activeElement: $activeElement)
                HStack {
                    Button("Undo") { undo() }.disabled(undoStack.isEmpty)
                    Button("Redo") { redo() }.disabled(redoStack.isEmpty)
                    Button("Clear", role: .destructive) { clear() }
                }
                .buttonStyle(.bordered)

                VStack(alignment: .leading, spacing: 8) {
                    Text("Generated SMILES").font(.headline)
                    Text(graph.generateSMILES() ?? "SMILES generation is under development for this structure.")
                        .font(.body.monospaced())
                        .textSelection(.enabled)
                        .foregroundStyle(graph.generateSMILES() == nil ? .secondary : .primary)
                    Button("Generate 3D Model") { generate3D() }
                        .buttonStyle(.borderedProminent)
                }
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
            message = "SMILES generation is under development for this drawing. Use Search or SMILES for now."
            return
        }
        selectedMolecule = MoleculeSummary(name: "Drawn Molecule", canonicalSMILES: smiles, source: .draw)
    }
}

struct DrawingToolbar: View {
    @Binding var selectedTool: DrawTool

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tools").font(.headline)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 82))], spacing: 8) {
                ForEach(DrawTool.allCases) { tool in
                    Button(tool.rawValue) { selectedTool = tool }
                        .buttonStyle(.bordered)
                        .tint(selectedTool == tool ? .blue : .secondary)
                }
            }
        }
    }
}
