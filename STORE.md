# Putting Z83 Auto-Matcher on Google Play and the App Store

The app is the same React website, wrapped with [Capacitor](https://capacitorjs.com). The wrapped projects are in `android/` and `ios/`. Inside the app, the extra "native" features are:

- **One-tap email**: opens the phone's email composer with the address, subject, message **and the PDF attached**.
- **Save or share** PDFs and the ZIP through the phone's share list, and **preview** PDFs in the phone's viewer.
- The Android **back button** goes back one step.

These also help with Apple's rule that an app must be more than a website.

## 0. Decisions to make first
- **App ID** (`com.mduduzigwija.z83matcher`) is set in `capacitor.config.ts` and `android/app/build.gradle`. It can **never change** after the first upload. Change it now if you want a different one (for example your company's reversed domain), then run `npx cap sync`.
- **Account type**: a personal developer account is simplest. Google also requires a "closed test" with a number of testers for about 14 days before a new personal account can publish to everyone (check the current number in the Play Console).

## 1. Try the Android app on your phone (free, no accounts)
1. On GitHub open the repo, go to **Actions > Build Android app > Run workflow**.
2. When it finishes, download the **z83-test-app-apk** artifact, unzip it, send the `.apk` to your phone and install it (allow "install unknown apps" once).
3. Test the full flow, especially **Open email with PDF attached**.

## 2. Google Play
1. Create a Google Play Console account (one-time US$25).
2. Make an upload key (once, keep it safe, losing it is painful):
   ```
   keytool -genkey -v -keystore upload.keystore -alias upload -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 upload.keystore     # copy this output
   ```
3. In GitHub: **Settings > Secrets and variables > Actions**, add `ANDROID_KEYSTORE_BASE64` (the output above), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`upload`) and `ANDROID_KEY_PASSWORD`.
4. Run **Build Android app** again. Download **z83-play-store-bundle-aab** (a signed `.aab`).
5. In the Play Console: create the app, then upload the `.aab` to **Internal testing** first. Fill in the store listing (text in `store/listing.md`), privacy policy URL, Data safety, content rating and target audience (18+).
6. Release to **Closed testing**, then **Production** when Google allows it.
Every new upload needs a higher version number; the workflow sets it from the run number automatically.

## 3. App Store (iPhone)
You need an **Apple Developer account (US$99 per year)** and a Mac with **Xcode**, or a cloud Mac build service (for example Codemagic or a GitHub macOS runner with your signing certificate).
1. On the Mac: `npm ci && npm run cap:sync`, then `npm run cap:ios` (opens Xcode; the project uses Swift Package Manager, so no CocoaPods).
2. In Xcode, select the **App** target > Signing & Capabilities, choose your Team and confirm the Bundle Identifier.
3. Product > Archive > Distribute App > App Store Connect.
4. In App Store Connect: add the listing (text in `store/listing.md`), screenshots, privacy ("Data Not Collected") and submit for review.
5. Test first with **TestFlight**. iPhone's built-in Mail composer only appears when the person has a Mail account set up; otherwise the app falls back to the share list.

## 4. Things to expect from the stores
- **Do not look official.** Keep the "independent app, not affiliated with DPSA or any government department" wording. Do not use government logos or names in the icon or screenshots.
- **Apple review** can ask what the app does beyond a website; point them at the native email, share and viewer features and the notes in `store/listing.md`.
- The saved Z83 answers live in the app's own storage. On iPhone, storage can occasionally be cleared by the system when the phone is very low on space; people may need to re-enter them.

## 5. Updating the app later
Change the code, push, then re-run **Build Android app** and upload the new bundle. For iPhone, archive again from Xcode.
