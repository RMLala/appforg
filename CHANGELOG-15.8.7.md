# AppForge Studio 15.8.7

- Replaced the legacy Cloud account and organization flow with the central AppForge License API V3 Worker.
- Set the Cloud endpoint to https://appforge-license-api.lalainaadclick.workers.dev by default.
- Added a Studio owner license bound to the installation, short-lived Cloud bearer tokens, and D1 snapshots at `/v1/cloud/snapshot?resource=default`.
- Kept the owner license proof in Android secure storage or the encrypted AppForge vault; removed legacy Cloud email/password restoration.
- Preserved explicit first-sync choice, revision conflict handling, local data, and offline access.
