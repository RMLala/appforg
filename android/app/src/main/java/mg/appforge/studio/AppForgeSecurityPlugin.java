package mg.appforge.studio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "AppForgeSecurity")
public class AppForgeSecurityPlugin extends Plugin {
    private static final String KEY_ALIAS = "appforge_studio_secure_storage_v1";
    private static final String PREFS = "appforge_secure_values_v1";
    private static final int REQUEST_CREATE = 8121;

    @PluginMethod
    public void canAuthenticate(PluginCall call) {
        int result = BiometricManager.from(getContext()).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
        JSObject out = new JSObject();
        out.put("available", result == BiometricManager.BIOMETRIC_SUCCESS);
        out.put("result", result);
        call.resolve(out);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        try {
            int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.DEVICE_CREDENTIAL;
            if (BiometricManager.from(getContext()).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
                call.reject("Configure une empreinte ou un code de verrouillage Android pour protéger AppForge.", "AUTH_UNAVAILABLE");
                return;
            }
            BiometricPrompt.PromptInfo.Builder promptBuilder = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Déverrouiller AppForge Studio")
                .setSubtitle("Biométrie ou code de verrouillage Android");
            if (android.os.Build.VERSION.SDK_INT >= 30) promptBuilder.setAllowedAuthenticators(authenticators);
            else promptBuilder.setDeviceCredentialAllowed(true);
            BiometricPrompt.PromptInfo prompt = promptBuilder.build();
            BiometricPrompt biometric = new BiometricPrompt(getActivity(), ContextCompat.getMainExecutor(getContext()), new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                    JSObject out = new JSObject();
                    try { out.put("authenticated", true); call.resolve(out); }
                    catch (Exception e) { call.reject("Résultat de déverrouillage illisible."); }
                }
                @Override public void onAuthenticationError(int code, CharSequence message) { call.reject(String.valueOf(message), "AUTH_CANCELLED"); }
            });
            biometric.authenticate(prompt);
        } catch (Exception e) {
            // A biometric provider failure must be reported to JavaScript, never crash the host app.
            call.reject("Le déverrouillage Android est indisponible. Réessaie ou vérifie le verrouillage de l’appareil.", "AUTH_START_FAILED");
        }
    }

    @PluginMethod
    public void secureGet(PluginCall call) {
        try {
            String name = call.getString("key");
            if (name == null || name.length() > 120) { call.reject("Clé invalide."); return; }
            String packed = getContext().getSharedPreferences(PREFS, 0).getString(name, null);
            JSObject result = new JSObject();
            if (packed == null) { result.put("value", JSObject.NULL); call.resolve(result); return; }
            String[] parts = packed.split(":", 2);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, getKey(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
            result.put("value", new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception e) { call.reject("Lecture du stockage protégé impossible.", "SECURE_STORAGE_ERROR"); }
    }

    @PluginMethod
    public void secureSet(PluginCall call) {
        try {
            String name = call.getString("key"), value = call.getString("value");
            if (name == null || value == null || name.length() > 120 || value.length() > 1000000) { call.reject("Valeur invalide."); return; }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, getKey());
            String packed = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" + Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
            if (!getContext().getSharedPreferences(PREFS, 0).edit().putString(name, packed).commit()) { call.reject("Écriture protégée impossible."); return; }
            call.resolve();
        } catch (Exception e) { call.reject("Écriture dans le stockage protégé impossible.", "SECURE_STORAGE_ERROR"); }
    }

    @PluginMethod
    public void secureRemove(PluginCall call) {
        String name = call.getString("key");
        if (name == null || name.length() > 120) { call.reject("Clé invalide."); return; }
        getContext().getSharedPreferences(PREFS, 0).edit().remove(name).apply();
        call.resolve();
    }

    private SecretKey getKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(KEY_ALIAS)) return ((SecretKey) store.getKey(KEY_ALIAS, null));
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setRandomizedEncryptionRequired(true).build());
        return generator.generateKey();
    }

    @PluginMethod
    public void shareBackup(PluginCall call) {
        try {
            String name = call.getString("name", "AppForge-sauvegarde.json");
            String text = call.getString("text", "");
            if (text.length() > 20 * 1024 * 1024) { call.reject("Sauvegarde trop volumineuse (maximum 20 Mo).", "FILE_TOO_LARGE"); return; }
            File file = new File(getContext().getCacheDir(), "shared_backup.json");
            try (OutputStream out = new java.io.FileOutputStream(file)) { out.write(text.getBytes(StandardCharsets.UTF_8)); }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent share = new Intent(Intent.ACTION_SEND); share.setType("application/json"); share.putExtra(Intent.EXTRA_STREAM, uri); share.putExtra(Intent.EXTRA_TITLE, name); share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(share, "Enregistrer ou partager la sauvegarde"));
            call.resolve(new JSObject().put("shared", true));
        } catch (Exception e) { call.reject("Partage natif indisponible.", "SHARE_ERROR"); }
    }

    @PluginMethod
    public void pickBackup(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT); intent.addCategory(Intent.CATEGORY_OPENABLE); intent.setType("application/json");
        startActivityForResult(call, intent, "onBackupPicked");
    }

    @ActivityCallback
    private void onBackupPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) { call.reject("Sélection de fichier annulée.", "PICK_CANCELLED"); return; }
        try (InputStream in = getContext().getContentResolver().openInputStream(result.getData().getData()); java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = in.read(buffer)) != -1) { if (out.size() + count > 20 * 1024 * 1024) { call.reject("Fichier trop volumineux (maximum 20 Mo).", "FILE_TOO_LARGE"); return; } out.write(buffer, 0, count); }
            call.resolve(new JSObject().put("text", new String(out.toByteArray(), StandardCharsets.UTF_8)));
        } catch (Exception e) { call.reject("Lecture du fichier sélectionné impossible.", "FILE_READ_ERROR"); }
    }
}
