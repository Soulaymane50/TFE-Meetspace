package be.meetspace.repository;

import be.meetspace.entity.AuditAction;
import be.meetspace.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findByUserIdOrderByTimestampDesc(Long userId, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findByActionOrderByTimestampDesc(AuditAction action, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findByEntityTypeOrderByTimestampDesc(String entityType, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    Page<AuditLog> findByEntityTypeAndEntityIdOrderByTimestampDesc(String entityType, Long entityId, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    @Query("SELECT a FROM AuditLog a WHERE a.timestamp BETWEEN :start AND :end ORDER BY a.timestamp DESC")
    Page<AuditLog> findByTimestampBetween(@Param("start") LocalDateTime start, @Param("end") LocalDateTime end, Pageable pageable);

    @EntityGraph(attributePaths = "user")
    @Query("SELECT a FROM AuditLog a WHERE " +
           "(:userId IS NULL OR a.user.id = :userId) AND " +
           "(:action IS NULL OR a.action = :action) AND " +
           "(:entityType IS NULL OR a.entityType = :entityType) AND " +
           "(:startDate IS NULL OR a.timestamp >= :startDate) AND " +
           "(:endDate IS NULL OR a.timestamp <= :endDate) " +
           "ORDER BY a.timestamp DESC")
    Page<AuditLog> findWithFilters(
            @Param("userId") Long userId,
            @Param("action") AuditAction action,
            @Param("entityType") String entityType,
            @Param("startDate") LocalDateTime startDate,
            @Param("endDate") LocalDateTime endDate,
            Pageable pageable
    );

    @EntityGraph(attributePaths = "user")
    List<AuditLog> findByUserIdAndActionIn(Long userId, List<AuditAction> actions);
}

