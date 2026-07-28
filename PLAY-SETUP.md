# Google Play — one-time setup, then push-button publishing

The Android app (`android/`) is the twin of the iOS shell: a premium native
wrapper around the live web app, pointed at the dev preview
(`…/OpenProject2/preview/`). Content updates need **no** store release — the
app follows the website. A store build is only needed for native changes.

Once the steps below are done **once**, every release is one button:
**Actions → "Android → Google Play" → Run workflow** → the signed bundle is
built and lands in the chosen Play track → press **Publish/Promote** in the
Play Console. Nothing else.

## 1. Google Play developer account (~15 min, $25 once)

1. Go to https://play.google.com/console and register (personal or company
   account; company needs the CIF and a D-U-N-S check).
2. Create the app: **Create app** → name "Canei Subirats", default language
   Spanish, App (not game), Free.
3. Fill the mandatory declarations (privacy policy URL — the GitHub Pages
   site works: `https://stefangruber001.github.io/OpenProject2/` —, content
   rating questionnaire, target audience, data safety: "no data collected"
   is accurate: everything stays on-device in IndexedDB).

## 2. Upload keystore (5 min, on any machine with Java)

```bash
keytool -genkeypair -v -keystore upload.keystore -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass <STORE_PASSWORD> -keypass <KEY_PASSWORD> \
  -dname "CN=Canei Subirats, O=Canei Subirats S.L., C=ES"
base64 -w0 upload.keystore   # copy the output
```

Keep `upload.keystore` and the passwords safe (password manager). Play App
Signing re-signs for devices, so this key is only the upload key.

## 3. Service account for automated upload (10 min)

1. Play Console → **Setup → API access** → link a Google Cloud project.
2. In that Cloud project: **IAM & Admin → Service accounts → Create**
   ("play-publisher"), then **Keys → Add key → JSON** and download it.
3. Back in Play Console API access: **Grant access** to the service account
   with the **Release manager** role (Releases: create & edit).

## 4. GitHub secrets (2 min)

Repo → Settings → Secrets and variables → Actions → add:

| Secret                      | Value                               |
| --------------------------- | ----------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | the base64 output from step 2       |
| `ANDROID_KEYSTORE_PASSWORD` | store password                      |
| `ANDROID_KEY_ALIAS`         | `upload`                            |
| `ANDROID_KEY_PASSWORD`      | key password                        |
| `PLAY_SERVICE_ACCOUNT_JSON` | full JSON file contents from step 3 |

## 5. First release (once)

Google requires the **first** bundle of a new app to be uploaded through the
Play Console UI. Run the workflow once (it produces the signed
`canei-subirats-aab` artifact even before the service account works), download
the artifact and upload it in **Play Console → Testing → Internal testing →
Create release**. Every release after that is fully automated.

## Day-to-day

- Web/content changes: just push — the app updates itself on next open.
- Native release: **Actions → Android → Google Play → Run workflow**
  (choose track, default `internal`) → press **Publish** in the Play Console.
- Version codes are automatic (the workflow run number), so uploads never
  collide.

## Status

- [x] Android project (`android/`) — WebView shell, same tabs/URL as iOS
- [x] CI pipeline (`.github/workflows/android-play.yml`)
- [ ] Play developer account (step 1) — needs the owner (payment + identity)
- [ ] Keystore + secrets (steps 2–4) — needs the owner's machine/passwords
- [ ] First manual upload (step 5)

Until the boxes above are ticked the workflow still runs and produces an
installable artifact, so the pipeline itself is already testable end to end.
