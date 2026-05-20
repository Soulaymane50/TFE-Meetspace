package be.meetspace.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PasswordPolicyService {

    public static final String ERROR_CODE = "PASSWORD_WEAK";
    public static final int MIN_LENGTH = 8;

    public void validateOrThrow(String password) {
        if (!isValid(password)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, ERROR_CODE);
        }
    }

    public boolean isValid(String password) {
        if (password == null || password.length() < MIN_LENGTH) {
            return false;
        }

        boolean hasUppercase = false;
        boolean hasLowercase = false;
        boolean hasDigit = false;
        boolean hasSpecial = false;

        for (int i = 0; i < password.length(); i++) {
            char current = password.charAt(i);
            if (Character.isUpperCase(current)) {
                hasUppercase = true;
            } else if (Character.isLowerCase(current)) {
                hasLowercase = true;
            } else if (Character.isDigit(current)) {
                hasDigit = true;
            } else {
                hasSpecial = true;
            }
        }

        return hasUppercase && hasLowercase && hasDigit && hasSpecial;
    }
}
