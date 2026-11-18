# AppForge Studio 15.8.2

- Fix a malformed HTML/JavaScript boundary that embedded the About & Support module inside the client questionnaire template. This stopped the main WebView script from parsing and left the UI hidden.
- Restore the questionnaire's closing HTML and load About & Support as a separate application script.
- Keep biometric unlock user initiated and report native biometric-provider errors without terminating the app.
- Test the signed API29 Release APK on an Android 13 emulator and assert that the unlock UI is visible.
- Increment Android versionCode to 162 so 15.8.2 updates 15.8.1.
