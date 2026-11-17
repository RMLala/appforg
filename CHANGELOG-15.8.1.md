# AppForge Studio 15.8.1

- Stop opening Android's biometric prompt automatically during WebView startup; require a deliberate tap on the unlock button.
- Re-lock on resume without launching the prompt until the user taps.
- Catch biometric provider startup exceptions and return a readable failure to the UI instead of allowing them to terminate the app.
- Add an Android 13 (API 33) emulator launch smoke check to the Android build workflow.
- Increment Android versionCode to 161 so 15.8.1 installs as an update to 15.8.
