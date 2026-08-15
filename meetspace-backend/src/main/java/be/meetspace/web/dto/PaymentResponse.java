package be.meetspace.web.dto;

public class PaymentResponse {
    private String clientSecret;
    private String publicKey;
    private String paymentIntentId;
    private long expiresInSeconds;

    public PaymentResponse(String clientSecret, String publicKey) {
        this(clientSecret, publicKey, null, 900L);
    }

    public PaymentResponse(String clientSecret, String publicKey, String paymentIntentId, long expiresInSeconds) {
        this.clientSecret = clientSecret;
        this.publicKey = publicKey;
        this.paymentIntentId = paymentIntentId;
        this.expiresInSeconds = expiresInSeconds;
    }

    public String getClientSecret() { return clientSecret; }
    public String getPublicKey() { return publicKey; }
    public String getPaymentIntentId() { return paymentIntentId; }
    public long getExpiresInSeconds() { return expiresInSeconds; }
}
