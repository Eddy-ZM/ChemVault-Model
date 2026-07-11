import XCTest
@testable import ChemVaultMolecule

final class StructureParserTests: XCTestCase {
    func testXYZParserBuildsWaterGeometryAndBonds() throws {
        let model = try XYZParser().parse("""
        3
        water
        O 0.000000 0.000000 0.000000
        H 0.000000 0.757000 0.586000
        H 0.000000 -0.757000 0.586000
        """)

        XCTAssertEqual(model.atoms.count, 3)
        XCTAssertEqual(model.bonds.count, 2)
        XCTAssertEqual(model.atoms.first?.element, "O")
    }

    func testXYZParserRejectsMissingCoordinates() {
        XCTAssertThrowsError(try XYZParser().parse("3\nwater\nO 0 0 0"))
    }

    func testBondEstimatorSkipsVeryLargeStructures() {
        let atoms = (0..<251).map { Atom3D(element: "C", x: Double($0), y: 0, z: 0) }
        XCTAssertTrue(BondEstimator.estimateBonds(atoms: atoms).isEmpty)
    }
}
