import Foundation
import Observation

@MainActor
@Observable
final class LibraryStore {
    private let storageKey = "chemvault.molecule.localLibrary"
    var projects: [MoleculeProject] = []

    func load() {
        guard let data = UserDefaults.standard.data(forKey: storageKey) else { return }
        projects = (try? JSONDecoder().decode([MoleculeProject].self, from: data)) ?? []
    }

    func save(_ summary: MoleculeSummary) {
        if !projects.contains(where: { $0.summary.canonicalSMILES == summary.canonicalSMILES && $0.summary.name == summary.name }) {
            projects.insert(MoleculeProject(summary: summary), at: 0)
        }
        persist()
    }

    func delete(_ project: MoleculeProject) {
        projects.removeAll { $0.id == project.id }
        persist()
    }

    private func persist() {
        guard let data = try? JSONEncoder().encode(projects) else { return }
        UserDefaults.standard.set(data, forKey: storageKey)
    }
}
