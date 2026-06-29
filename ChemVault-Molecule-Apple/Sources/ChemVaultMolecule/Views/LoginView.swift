import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 22) {
            VStack(spacing: 12) {
                Image(systemName: "atom")
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(AppTheme.brand)
                    .frame(width: 72, height: 72)
                    .background(AppTheme.brand.opacity(0.10), in: RoundedRectangle(cornerRadius: 16))
                Text("ChemVault Molecule")
                    .font(.largeTitle.weight(.semibold))
                Text("Native molecule search, drawing, PDB loading, local library, and 3D viewing for Apple platforms.")
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: 520)
            }

            CVPanel("Account Access", subtitle: "Sign in for account-linked permissions, or continue with the available free workspace.") {
                TextField("Email", text: $email)
                    .textContentType(.emailAddress)
#if !os(macOS)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
#endif
                    .textFieldStyle(.roundedBorder)
                SecureField("Password", text: $password)
                    .textContentType(.password)
                    .textFieldStyle(.roundedBorder)

                if let errorMessage { InlineErrorView(message: errorMessage) }

                Button {
                    Task { await login() }
                } label: {
                    LoadingButtonLabel(title: "Sign In", isLoading: isLoading)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(isLoading)

                Button("Continue in Free Mode") {
                    appState.continueInFreeMode()
                }
                .buttonStyle(.bordered)

                Link("Open ChemVault User Portal", destination: appState.config.userAPIBaseURL)
                    .font(.callout)
            }
            .frame(maxWidth: 420)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppTheme.workspaceBackground)
    }

    private func login() async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            try await appState.login(email: email, password: password)
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
