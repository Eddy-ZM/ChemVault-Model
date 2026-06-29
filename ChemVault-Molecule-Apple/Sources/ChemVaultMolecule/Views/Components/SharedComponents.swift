import SwiftUI

struct PermissionLockedView: View {
    let permission: MoleculePermission
    let requiredTier: MembershipTier
    @Environment(AppState.self) private var appState

    var body: some View {
        ContentUnavailableView {
            Label("Permission Required", systemImage: "lock.fill")
        } description: {
            Text("This feature requires \(requiredTier.rawValue) access or the permission `\(permission.rawValue)`.")
        } actions: {
            Link("Open User Portal", destination: appState.config.userAPIBaseURL)
        }
        .padding()
    }
}

struct InlineErrorView: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.triangle")
            .font(.callout)
            .foregroundStyle(.red)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
    }
}

struct LoadingButtonLabel: View {
    let title: String
    let isLoading: Bool

    var body: some View {
        HStack {
            if isLoading { ProgressView().controlSize(.small) }
            Text(title)
        }
    }
}

struct DetailRow: View {
    let title: String
    let value: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value?.isEmpty == false ? value! : "N/A")
                .font(.body.monospaced())
                .textSelection(.enabled)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(AppTheme.panelBackground.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.subtleStroke))
    }
}

extension Double {
    var chemFormatted: String { formatted(.number.precision(.fractionLength(0...4))) }
}
