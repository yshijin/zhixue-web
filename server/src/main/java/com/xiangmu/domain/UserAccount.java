package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "app_user")
public class UserAccount {
    @Id
    public String id;
    @Column(nullable = false, unique = true)
    public String username;
    @Column(nullable = false)
    public String passwordHash;
    public String displayName;
    public String role;
    public String courseId;
    public String classId;
    public boolean enabled = true;
}
