import Foundation
import LocalAuthentication
import SwiftUI

/// What the gate is doing right now. `.open` is the only phase in which the
/// workspace is visible.
///
/// Declared at file scope rather than nested inside `BiometricLock`, because a
/// type nested in a `@MainActor` type inherits that isolation — and `LockView`
/// reads these from plain computed properties that are not on the main actor.
/// Nesting them would work today (the project builds in Swift 5 language mode,
/// where that mismatch is a warning) and break the day it moves to Swift 6.
enum BiometricPhase: Equatable {
    case open
    /// Covered and waiting for the operator. Carries a message only when
    /// something went wrong that is worth naming.
    case locked(message: String?)
    /// The system sheet is up.
    case checking
    /// Authenticated — held briefly so the check is something the operator
    /// SEES happen rather than a flicker they have to take on trust.
    case confirmed
}

/// Which authentication this phone actually offers. Read from the device rather
/// than assumed, so an iPhone SE says "Touch ID" and means it.
enum BiometricKind: Equatable {
    case faceID
    case touchID
    case passcode
    case unavailable

    var title: String {
        switch self {
        case .faceID:      return "Face ID"
        case .touchID:     return "Touch ID"
        case .passcode:    return "Código"
        case .unavailable: return ""
        }
    }

    var symbol: String {
        switch self {
        case .faceID:                 return "faceid"
        case .touchID:                return "touchid"
        case .passcode, .unavailable: return "lock.fill"
        }
    }
}

/// Everything crossing back from the authentication callback, and nothing that
/// is not `Sendable`. `LAError` is not, and neither is `LAContext`; reducing the
/// result to value types keeps the hop back to the main actor honest.
///
/// File scope for the same reason as the enums above: this is constructed on
/// whatever thread LocalAuthentication answers on, so its memberwise
/// initialiser must not be main-actor isolated.
private struct BiometricOutcome: Sendable {
    var ok: Bool
    var message: String?
    var passcodeMissing: Bool
}

/// Turn whatever LocalAuthentication handed back into something worth showing a
/// human — which for most failures is nothing at all.
private func describeBiometricFailure(_ error: Error?) -> BiometricOutcome {
    var code: LAError.Code?
    if let laError = error as? LAError { code = laError.code }

    var message: String? = "No se pudo verificar. Inténtalo de nuevo."
    if let code = code {
        switch code {
        case .userCancel, .systemCancel, .appCancel:
            // The operator dismissed it themselves. They know why; saying so
            // would be noise printed over a deliberate act.
            message = nil
        case .biometryLockout:
            message = "Demasiados intentos. Usa el código del dispositivo."
        default:
            break
        }
    } else {
        message = nil
    }

    return BiometricOutcome(ok: false, message: message, passcodeMissing: code == .passcodeNotSet)
}

/// The Face ID gate that stands in front of the workspace.
///
/// WHAT THIS IS AND IS NOT. This does not sign anybody in. The session lives in
/// a cookie the server issued and is good for thirty days; what this adds is the
/// thing every premium app with money or customer records behind it has — the
/// phone itself must agree you are you before the data is shown. The two are
/// independent on purpose: the password proves who the operator is to the
/// server, Face ID proves the phone has not changed hands since. Conflating
/// them would mean either storing a password on the device or trusting a face
/// to a machine that has never seen it.
///
/// So the sequence the operator actually experiences is:
///
///   first run       → workspace asks for the password → signed in → gate armed
///   every run after → brand screen → Face ID → ✓ → straight into the work
///
/// NO LOCKOUT IS POSSIBLE. The policy is `deviceOwnerAuthentication`, not
/// `deviceOwnerAuthenticationWithBiometrics`: iOS tries Face ID first and falls
/// back to the device passcode by itself. A failed scan, a mask, a cracked
/// front camera, ten failed attempts — every one of those still has a way in
/// that does not involve reinstalling the app. And if the phone has no passcode
/// at all there is nothing to authenticate against, so the gate disarms itself
/// rather than standing there refusing everyone.
///
/// The gate is armed only after a sign-in has actually succeeded. Arming it
/// before there is a session would put a Face ID prompt in front of a login
/// form — a lock on an empty room, and the first thing a new operator sees.
@MainActor
final class BiometricLock: ObservableObject {

    typealias Phase = BiometricPhase
    typealias Kind = BiometricKind

    @Published private(set) var phase: Phase
    @Published private(set) var kind: Kind

    /// Covers the screen while the app is not frontmost. iOS photographs the
    /// app to draw the card in the app switcher, and that photograph is of
    /// whatever was on screen — a customer's address, a margin, an invoice
    /// total. This is why banking apps appear to "blank out" when you swipe up,
    /// and it costs nothing to do properly.
    @Published private(set) var shielded = false

    /// True while anything is covering the workspace.
    var isCovering: Bool { phase != .open }

    private static let armedKey = "canei.lock.armed"
    private let defaults = UserDefaults.standard

    /// How long the app may sit in the background before it asks again.
    ///
    /// Zero would be correct and unusable: stepping out to the camera to
    /// photograph a wall, or to Mail to check an address, would cost a Face ID
    /// scan on the way back, several times an hour. A minute is the convention
    /// because it covers the real risk — the phone left on a table, picked up
    /// by someone else — while treating a glance at another app as what it is.
    private let grace: TimeInterval = 60
    private var leftAt: Date?

