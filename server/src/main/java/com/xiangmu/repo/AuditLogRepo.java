package com.xiangmu.repo;

import com.xiangmu.domain.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface AuditLogRepo extends JpaRepository<AuditLog, String> {
    List<AuditLog> findTop100ByOrderByTimeDesc();
}
