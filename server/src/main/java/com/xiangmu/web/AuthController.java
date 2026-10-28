package com.xiangmu.web;

import com.xiangmu.security.AppPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;

    public AuthController(AuthenticationManager authenticationManager) {
        this.authenticationManager = authenticationManager;
    }

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest body, HttpServletRequest request) {
        if (body == null || body.username() == null || body.username().isBlank()
                || body.password() == null || body.password().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "请输入账号和密码"));
        }
        try {
            Authentication auth = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(body.username().trim(), body.password()));
            HttpSession old = request.getSession(false);
            if (old != null) old.invalidate();
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(auth);
            SecurityContextHolder.setContext(context);
            HttpSession session = request.getSession(true);
            session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
            return ResponseEntity.ok(userView((AppPrincipal) auth.getPrincipal()));
        } catch (AuthenticationException e) {
            return ResponseEntity.status(401).body(Map.of("message", "账号或密码错误"));
        }
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AppPrincipal p)) {
            return ResponseEntity.status(401).body(Map.of("message", "未登录"));
        }
        return ResponseEntity.ok(userView(p));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.invalidate();
        SecurityContextHolder.clearContext();
        return ResponseEntity.ok(Map.of("ok", true));
    }

    public static Map<String, Object> userView(AppPrincipal p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("username", p.username);
        m.put("name", p.displayName);
        m.put("role", p.role);
        m.put("roleLabel", p.roleLabel());
        m.put("courseId", p.courseId);
        m.put("classId", p.classId);
        m.put("home", switch (p.role) {
            case "course_leader" -> "cl/dashboard";
            case "teacher" -> "t/dashboard";
            default -> "s/tests";
        });
        return m;
    }
}
