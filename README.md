# Everly — Private Couple & Shared Memories Vault

Everly is a private workspace for two owners (BeniLin and Shana Love) to preserve shared memories, photos, videos, music soundtracks, and communications. Built with React, Vite, TypeScript, Tailwind CSS, Express, and Firebase / Google Drive APIs.

---

## 📱 Android App Setup (Capacitor)

Everly is fully configured with [Capacitor](https://capacitorjs.com/) for Android mobile deployment.

### App Configuration
- **App Name**: Everly
- **Application ID (`appId`)**: `com.everly.workspace`
- **Web Directory (`webDir`)**: `dist`
- **Android Scheme**: `https`

---

## 🚀 Building the Android APK

### 1. Automated GitHub Actions Build (Recommended)
Every commit pushed to `main` or `master` triggers the `.github/workflows/android.yml` workflow:
1. Installs dependencies using `bun.lock` (`bun install`).
2. Compiles the Vite production bundle (`bun run build`).
3. Syncs web assets into the Capacitor Android container (`npx cap sync android`).
4. Compiles the installable debug APK via `./android/gradlew assembleDebug`.
5. Uploads `app-debug.apk` as a downloadable GitHub Actions artifact named `everly-debug-apk`.

To download the APK:
1. Go to your repository's **Actions** tab on GitHub.
2. Select the latest **Build Everly Android Debug APK** workflow run.
3. Scroll down to **Artifacts** and download `everly-debug-apk.zip`.
4. Unzip and transfer `app-debug.apk` to your Android device to install.

---

### 2. Local Android Development & Testing

#### Prerequisites
- Node.js 20+ / Bun
- Android Studio with Android SDK (API 34 / Android 14) and JDK 17+

#### Local Commands
```bash
# 1. Install dependencies
bun install

# 2. Build Vite production web app
bun run build

# 3. Sync web assets with Capacitor Android
npx cap sync android

# 4. Open in Android Studio
npx cap open android

# 5. Build Debug APK directly via Gradle Wrapper
cd android && ./gradlew assembleDebug
```
The compiled debug APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🔒 Security & Workspace Isolation
- **Private Access Control**: Access is strictly limited to authorized owner emails (`benilin76@gmail.com` and `shanalove917@gmail.com`).
- **Secret Protection**: API secrets, private keys, and service account credentials are stored in environment variables / backend proxies and are never exposed in the client-side Android APK bundle.
- **HTTPS Enforcement**: All API communication and media streaming run over encrypted HTTPS channels.

---

## 🛠 Web Development Commands

```bash
# Start development server
npm run dev

# Compile TypeScript & Build Web Production Output
npm run build

# Run TypeScript Lint check
npm run lint
```
