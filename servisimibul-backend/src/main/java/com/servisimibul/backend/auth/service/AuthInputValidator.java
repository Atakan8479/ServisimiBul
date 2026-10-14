package com.servisimibul.backend.auth.service;

import com.servisimibul.backend.auth.exception.AuthValidationException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.regex.Pattern;

@Component
public class AuthInputValidator {

    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private static final Pattern E164_PHONE = Pattern.compile("^\\+[0-9]{8,15}$");

    public String email(String value) {
        String normalized = value == null ? "" : value.strip().toLowerCase(Locale.ROOT);
        if (normalized.length() > 254 || !EMAIL.matcher(normalized).matches()) {
            throw new AuthValidationException("email", "Enter a valid email address");
        }
        return normalized;
    }

    public String password(String value, String field) {
        int characters = value == null ? 0 : value.codePointCount(0, value.length());
        int bytes = value == null ? 0 : value.getBytes(StandardCharsets.UTF_8).length;
        if (characters < 12 || characters > 64 || bytes > 72) {
            throw new AuthValidationException(
                    field,
                    "Password must be 12-64 characters and at most 72 UTF-8 bytes"
            );
        }
        return value;
    }

    String businessName(String value) {
        String normalized = value == null ? "" : value.strip();
        int characters = normalized.codePointCount(0, normalized.length());
        if (characters < 2 || characters > 120) {
            throw new AuthValidationException("businessName", "Business name must be 2-120 characters");
        }
        return normalized;
    }

    String phone(String value) {
        String normalized = value == null ? "" : value.strip().replaceAll("[\\s().-]", "");
        if (normalized.startsWith("00")) {
            normalized = "+" + normalized.substring(2);
        } else if (normalized.matches("0[0-9]{10}")) {
            normalized = "+90" + normalized.substring(1);
        } else if (normalized.matches("[0-9]{10}")) {
            normalized = "+90" + normalized;
        } else if (normalized.matches("90[0-9]{10}")) {
            normalized = "+" + normalized;
        }
        if (!E164_PHONE.matcher(normalized).matches()) {
            throw new AuthValidationException("contactPhone", "Enter a valid international phone number");
        }
        return normalized;
    }
}
