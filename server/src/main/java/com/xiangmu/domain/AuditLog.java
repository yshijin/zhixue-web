package com.xiangmu.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "audit_log")
public class AuditLog {
    @Id
    public String id;
    public String operator;
    public String role;
    public String action;
    @Column(columnDefinition = "text")
    public String detail;
    public Instant time;
}
