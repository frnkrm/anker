import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;
import com.android.apksig.apk.ApkUtils;
import com.android.apksig.util.DataSources;
import java.io.File;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;

/** Local-only bridge to the unmodified Apache-2.0 apksig library. Never creates a key. */
public final class AnkerApkTool {
    private static final String ALIAS = "AndroidDebugKey";

    private static String digest(X509Certificate certificate) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(certificate.getEncoded()));
    }

    private static KeyStore loadKeyStore(String path, char[] password) throws Exception {
        return KeyStore.getInstance(new File(path), password);
    }

    public static void main(String[] args) {
        try {
            switch (args[0]) {
                case "metadata" -> {
                    try (RandomAccessFile apk = new RandomAccessFile(args[1], "r")) {
                        ByteBuffer manifest = ApkUtils.getAndroidManifest(DataSources.asDataSource(apk));
                        System.out.println("PACKAGE=" + ApkUtils.getPackageNameFromBinaryAndroidManifest(manifest.duplicate()));
                        System.out.println("VERSION_CODE=" + Long.toUnsignedString(ApkUtils.getLongVersionCodeFromBinaryAndroidManifest(manifest.duplicate())));
                    }
                }
                case "verify" -> {
                    ApkVerifier.Result result = new ApkVerifier.Builder(new File(args[1])).build().verify();
                    if (!result.isVerified() || result.getSignerCertificates().size() != 1) throw new SecurityException("APK signature rejected");
                    System.out.println("CERT_SHA256=" + digest(result.getSignerCertificates().get(0)));
                }
                case "key-certificate" -> {
                    char[] password = "android".toCharArray();
                    try {
                        KeyStore store = loadKeyStore(args[1], password);
                        System.out.println("CERT_SHA256=" + digest((X509Certificate) store.getCertificate(ALIAS)));
                    } finally { Arrays.fill(password, '\0'); }
                }
                case "sign" -> {
                    char[] password = "android".toCharArray();
                    try {
                        KeyStore store = loadKeyStore(args[3], password);
                        X509Certificate certificate = (X509Certificate) store.getCertificate(ALIAS);
                        if (!digest(certificate).equals(args[4])) throw new SecurityException("Unexpected certificate");
                        PrivateKey key = (PrivateKey) store.getKey(ALIAS, password);
                        List<X509Certificate> chain = new ArrayList<>();
                        for (java.security.cert.Certificate item : store.getCertificateChain(ALIAS)) chain.add((X509Certificate) item);
                        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder("ANKER", key, chain).build();
                        new ApkSigner.Builder(List.of(signer))
                                .setInputApk(new File(args[1])).setOutputApk(new File(args[2]))
                                .setV1SigningEnabled(true).setV2SigningEnabled(true).setV3SigningEnabled(true)
                                .setV4SigningEnabled(false).setAlignmentPreserved(true)
                                .build().sign();
                    } finally { Arrays.fill(password, '\0'); }
                }
                default -> throw new IllegalArgumentException("Unknown operation");
            }
        } catch (Exception error) {
            // No key material, passwords, file contents or stack traces in diagnostic output.
            System.err.println("Anker APK tool: " + error.getClass().getSimpleName());
            System.exit(1);
        }
    }
}
