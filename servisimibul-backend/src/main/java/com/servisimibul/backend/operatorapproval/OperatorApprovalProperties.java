package com.servisimibul.backend.operatorapproval;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties("app.operator-approval")
public record OperatorApprovalProperties(boolean required) {
}
