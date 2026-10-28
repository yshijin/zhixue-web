package com.xiangmu.service;

import com.xiangmu.domain.AuditLog;
import com.xiangmu.repo.AuditLogRepo;
import com.xiangmu.security.AppPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuditService {
    private final AuditLogRepo logs;

    public AuditService(AuditLogRepo logs) {
        this.logs = logs;
    }

    @Transactional
    public void log(AppPrincipal p, String action, String detail) {
        AuditLog l = new AuditLog();
        l.id = "l" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        l.operator = p == null ? "系统" : p.displayName;
        l.role = p == null ? "系统" : p.roleLabel();
        l.action = action == null ? "操作" : action;
        l.detail = detail;
        l.time = Instant.now();
        logs.save(l);
    }
}