    private var signedInObserver: NSObjectProtocol?

    var isArmed: Bool { defaults.bool(forKey: Self.armedKey) }

    init() {
        let available = Self.availableKind()
        self.kind = available
        self.phase = (UserDefaults.standard.bool(forKey: Self.armedKey) && available != .unavailable)
            ? .locked(message: nil)
            : .open

        // Arm on the first successful sign-in, using the same broadcast the tabs
        // already use to notice one another. Nothing to configure and nothing to
        // remember: the operator types their password once, and from then on the
        // app opens with their face.
        signedInObserver = NotificationCenter.default.addObserver(
            forName: .caneiSignedIn, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor in self?.arm() }
        }
    }

    // No deinit removing the observer, for the same reason AppState has none:
    // this object is a root @StateObject and lives as long as the process.

    /// Turn the gate on. Idempotent, and a no-op on a phone that has no way to
    /// authenticate — arming there would lock the operator out of their own ERP
    /// with no route back in.
    func arm() {
        let available = Self.availableKind()
        kind = available
        guard available != .unavailable, !isArmed else { return }
        defaults.set(true, forKey: Self.armedKey)
    }

    // MARK: - Authenticating

    /// Ask, but only if we are actually waiting. Safe to call on every
    /// foreground: while the system sheet is already up the phase is
    /// `.checking`, so this does nothing rather than stacking a second prompt.
    func authenticateIfNeeded() async {
        guard case .locked = phase else { return }
        await authenticate()
    }

    func authenticate() async {
        guard isArmed, kind != .unavailable else {
            phase = .open
            return
        }

        phase = .checking
        let outcome = await Self.evaluate(
            reason: "Desbloquea Canei Subirats para ver el trabajo de la empresa."
        )

        if outcome.ok {
            Haptics.success()
            // Held, deliberately. The whole point of the request was that the
            // check should be visible: the app opens by itself, and the operator
            // still sees that it was Face ID that opened it.
            phase = .confirmed
            try? await Task.sleep(nanoseconds: 780_000_000)
            withAnimation(.easeInOut(duration: 0.38)) { phase = .open }
            return
        }

        if outcome.passcodeMissing {
            // Nothing to authenticate against. Standing in the way here would be
            // pure obstruction, so step aside and stay aside.
            defaults.set(false, forKey: Self.armedKey)
            kind = .unavailable
            phase = .open
            return
        }

        if outcome.message != nil { Haptics.warning() }
        phase = .locked(message: outcome.message)
    }

    // MARK: - App lifecycle

    func appWillResignActive() {
        guard isArmed, kind != .unavailable else { return }
        shielded = true
    }

    func appDidEnterBackground() {
        leftAt = Date()
    }

    /// The launch trigger, called once when the first frame appears. Separate
    /// from `appDidBecomeActive` on purpose — see the note there.
    func start() async {
        guard isArmed, kind != .unavailable else {
            phase = .open
            return
        }
        await authenticateIfNeeded()
    }

    func appDidBecomeActive() async {
        shielded = false
        guard isArmed, kind != .unavailable else { return }

        // ONLY the return-from-background case. Deliberately NOT "if we are
        // locked, ask again".
        //
        // The system Face ID sheet makes the app `.inactive` while it is up, so
        // dismissing it sends us straight back through `.active`. A rule that
        // re-asks whenever it finds the gate locked would therefore re-present
        // the sheet the instant the operator tapped Cancelar, and again, and
        // again — a loop with no way out but force-quitting the app.
        //
        // Once the gate is locked and the operator has seen it, the next move is
        // theirs: the unlock button is right there.
        guard case .open = phase else { return }
        guard let left = leftAt, Date().timeIntervalSince(left) >= grace else { return }
        leftAt = nil
        phase = .locked(message: nil)
        await authenticate()
    }

    // MARK: - LocalAuthentication

    private static func availableKind() -> Kind {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            return .unavailable
        }
        // `biometryType` is only meaningful after canEvaluatePolicy has run —
        // read before, it reports `.none` on a phone with a perfectly good
        // Face ID sensor.
        switch context.biometryType {
        case .faceID:  return .faceID
        case .touchID: return .touchID
        default:       return .passcode
        }
    }

    /// `nonisolated` because the completion handler below arrives on whatever
    /// queue LocalAuthentication feels like using, and everything it touches has
    /// to be reachable from there.
    nonisolated private static func evaluate(reason: String) async -> BiometricOutcome {
        // A FRESH CONTEXT EVERY TIME. LAContext caches a successful evaluation
        // for the lifetime of the object, so a reused one hands back "yes"
        // without asking anybody — the gate would appear to work and would in
        // fact be open.
        let context = LAContext()
        context.localizedCancelTitle = "Cancelar"

        return await withCheckedContinuation { (continuation: CheckedContinuation<BiometricOutcome, Never>) in
            context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, error in
                if ok {
                    continuation.resume(returning:
                        BiometricOutcome(ok: true, message: nil, passcodeMissing: false))
                    return
                }
                continuation.resume(returning: describeBiometricFailure(error))
            }
        }
    }
}
