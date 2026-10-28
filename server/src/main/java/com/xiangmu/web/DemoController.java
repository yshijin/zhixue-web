package com.xiangmu.web;

import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.SeedService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/demo")
public class DemoController {
    private final SeedService seed;
    private final boolean enabled;

    public DemoController(SeedService seed, @Value("${app.demo-reset-enabled:false}") boolean enabled) {
        this.seed = seed;
        this.enabled = enabled;
    }

    @PostMapping("/reset")
    public Map<String, Object> reset(@AuthenticationPrincipal AppPrincipal p) {
        if (!"course_leader".equals(p.role)) throw ApiException.forbidden("仅课程负责人可以重置演示数据");
        if (!enabled) throw ApiException.forbidden("演示数据重置未启用，请设置 DEMO_RESET_ENABLED=true 后重启服务");
        try {
            seed.resetDemoData();
            return Map.of("ok", true, "message", "演示数据已重置");
        } catch (Exception e) {
            throw ApiException.bad("重置失败：" + e.getMessage());
        }
    }
}
