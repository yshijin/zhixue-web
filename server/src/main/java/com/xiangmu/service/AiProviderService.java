package com.xiangmu.service;

import com.xiangmu.domain.AiProvider;
import com.xiangmu.repo.AiProviderRepo;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.time.Instant;
import java.util.*;

@Service
public class AiProviderService {
    private final AiProviderRepo repo;
    private final String defaultBaseUrl;
    private final String defaultApiKey;
    private final String defaultModel;

    public AiProviderService(AiProviderRepo repo,
                             @Value("${app.ai.base-url:https://api.deepseek.com/v1}") String defaultBaseUrl,
                             @Value("${app.ai.api-key:}") String defaultApiKey,
                             @Value("${app.ai.model:deepseek-chat}") String defaultModel) {
        this.repo = repo;
        this.defaultBaseUrl = defaultBaseUrl;
        this.defaultApiKey = defaultApiKey;
        this.defaultModel = defaultModel;
    }

    public record ProviderInput(String name, String baseUrl, String model, String apiKey, Boolean clearApiKey) {}

    @PostConstruct
    public void init() {
        ensureSeed();
    }

    @Transactional
    public void ensureSeed() {
        List<AiProvider> all = repo.findAll(Sort.by(Sort.Direction.ASC, "createdAt"));
        if (!all.isEmpty()) {
            if (all.stream().noneMatch(p -> p.active)) {
                AiProvider first = all.get(0);
                first.active = true;
                first.updatedAt = Instant.now().toString();
                repo.save(first);
            }
            return;
        }
        AiProvider p = new AiProvider();
        p.id = "aip" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        p.name = defaultName(defaultBaseUrl);
        p.baseUrl = defaultBaseUrl == null ? "" : defaultBaseUrl.trim();
        p.apiKey = blank(defaultApiKey) ? null : defaultApiKey.trim();
        p.model = defaultModel == null ? "deepseek-chat" : defaultModel.trim();
        p.active = true;
        p.createdAt = Instant.now().toString();
        p.updatedAt = p.createdAt;
        repo.save(p);
    }

    public List<Map<String, Object>> listViews() {
        ensureSeed();
        return repo.findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream().map(this::view).toList();
    }

    public AiProvider find(String id) {
        return repo.findById(id).orElseThrow(() -> new NoSuchElementException("供应商不存在"));
    }

    public Map<String, Object> view(AiProvider p) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", p.id);
        out.put("name", p.name);
        out.put("baseUrl", p.baseUrl);
        out.put("model", p.model);
        out.put("active", p.active);
        out.put("hasKey", !blank(p.apiKey));
        out.put("keyHint", mask(p.apiKey));
        out.put("createdAt", p.createdAt);
        out.put("updatedAt", p.updatedAt);
        return out;
    }

    @Transactional
    public Map<String, Object> create(ProviderInput input) {
        String name = required(input == null ? null : input.name(), "请填写供应商名称");
        String baseUrl = validBaseUrl(input == null ? null : input.baseUrl());
        String model = required(input == null ? null : input.model(), "请填写模型 ID");
        if (name.length() > 60) throw new IllegalArgumentException("供应商名称不能超过 60 个字符");
        if (model.length() > 120) throw new IllegalArgumentException("模型 ID 不能超过 120 个字符");
        if (nameExists(name, null)) throw new IllegalArgumentException("供应商名称已存在");
        AiProvider p = new AiProvider();
        p.id = "aip" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        p.name = name;
        p.baseUrl = baseUrl;
        p.model = model;
        p.apiKey = blank(input.apiKey()) ? null : input.apiKey().trim();
        p.active = false;
        p.createdAt = Instant.now().toString();
        p.updatedAt = p.createdAt;
        repo.save(p);
        return view(p);
    }

    @Transactional
    public Map<String, Object> update(String id, ProviderInput input) {
        AiProvider p = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("供应商不存在"));
        String name = required(input == null ? null : input.name(), "请填写供应商名称");
        String baseUrl = validBaseUrl(input == null ? null : input.baseUrl());
        String model = required(input == null ? null : input.model(), "请填写模型 ID");
        if (name.length() > 60) throw new IllegalArgumentException("供应商名称不能超过 60 个字符");
        if (model.length() > 120) throw new IllegalArgumentException("模型 ID 不能超过 120 个字符");
        if (nameExists(name, id)) throw new IllegalArgumentException("供应商名称已存在");
        p.name = name;
        p.baseUrl = baseUrl;
        p.model = model;
        if (Boolean.TRUE.equals(input.clearApiKey())) {
            p.apiKey = null;
        } else if (!blank(input.apiKey())) {
            p.apiKey = input.apiKey().trim();
        }
        p.updatedAt = Instant.now().toString();
        repo.save(p);
        return view(p);
    }

    @Transactional
    public Map<String, Object> activate(String id) {
        AiProvider target = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("供应商不存在"));
        for (AiProvider p : repo.findAll()) {
            boolean active = p.id.equals(target.id);
            if (p.active != active) {
                p.active = active;
                p.updatedAt = Instant.now().toString();
                repo.save(p);
            }
        }
        return view(target);
    }

    @Transactional
    public Map<String, Object> delete(String id) {
        AiProvider target = repo.findById(id).orElseThrow(() -> new IllegalArgumentException("供应商不存在"));
        if (repo.count() <= 1) throw new IllegalArgumentException("至少保留一个供应商配置");
        AiProvider next = null;
        if (target.active) {
            next = repo.findAll(Sort.by(Sort.Direction.ASC, "createdAt")).stream()
                    .filter(p -> !p.id.equals(target.id)).findFirst().orElse(null);
        }
        repo.delete(target);
        if (next != null) {
            next.active = true;
            next.updatedAt = Instant.now().toString();
            repo.save(next);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("activeId", next == null ? null : next.id);
        out.put("activeName", next == null ? null : next.name);
        return out;
    }

    private boolean nameExists(String name, String exceptId) {
        String normalized = name.trim().toLowerCase(Locale.ROOT);
        return repo.findAll().stream().anyMatch(p ->
                (exceptId == null || !p.id.equals(exceptId))
                        && p.name != null && p.name.trim().toLowerCase(Locale.ROOT).equals(normalized));
    }

    private String required(String value, String message) {
        if (blank(value)) throw new IllegalArgumentException(message);
        return value.trim();
    }

    private String validBaseUrl(String raw) {
        if (blank(raw)) throw new IllegalArgumentException("请填写接口地址");
        String value = raw.trim();
        if (value.length() > 500) throw new IllegalArgumentException("接口地址过长");
        try {
            URI uri = URI.create(value);
            String scheme = uri.getScheme();
            if (scheme == null || (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme))
                    || uri.getHost() == null) {
                throw new IllegalArgumentException("接口地址必须是有效的 http 或 https 地址");
            }
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("接口地址必须是有效的 http 或 https 地址");
        }
        return value;
    }

    private String defaultName(String baseUrl) {
        String url = baseUrl == null ? "" : baseUrl.toLowerCase(Locale.ROOT);
        if (url.contains("deepseek")) return "DeepSeek（默认）";
        if (url.contains("openai")) return "OpenAI（默认）";
        if (url.contains("dashscope") || url.contains("aliyun")) return "通义千问（默认）";
        if (url.contains("moonshot")) return "Kimi（默认）";
        if (url.contains("localhost") || url.contains("127.0.0.1")) return "本地模型（默认）";
        return "默认供应商";
    }

    private String mask(String key) {
        if (blank(key)) return "";
        if (key.length() <= 4) return "••••";
        return "••••" + key.substring(key.length() - 4);
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
