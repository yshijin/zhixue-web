package com.xiangmu.web;

import com.xiangmu.domain.AiProvider;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.AiProviderService;
import com.xiangmu.service.AiService;
import com.xiangmu.service.AuditService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai/providers")
public class AiProviderController {
    private final AiProviderService providers;
    private final AiService ai;
    private final AuditService audit;

    public AiProviderController(AiProviderService providers, AiService ai, AuditService audit) {
        this.providers = providers;
        this.ai = ai;
        this.audit = audit;
    }

    @GetMapping
    public List<Map<String, Object>> list(@AuthenticationPrincipal AppPrincipal p) {
        requireCl(p);
        return providers.listViews();
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal AppPrincipal p,
                                      @RequestBody AiProviderService.ProviderInput input) {
        requireCl(p);
        Map<String, Object> created;
        try {
            created = providers.create(input);
        } catch (IllegalArgumentException e) {
            throw ApiException.bad(e.getMessage());
        }
        audit.log(p, "模型", "新增 AI 供应商「" + created.get("name") + "」（" + created.get("model") + "）");
        return created;
    }

    @PutMapping("/{id}")
    public Map<String, Object> update(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id,
                                      @RequestBody AiProviderService.ProviderInput input) {
        requireCl(p);
        Map<String, Object> updated;
        try {
            updated = providers.update(id, input);
        } catch (IllegalArgumentException e) {
            throw ApiException.bad(e.getMessage());
        }
        audit.log(p, "模型", "更新 AI 供应商「" + updated.get("name") + "」（" + updated.get("model") + "）");
        return updated;
    }

    @DeleteMapping("/{id}")
    public Map<String, Object> delete(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        AiProvider target;
        try {
            target = providers.find(id);
        } catch (Exception e) {
            throw ApiException.notFound("供应商不存在");
        }
        Map<String, Object> result;
        try {
            result = providers.delete(id);
        } catch (IllegalArgumentException e) {
            throw ApiException.bad(e.getMessage());
        }
        String detail = "删除 AI 供应商「" + target.name + "」（" + target.model + "）";
        if (result.get("activeName") != null) detail += "，已自动切换到「" + result.get("activeName") + "」";
        audit.log(p, "模型", detail);
        return result;
    }

    @PostMapping("/{id}/activate")
    public Map<String, Object> activate(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        Map<String, Object> active;
        try {
            active = providers.activate(id);
        } catch (IllegalArgumentException e) {
            throw ApiException.bad(e.getMessage());
        }
        audit.log(p, "模型", "切换 AI 模型为「" + active.get("name") + "」（" + active.get("model") + "）");
        return active;
    }

    @PostMapping("/{id}/test")
    public Map<String, Object> test(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        AiProvider target;
        try {
            target = providers.find(id);
        } catch (Exception e) {
            throw ApiException.notFound("供应商不存在");
        }
        try {
            Map<String, Object> result = ai.test(target);
            audit.log(p, "模型", "测试 AI 供应商「" + target.name + "」连接成功（"
                    + result.get("latencyMs") + " ms）");
            return result;
        } catch (IllegalStateException e) {
            audit.log(p, "模型", "测试 AI 供应商「" + target.name + "」失败：" + e.getMessage());
            throw new ApiException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private void requireCl(AppPrincipal p) {
        if (!"course_leader".equals(p.role)) throw ApiException.forbidden("仅课程负责人可以管理模型供应商");
    }
}
