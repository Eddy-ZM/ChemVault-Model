import SwiftUI

struct NativeSketchCanvas: View {
    @Binding var graph: MoleculeGraph
    @Binding var selectedTool: DrawTool
    @Binding var activeElement: String
    var onCommit: (MoleculeGraph) -> Void

    @State private var dragStartAtomID: UUID?
    @State private var previewPoint: CGPoint?

    var body: some View {
        GeometryReader { proxy in
            Canvas { context, size in
                drawGrid(context: context, size: size)
                for bond in graph.bonds { drawBond(bond, context: context) }
                if let startID = dragStartAtomID, let start = graph.atoms.first(where: { $0.id == startID }), let previewPoint {
                    var path = Path()
                    path.move(to: CGPoint(x: start.x, y: start.y))
                    path.addLine(to: previewPoint)
                    context.stroke(path, with: .color(.blue.opacity(0.45)), lineWidth: 2)
                }
                for atom in graph.atoms { drawAtom(atom, context: context) }
            }
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
            .gesture(
                DragGesture(minimumDistance: 0)
                    .onChanged { value in
                        let location = clamp(value.location, in: proxy.size)
                        if dragStartAtomID == nil { dragStartAtomID = atom(at: location)?.id }
                        if dragStartAtomID != nil { previewPoint = location }
                    }
                    .onEnded { value in
                        let location = clamp(value.location, in: proxy.size)
                        handleInteraction(at: location)
                        dragStartAtomID = nil
                        previewPoint = nil
                    }
            )
        }
        .frame(minHeight: 360)
    }

    private func handleInteraction(at point: CGPoint) {
        if selectedTool == .erase {
            if let hit = atom(at: point) { removeAtom(hit.id); return }
            if let hit = bond(at: point) { graph.bonds.removeAll { $0.id == hit.id }; onCommit(graph); return }
        }

        if selectedTool == .atom, let hit = atom(at: point) {
            if let index = graph.atoms.firstIndex(where: { $0.id == hit.id }) { graph.atoms[index].element = activeElement; onCommit(graph) }
            return
        }

        if selectedTool == .bond || selectedTool == .select, let startID = dragStartAtomID, let start = graph.atoms.first(where: { $0.id == startID }) {
            let distance = hypot(point.x - start.x, point.y - start.y)
            if distance > 18 {
                let endAtom: SketchAtom
                if let existing = atom(at: point, excluding: startID) {
                    endAtom = existing
                } else {
                    endAtom = SketchAtom(element: activeElement, x: point.x, y: point.y)
                    graph.atoms.append(endAtom)
                }
                if !graph.bonds.contains(where: { ($0.atom1 == startID && $0.atom2 == endAtom.id) || ($0.atom1 == endAtom.id && $0.atom2 == startID) }) {
                    graph.bonds.append(SketchBond(atom1: startID, atom2: endAtom.id, order: 1))
                }
                onCommit(graph)
                return
            }
        }

        if let hitBond = bond(at: point), selectedTool == .select || selectedTool == .bond {
            if let index = graph.bonds.firstIndex(where: { $0.id == hitBond.id }) { graph.bonds[index].order = graph.bonds[index].order % 3 + 1; onCommit(graph) }
            return
        }

        if selectedTool == .atom || selectedTool == .select {
            graph.atoms.append(SketchAtom(element: activeElement, x: point.x, y: point.y))
            onCommit(graph)
        }
    }

    private func drawGrid(context: GraphicsContext, size: CGSize) {
        var path = Path()
        stride(from: 0, through: size.width, by: 28).forEach { x in path.move(to: CGPoint(x: x, y: 0)); path.addLine(to: CGPoint(x: x, y: size.height)) }
        stride(from: 0, through: size.height, by: 28).forEach { y in path.move(to: CGPoint(x: 0, y: y)); path.addLine(to: CGPoint(x: size.width, y: y)) }
        context.stroke(path, with: .color(.secondary.opacity(0.12)), lineWidth: 1)
    }

    private func drawAtom(_ atom: SketchAtom, context: GraphicsContext) {
        let rect = CGRect(x: atom.x - 17, y: atom.y - 17, width: 34, height: 34)
        context.fill(Path(ellipseIn: rect), with: .color(.white))
        context.stroke(Path(ellipseIn: rect), with: .color(.primary.opacity(0.65)), lineWidth: 1.5)
        context.draw(Text(atom.element).font(.headline.weight(.semibold)), at: CGPoint(x: atom.x, y: atom.y))
    }

    private func drawBond(_ bond: SketchBond, context: GraphicsContext) {
        guard let a = graph.atoms.first(where: { $0.id == bond.atom1 }), let b = graph.atoms.first(where: { $0.id == bond.atom2 }) else { return }
        let start = CGPoint(x: a.x, y: a.y)
        let end = CGPoint(x: b.x, y: b.y)
        let dx = end.x - start.x
        let dy = end.y - start.y
        let length = max(1, hypot(dx, dy))
        let offset = CGPoint(x: -dy / length * 4, y: dx / length * 4)
        for line in 0..<bond.order {
            let multiplier = Double(line) - Double(bond.order - 1) / 2.0
            var path = Path()
            path.move(to: CGPoint(x: start.x + offset.x * multiplier, y: start.y + offset.y * multiplier))
            path.addLine(to: CGPoint(x: end.x + offset.x * multiplier, y: end.y + offset.y * multiplier))
            context.stroke(path, with: .color(.primary), lineWidth: 2)
        }
    }

    private func atom(at point: CGPoint, excluding id: UUID? = nil) -> SketchAtom? {
        graph.atoms.first { $0.id != id && hypot($0.x - point.x, $0.y - point.y) < 24 }
    }

    private func bond(at point: CGPoint) -> SketchBond? {
        graph.bonds.first { bond in
            guard let a = graph.atoms.first(where: { $0.id == bond.atom1 }), let b = graph.atoms.first(where: { $0.id == bond.atom2 }) else { return false }
            return distance(point, toSegmentStart: CGPoint(x: a.x, y: a.y), end: CGPoint(x: b.x, y: b.y)) < 10
        }
    }

    private func removeAtom(_ id: UUID) {
        graph.atoms.removeAll { $0.id == id }
        graph.bonds.removeAll { $0.atom1 == id || $0.atom2 == id }
        onCommit(graph)
    }

    private func clamp(_ point: CGPoint, in size: CGSize) -> CGPoint {
        CGPoint(x: min(max(point.x, 20), size.width - 20), y: min(max(point.y, 20), size.height - 20))
    }

    private func distance(_ point: CGPoint, toSegmentStart start: CGPoint, end: CGPoint) -> CGFloat {
        let dx = end.x - start.x
        let dy = end.y - start.y
        let lengthSquared = dx * dx + dy * dy
        if lengthSquared == 0 { return hypot(point.x - start.x, point.y - start.y) }
        let t = max(0, min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared))
        let projection = CGPoint(x: start.x + t * dx, y: start.y + t * dy)
        return hypot(point.x - projection.x, point.y - projection.y)
    }
}
