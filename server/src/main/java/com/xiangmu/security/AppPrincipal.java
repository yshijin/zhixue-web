package com.xiangmu.security;

import com.xiangmu.domain.UserAccount;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

public class AppPrincipal implements UserDetails {
    public final String id;
    public final String username;
    public final String displayName;
    public final String role;
    public final String courseId;
    public final String classId;
    private final String passwordHash;

    public AppPrincipal(UserAccount u) {
        this.id = u.id;
        this.username = u.username;
        this.displayName = u.displayName;
        this.role = u.role;
        this.courseId = u.courseId;
        this.classId = u.classId;
        this.passwordHash = u.passwordHash;
    }

    public String roleLabel() {
        return switch (role) {
            case "course_leader" -> "课程负责人";
            case "teacher" -> "教师";
            default -> "学生";
        };
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        String authority = switch (role) {
            case "course_leader" -> "ROLE_COURSE_LEADER";
            case "teacher" -> "ROLE_TEACHER";
            default -> "ROLE_STUDENT";
        };
        return List.of(new SimpleGrantedAuthority(authority));
    }

    @Override public String getPassword() { return passwordHash; }
    @Override public String getUsername() { return username; }
    @Override public boolean isAccountNonExpired() { return true; }
    @Override public boolean isAccountNonLocked() { return true; }
    @Override public boolean isCredentialsNonExpired() { return true; }
    @Override public boolean isEnabled() { return true; }
}
