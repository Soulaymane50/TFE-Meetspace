package be.meetspace.web.dto;

public class PaymentResponse {
    private String clientSecret;
    private String publicKey;

    public PaymentResponse(String clientSecret, String publicKey) {
        this.clientSecret = clientSecret;
        this.publicKey = publicKey;
    }

    public String getClientSecret() { return clientSecret; }
    public String getPublicKey() { return publicKey; }
}
