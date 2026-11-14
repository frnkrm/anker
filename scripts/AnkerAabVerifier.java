import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.interfaces.RSAPublicKey;
import java.security.interfaces.ECPublicKey;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.Set;
import java.util.jar.Attributes;
import java.util.jar.JarFile;
import java.util.jar.Manifest;

/** Trusted W tool. Never loads classes from the inspected bundle or reads a key. */
public final class AnkerAabVerifier {
    private static final Set<String> RESERVED = Set.of("META-INF/MANIFEST.MF", "META-INF/ANKER.SF",
            "META-INF/ANKER.RSA", "META-INF/ANKER.EC");

    private static String digest(byte[] data) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(data));
    }

    private static String certificate(X509Certificate cert, String expected) throws Exception {
        if (!digest(cert.getEncoded()).equals(expected)) throw new SecurityException();
        cert.checkValidity();
        if (cert.getPublicKey() instanceof RSAPublicKey rsa && rsa.getModulus().bitLength() >= 2048)
            return "RSA";
        if (cert.getPublicKey() instanceof ECPublicKey ec && ec.getParams().getOrder().bitLength() >= 256)
            return "EC";
        throw new SecurityException();
    }

    private static void inspect(String[] args) throws Exception {
        boolean signed = args[0].equals("signed");
        if ((!signed && !args[0].equals("unsigned")) || args.length != (signed ? 4 : 2))
            throw new IllegalArgumentException();
        Set<String> seen = new HashSet<>();
        int payload = 0;
        int minSigners = Integer.MAX_VALUE;
        int maxSigners = 0;
        String publicKeyAlgorithm = null;
        byte[] publicDer = null;
        try (JarFile jar = new JarFile(args[1], true)) {
            Manifest manifest = jar.getManifest();
            var entries = jar.entries();
            byte[] buffer = new byte[65536];
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                if (!seen.add(entry.getName())) throw new SecurityException();
                if (entry.isDirectory()) continue;
                try (InputStream stream = jar.getInputStream(entry)) {
                    while (stream.read(buffer) != -1) { /* force every signature/digest verification */ }
                }
                boolean reserved = RESERVED.contains(entry.getName());
                if (reserved) {
                    if (!signed) throw new SecurityException();
                    continue;
                }
                payload++;
                var signers = entry.getCodeSigners();
                int signerCount = signers == null ? 0 : signers.length;
                minSigners = Math.min(minSigners, signerCount);
                maxSigners = Math.max(maxSigners, signerCount);
                if (!signed) {
                    if (signers != null || entry.getCertificates() != null) throw new SecurityException();
                    continue;
                }
                if (signers == null || signers.length != 1 || manifest == null) throw new SecurityException();
                var cert = (X509Certificate) signers[0].getSignerCertPath().getCertificates().get(0);
                publicKeyAlgorithm = certificate(cert, args[2]);
                publicDer = cert.getEncoded();
                Attributes attrs = manifest.getAttributes(entry.getName());
                if (attrs == null || attrs.getValue("SHA-256-Digest") == null) throw new SecurityException();
                for (Object key : attrs.keySet()) {
                    String name = key.toString();
                    if (name.endsWith("-Digest") && !name.equals("SHA-256-Digest")) throw new SecurityException();
                }
            }
            if (payload == 0) throw new SecurityException();
            if (signed) {
                if (publicDer == null || !seen.contains("META-INF/ANKER.SF")
                        || !seen.contains("META-INF/MANIFEST.MF")
                        || !(seen.contains("META-INF/ANKER.RSA") ^ seen.contains("META-INF/ANKER.EC")))
                    throw new SecurityException();
                try (InputStream stream = jar.getInputStream(jar.getJarEntry("META-INF/ANKER.SF"))) {
                    Manifest sf = new Manifest(stream);
                    if (sf.getMainAttributes().getValue("SHA-256-Digest-Manifest") == null)
                        throw new SecurityException();
                }
                Files.write(Path.of(args[3]), publicDer, StandardOpenOption.CREATE_NEW);
            }
        }
        System.out.printf("{\"signed\":%s,\"payloadEntries\":%d,\"minSigners\":%d,\"maxSigners\":%d,\"certificateSha256\":%s,\"publicKeyAlgorithm\":%s}%n",
                signed, payload, minSigners, maxSigners, signed ? "\"" + args[2] + "\"" : "null",
                signed ? "\"" + publicKeyAlgorithm + "\"" : "null");
    }

    public static void main(String[] args) {
        try {
            if (args.length == 3 && args[0].equals("certificate")) {
                try (InputStream stream = Files.newInputStream(Path.of(args[1]))) {
                    X509Certificate cert = (X509Certificate) CertificateFactory.getInstance("X.509").generateCertificate(stream);
                    String algorithm = certificate(cert, args[2]);
                    System.out.println("{\"algorithm\":\"" + algorithm + "\"}");
                }
            } else {
                inspect(args);
            }
        } catch (Exception error) {
            System.err.println("AAB_JAR_VERIFICATION_FAILED");
            System.exit(1);
        }
    }
}
