import SwiftUI
import SceneKit
import simd

#if os(macOS)
import AppKit
#else
import UIKit
#endif

enum MoleculeDisplayMode: String, CaseIterable, Identifiable {
    case ballAndStick
    case spaceFilling
    case stick

    var id: String { rawValue }
    var title: String {
        switch self {
        case .ballAndStick: "Ball and Stick"
        case .spaceFilling: "Sphere"
        case .stick: "Stick"
        }
    }
}

enum MoleculeViewerBackground: String, CaseIterable, Identifiable {
    case system
    case light
    case dark

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

struct NativeMolecule3DView: View {
    var model: Molecule3DModel
    var displayMode: MoleculeDisplayMode
    var background: MoleculeViewerBackground

    var body: some View {
        SceneKitMoleculeView(model: model, displayMode: displayMode, background: background)
            .overlay(alignment: .bottomLeading) {
                if model.atoms.isEmpty {
                    Text("No 3D structure loaded")
                        .padding(10)
                        .background(.thinMaterial, in: Capsule())
                        .padding()
                }
            }
    }
}

#if os(macOS)
struct SceneKitMoleculeView: NSViewRepresentable {
    var model: Molecule3DModel
    var displayMode: MoleculeDisplayMode
    var background: MoleculeViewerBackground

    func makeNSView(context: Context) -> SCNView { makeView() }
    func updateNSView(_ view: SCNView, context: Context) { configure(view) }
}
#else
struct SceneKitMoleculeView: UIViewRepresentable {
    var model: Molecule3DModel
    var displayMode: MoleculeDisplayMode
    var background: MoleculeViewerBackground

    func makeUIView(context: Context) -> SCNView { makeView() }
    func updateUIView(_ view: SCNView, context: Context) { configure(view) }
}
#endif

extension SceneKitMoleculeView {
    func makeView() -> SCNView {
        let view = SCNView()
        view.allowsCameraControl = true
        view.autoenablesDefaultLighting = false
        view.antialiasingMode = .multisampling4X
        configure(view)
        return view
    }

    func configure(_ view: SCNView) {
        let scene = SCNScene()
        scene.rootNode.addChildNode(cameraNode(for: model))
        scene.rootNode.addChildNode(lightNode())
        scene.rootNode.addChildNode(ambientLightNode())
        addMolecule(model, to: scene.rootNode)
        view.scene = scene
        view.backgroundColor = nsuiColor(for: background)
    }

    private func addMolecule(_ model: Molecule3DModel, to root: SCNNode) {
        let center = moleculeCenter(model)
        for bond in model.bonds {
            guard let a = model.atoms.first(where: { $0.id == bond.atom1 }), let b = model.atoms.first(where: { $0.id == bond.atom2 }) else { continue }
            root.addChildNode(bondNode(from: a, to: b, center: center))
        }
        if displayMode != .stick {
            for atom in model.atoms { root.addChildNode(atomNode(atom, center: center)) }
        }
    }

    private func atomNode(_ atom: Atom3D, center: SIMD3<Float>) -> SCNNode {
        let radius: CGFloat = displayMode == .spaceFilling ? CGFloat(vdwRadius(atom.element)) : 0.22
        let sphere = SCNSphere(radius: radius)
        sphere.segmentCount = 24
        sphere.firstMaterial?.diffuse.contents = nsuiColor(forElement: atom.element)
        let node = SCNNode(geometry: sphere)
        node.position = SCNVector3(Float(atom.x) - center.x, Float(atom.y) - center.y, Float(atom.z) - center.z)
        return node
    }

    private func bondNode(from a: Atom3D, to b: Atom3D, center: SIMD3<Float>) -> SCNNode {
        let start = SIMD3<Float>(Float(a.x), Float(a.y), Float(a.z)) - center
        let end = SIMD3<Float>(Float(b.x), Float(b.y), Float(b.z)) - center
        let vector = end - start
        let length = simd_length(vector)
        let cylinder = SCNCylinder(radius: displayMode == .stick ? 0.08 : 0.055, height: CGFloat(length))
        cylinder.firstMaterial?.diffuse.contents = nsuiColor(forElement: "C")
        let node = SCNNode(geometry: cylinder)
        node.position = SCNVector3((start + end) / 2)
        if length > 0 {
            node.simdOrientation = simd_quatf(from: SIMD3<Float>(0, 1, 0), to: simd_normalize(vector))
        }
        return node
    }

    private func cameraNode(for model: Molecule3DModel) -> SCNNode {
        let node = SCNNode()
        let camera = SCNCamera()
        camera.zFar = 1000
        node.camera = camera
        let span = max(moleculeSpan(model), 6)
        node.position = SCNVector3(0, 0, span * 2.3)
        return node
    }

    private func lightNode() -> SCNNode {
        let node = SCNNode()
        node.light = SCNLight()
        node.light?.type = .omni
        node.light?.intensity = 900
        node.position = SCNVector3(4, 8, 10)
        return node
    }

    private func ambientLightNode() -> SCNNode {
        let node = SCNNode()
        node.light = SCNLight()
        node.light?.type = .ambient
        node.light?.intensity = 320
        return node
    }

    private func moleculeCenter(_ model: Molecule3DModel) -> SIMD3<Float> {
        guard !model.atoms.isEmpty else { return .zero }
        let sum = model.atoms.reduce(SIMD3<Float>.zero) { $0 + SIMD3<Float>(Float($1.x), Float($1.y), Float($1.z)) }
        return sum / Float(model.atoms.count)
    }

    private func moleculeSpan(_ model: Molecule3DModel) -> Float {
        guard !model.atoms.isEmpty else { return 6 }
        let center = moleculeCenter(model)
        return max(6, model.atoms.map { simd_length(SIMD3<Float>(Float($0.x), Float($0.y), Float($0.z)) - center) }.max() ?? 6)
    }

    private func vdwRadius(_ element: String) -> Double {
        switch element.capitalized {
        case "H": 0.28
        case "C": 0.45
        case "N": 0.42
        case "O": 0.40
        case "S": 0.52
        case "P": 0.52
        default: 0.46
        }
    }
}

extension SCNVector3 {
    init(_ vector: SIMD3<Float>) { self.init(vector.x, vector.y, vector.z) }
}

#if os(macOS)
typealias PlatformColor = NSColor
#else
typealias PlatformColor = UIColor
#endif

func nsuiColor(for background: MoleculeViewerBackground) -> PlatformColor {
    switch background {
    case .system: return PlatformColor.controlBackgroundColorCompat
    case .light: return PlatformColor.white
    case .dark: return PlatformColor.black
    }
}

func nsuiColor(forElement element: String) -> PlatformColor {
    switch element.capitalized {
    case "C": return PlatformColor.darkGray
    case "H": return PlatformColor.white
    case "O": return PlatformColor.red
    case "N": return PlatformColor.blue
    case "S": return PlatformColor.yellow
    case "P": return PlatformColor.orange
    case "F", "Cl": return PlatformColor.green
    case "Br": return PlatformColor.brown
    case "I": return PlatformColor.purple
    default: return PlatformColor.gray
    }
}

extension PlatformColor {
    static var controlBackgroundColorCompat: PlatformColor {
#if os(macOS)
        .controlBackgroundColor
#else
        .systemBackground
#endif
    }
}
