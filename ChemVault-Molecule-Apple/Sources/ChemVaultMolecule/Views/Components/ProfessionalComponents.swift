import SwiftUI

enum AppTheme {
    static let maxContentWidth: CGFloat = 1180
    static let panelRadius: CGFloat = 14

    static var workspaceBackground: Color {
#if os(macOS)
        Color(nsColor: .windowBackgroundColor)
#else
        Color(uiColor: .systemGroupedBackground)
#endif
    }

    static var panelBackground: Color {
#if os(macOS)
        Color(nsColor: .controlBackgroundColor)
#else
        Color(uiColor: .secondarySystemGroupedBackground)
#endif
    }

    static var subtleStroke: Color {
#if os(macOS)
        Color(nsColor: .separatorColor).opacity(0.55)
#else
        Color(uiColor: .separator).opacity(0.45)
#endif
    }

    static var brand: Color { Color(red: 0.05, green: 0.28, blue: 0.48) }
}

struct WorkspaceScreen<Content: View>: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let content: Content

    init(title: String, subtitle: String, systemImage: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.systemImage = systemImage
        self.content = content()
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                WorkspaceHeader(title: title, subtitle: subtitle, systemImage: systemImage)
                content
            }
            .frame(maxWidth: AppTheme.maxContentWidth, alignment: .leading)
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .frame(maxWidth: .infinity, alignment: .center)
        }
        .background(AppTheme.workspaceBackground)
    }
}

struct WorkspaceHeader: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
                .frame(width: 42, height: 42)
                .background(AppTheme.brand.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title2.weight(.semibold))
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }
}

struct CVPanel<Content: View>: View {
    let title: String?
    let subtitle: String?
    let content: Content

    init(_ title: String? = nil, subtitle: String? = nil, @ViewBuilder content: () -> Content) {
        self.title = title
        self.subtitle = subtitle
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if title != nil || subtitle != nil {
                VStack(alignment: .leading, spacing: 3) {
                    if let title {
                        Text(title)
                            .font(.headline)
                    }
                    if let subtitle {
                        Text(subtitle)
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.panelBackground, in: RoundedRectangle(cornerRadius: AppTheme.panelRadius))
        .overlay(
            RoundedRectangle(cornerRadius: AppTheme.panelRadius)
                .stroke(AppTheme.subtleStroke, lineWidth: 1)
        )
    }
}

struct StatusPill: View {
    let title: String
    var systemImage: String?
    var tint: Color = AppTheme.brand

    var body: some View {
        Label {
            Text(title)
                .font(.caption.weight(.medium))
        } icon: {
            if let systemImage {
                Image(systemName: systemImage)
            }
        }
        .foregroundStyle(tint)
        .padding(.horizontal, 9)
        .padding(.vertical, 5)
        .background(tint.opacity(0.10), in: Capsule())
    }
}

struct ActionRow: View {
    let title: String
    let subtitle: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(AppTheme.brand)
                .frame(width: 34, height: 34)
                .background(AppTheme.brand.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            Spacer(minLength: 0)
        }
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    var systemImage: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer(minLength: 0)
                if let systemImage {
                    Image(systemName: systemImage)
                        .foregroundStyle(.secondary)
                }
            }
            Text(value.isEmpty ? "N/A" : value)
                .font(.body.monospaced())
                .textSelection(.enabled)
                .lineLimit(3)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppTheme.panelBackground.opacity(0.65), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(AppTheme.subtleStroke, lineWidth: 1))
    }
}

struct ExampleButtonGrid: View {
    let examples: [String]
    let action: (String) -> Void

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 128), spacing: 10)], alignment: .leading, spacing: 10) {
            ForEach(examples, id: \.self) { example in
                Button(example) { action(example) }
                    .buttonStyle(.bordered)
            }
        }
    }
}

struct EmptyStateBlock: View {
    let title: String
    let message: String
    let systemImage: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.system(size: 28, weight: .semibold))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
    }
}
