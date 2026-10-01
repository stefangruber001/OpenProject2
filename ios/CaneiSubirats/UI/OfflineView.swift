import SwiftUI

/// Shown when a page fails to load. Premium, calm, on-brand — and, since the
/// App Review rejection of 1.1 (15), HONEST ABOUT WHICH FAILURE IT IS.
///
/// It used to say "You're offline" whatever had happened: a refused
/// certificate, a name that would not resolve, a server returning nothing and
/// an aeroplane all produced the same four words over the same icon. App Review
/// saw this screen on every tab and reported "the app did not load content on
/// any tab", adding "Internet Connection: Active" — the note somebody makes
/// when an app has just blamed their network in front of them and they can see
/// it is fine. A whole review cycle, and the report could not name a cause
/// because the app had made every cause look the same.
///
/// So: the wifi icon and the word "offline" are now reserved for the one case
/// where the device actually reports no route. Everything else says what it
/// was, states plainly that the connection is working, and shows the underlying
/// error code in small type — because the person holding a device we cannot
/// reach is the only instrument we have, and a photograph of this screen should
/// be worth something.
struct OfflineView: View {
    let failure: WebViewStore.LoadFailure?
    let onRetry: () -> Void
    @State private var spin = false

    private var isOffline: Bool { failure?.isOffline ?? true }

    private var headline: String {
        failure?.headline ?? "You're offline"
    }

    private var detail: String {
        failure?.detail
            ?? "This app loads your live workspace from the web. Reconnect and try again — your saved projects stay on this device."
    }

    /// A slash through the signal only when that is the truth. A padlock for a
    /// refused certificate, a cloud for everything else the server did.
    private var symbol: String {
        guard let f = failure else { return "wifi.slash" }
        if f.isOffline { return "wifi.slash" }
        return f.headline == "Secure connection refused" ? "lock.trianglebadge.exclamationmark" : "exclamationmark.icloud"
    }

    var body: some View {
        VStack(spacing: 18) {
            ZStack {
                Circle()
                    .fill(Theme.greenSoft)
                    .frame(width: 88, height: 88)
                Image(systemName: symbol)
                    .font(.system(size: 34, weight: .semibold))
                    .foregroundStyle(Theme.green)
            }

            VStack(spacing: 6) {
                Text(headline)
                    .font(Theme.serif(22, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text(detail)
                    .font(Theme.sans(15))
                    .foregroundStyle(Theme.body)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, 8)
            }

            Button {
                Haptics.light()
                withAnimation(.easeInOut(duration: 0.6)) { spin.toggle() }
                onRetry()
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: "arrow.clockwise")
                        .rotationEffect(.degrees(spin ? 360 : 0))
                    Text("Try again").fontWeight(.semibold)
                }
                .font(Theme.sans(16, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 26)
                .padding(.vertical, 14)
                .background(Capsule().fill(Theme.green))
            }
            .buttonStyle(.plain)

            // THE LINE THAT MAKES A SCREENSHOT USEFUL. Small, grey, last — it is
            // not for the operator, and on the day it is needed it is the only
            // thing on this screen that matters. The address goes with it,
            // because "which server" is the other half of "what went wrong".
            if let f = failure {
                VStack(spacing: 2) {
                    Text(f.code)
                    Text(Config.baseURL.host ?? "")
                }
                .font(.system(size: 11, weight: .regular, design: .monospaced))
                .foregroundStyle(Theme.muted)
                .textSelection(.enabled)
                .padding(.top, 4)
            }
        }
        .padding(28)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.pageGradient.ignoresSafeArea())
    }
}
