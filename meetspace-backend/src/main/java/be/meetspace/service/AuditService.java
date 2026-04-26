package be.meetspace.service;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.AuditLog;
import be.meetspace.entity.User;
import be.meetspace.repository.AuditLogRepository;
import be.meetspace.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class AuditService {

    private static final Logger auditLogger = LoggerFactory.getLogger("AUDIT");
    private static final Logger securityLogger = LoggerFactory.getLogger("SECURITY");

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    public AuditService(AuditLogRepository auditLogRepository, UserRepository userRepository) {
        this.auditLogRepository = auditLogRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void log(AuditAction action, String entityType, Long entityId, String details) {
        log(action, entityType, entityId, details, null, null, null);
    }

    @Transactional
    public void log(AuditAction action, String entityType, Long entityId, String details, String ipAddress) {
        log(action, entityType, entityId, details, null, null, ipAddress);
    }

    @Transactional
    public void log(AuditAction action, String entityType, Long entityId, String details,
                    String oldValue, String newValue, String ipAddress) {
        User currentUser = getCurrentUser();

        AuditLog auditLog = new AuditLog();
        auditLog.setUser(currentUser);
        auditLog.setAction(action);
        auditLog.setEntityType(entityType);
        auditLog.setEntityId(entityId);
        auditLog.setDetails(details);
        auditLog.setOldValue(oldValue);
        auditLog.setNewValue(newValue);
        auditLog.setIpAddress(ipAddress);

        auditLogRepository.save(auditLog);

        // Log to file as well
        String userName = currentUser != null ? currentUser.getEmail() : "ANONYMOUS";
        String logMessage = String.format("ACTION=%s | USER=%s | ENTITY=%s | ID=%s | IP=%s | DETAILS=%s",
                action, userName, entityType, entityId, ipAddress, details);

        if (isSecurityAction(action)) {
            securityLogger.info(logMessage);
        } else {
            auditLogger.info(logMessage);
        }
    }

    @Transactional
    public void logSecurityEvent(AuditAction action, String email, String details, String ipAddress) {
        User user = userRepository.findByEmail(email).orElse(null);

        AuditLog auditLog = new AuditLog();
        auditLog.setUser(user);
        auditLog.setAction(action);
        auditLog.setEntityType("USER");
        auditLog.setEntityId(user != null ? user.getId() : null);
        auditLog.setDetails(details);
        auditLog.setIpAddress(ipAddress);

        auditLogRepository.save(auditLog);

        String logMessage = String.format("ACTION=%s | USER=%s | IP=%s | DETAILS=%s",
                action, email, ipAddress, details);
        securityLogger.info(logMessage);
    }

    public Page<AuditLog> getAllLogs(Pageable pageable) {
        return auditLogRepository.findAllByOrderByTimestampDesc(pageable);
    }

    public Page<AuditLog> getLogsByUser(Long userId, Pageable pageable) {
        return auditLogRepository.findByUserIdOrderByTimestampDesc(userId, pageable);
    }

    public Page<AuditLog> getLogsByAction(AuditAction action, Pageable pageable) {
        return auditLogRepository.findByActionOrderByTimestampDesc(action, pageable);
    }

    public Page<AuditLog> getLogsByEntityType(String entityType, Pageable pageable) {
        return auditLogRepository.findByEntityTypeOrderByTimestampDesc(entityType, pageable);
    }

    public Page<AuditLog> getLogsByEntity(String entityType, Long entityId, Pageable pageable) {
        return auditLogRepository.findByEntityTypeAndEntityIdOrderByTimestampDesc(entityType, entityId, pageable);
    }

    public Page<AuditLog> getLogsWithFilters(Long userId, AuditAction action, String entityType,
                                              LocalDateTime startDate, LocalDateTime endDate, Pageable pageable) {
        return auditLogRepository.findWithFilters(userId, action, entityType, startDate, endDate, pageable);
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal())) {
            String email = auth.getName();
            return userRepository.findByEmail(email).orElse(null);
        }
        return null;
    }

    private boolean isSecurityAction(AuditAction action) {
        return action == AuditAction.LOGIN_SUCCESS ||
               action == AuditAction.LOGIN_FAILURE ||
               action == AuditAction.LOGOUT ||
               action == AuditAction.PASSWORD_CHANGE ||
               action == AuditAction.PASSWORD_RESET_REQUEST ||
               action == AuditAction.PASSWORD_RESET_COMPLETE ||
               action == AuditAction.USER_ROLE_CHANGE ||
               action == AuditAction.USER_STATUS_CHANGE;
    }

    public static String getClientIpAddress(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }
        return request.getRemoteAddr();
    }
}

