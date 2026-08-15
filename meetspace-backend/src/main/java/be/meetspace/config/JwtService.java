package be.meetspace.config;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.security.Key;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);
    private static final int MIN_KEY_BYTES = 32;

    private final String secret;
    private final long expirationMillis;
    private final Key key;

    public JwtService(
            @Value("${app.security.jwt.secret}") String secret,
            @Value("${app.security.jwt.expiration}") long expirationMillis) {
        this.expirationMillis = expirationMillis;

        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                "JWT_SECRET is not configured. Please set the JWT_SECRET environment variable with at least 32 characters.");
        }

        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);

        if (keyBytes.length < MIN_KEY_BYTES) {
            throw new IllegalStateException(
                String.format("JWT_SECRET is too short (%d bytes). It must be at least %d bytes (32 characters).",
                    keyBytes.length, MIN_KEY_BYTES));
        }

        this.secret = secret;
        this.key = Keys.hmacShaKeyFor(keyBytes);
        log.info("JWT service initialized successfully with a secure secret key.");
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String generateToken(UserDetails userDetails) {
        return generateToken(userDetails, 0);
    }

    public String generateToken(UserDetails userDetails, int tokenVersion) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("tokenVersion", tokenVersion);
        return createToken(claims, userDetails.getUsername());
    }

    public int extractTokenVersion(String token) {
        Object value = extractAllClaims(token).get("tokenVersion");
        if (value instanceof Number number) {
            return number.intValue();
        }
        return 0;
    }

    public boolean isTokenValid(String token, UserDetails userDetails) {
        final String username = extractUsername(token);
        return (username.equals(userDetails.getUsername()) && !isTokenExpired(token));
    }

    private String createToken(Map<String, Object> claims, String subject) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expirationMillis);

        return Jwts.builder()
                .setClaims(claims)
                .setSubject(subject)
                .setIssuedAt(now)
                .setExpiration(expiry)
                .signWith(key, SignatureAlgorithm.HS256)
                .compact();
    }

    private boolean isTokenExpired(String token) {
        return extractAllClaims(token).getExpiration().before(new Date());
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(key)
                .build()
                .parseClaimsJws(token)
                .getBody();
    }
}

