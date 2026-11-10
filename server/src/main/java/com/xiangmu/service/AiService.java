package com.xiangmu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangmu.domain.AiProvider;
import com.xiangmu.repo.AiProviderRepo;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AiService {
    private final ObjectMapper json;
    private final AiProviderRepo providers;
    private final boolean envEnabled;
    private final String envBaseUrl;
    private final String envApiKey;
    private final String envModel;
    private final int timeoutSeconds;
    private final HttpClient http;

    public AiService(ObjectMapper json,
                     AiProviderRepo providers,
                     @Value("${app.ai.enabled:false}") boolean envEnabled,
                     @Value("${app.ai.base-url:https://api.deepseek.com/v1}") String envBaseUrl,
                     @Value("${app.ai.api-key:}") String envApiKey,
                     @Value("${app.ai.model:deepseek-chat}") String envModel,
                     @Value("${app.ai.timeout-seconds:25}") int timeoutSeconds) {
        this.json = json;
        this.providers = providers;
        this.envEnabled = envEnabled;
        this.envBaseUrl = envBaseUrl;
        this.envApiKey = envApiKey;
        this.envModel = envModel;
        this.timeoutSeconds = timeoutSeconds;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(5, Math.min(timeoutSeconds, 60))))
                .build();
    }

    private record Config(boolean enabled, String id, String name, String baseUrl,
                          String apiKey, String model, String source) {}

    private Config current() {
        List<AiProvider> all = providers.findAll();
        AiProvider active = all.stream().filter(p -> p.active).findFirst().orElse(null);
        if (active != null) {
            return new Config(true, active.id, active.name, active.baseUrl, active.apiKey, active.model, "database");
        }
        if (all.isEmpty() && envEnabled) {
            return new Config(true, "env", "环境变量模型", envBaseUrl, envApiKey, envModel, "env");
        }
        return new Config(false, null, "未选择供应商", envBaseUrl, "", envModel, "none");
    }

    public boolean configured() {
        return ready(current());
    }

    public Map<String, Object> status() {
        Config c = current();
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", c.enabled);
        out.put("configured", ready(c));
        out.put("model", c.model);
        out.put("provider", c.name);
        out.put("providerId", c.id);
        out.put("baseUrl", c.baseUrl);
        out.put("hasKey", !blank(c.apiKey));
        out.put("needsKey", !blank(c.baseUrl) && !blank(c.model) && blank(c.apiKey) && !isLocal(c.baseUrl));
        out.put("protocol", "OpenAI-compatible");
        out.put("source", c.source);
        return out;
    }

    public String diagnose(String context) {
        Config c = current();
        if (!ready(c)) {
            throw new IllegalStateException("当前模型未就绪：请课程负责人在「模型设置」中选择供应商并填写 API Key；本地规则诊断仍可正常使用");
        }
        return chat(c, "你是职业院校课程测评的学习诊断助手。只依据给定的分数、知识点和错题事实，"
                        + "用简洁、具体、可执行的中文给出一段学习诊断与 3 条建议。不要虚构未提供的统计，不要改变分数。",
                context, 700, 0.4);
    }

    public Map<String, Object> test(AiProvider provider) {
        if (provider == null) throw new IllegalStateException("供应商不存在");
        Config c = new Config(true, provider.id, provider.name, provider.baseUrl, provider.apiKey, provider.model, "database");
        if (blank(c.baseUrl) || blank(c.model)) {
            throw new IllegalStateException("请先填写接口地址和模型 ID");
        }
        long start = System.currentTimeMillis();
        String reply = chat(c, "你是接口连接测试助手，只回复一句简短确认。", "请只回复：连接成功", 16, 0.0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ok", true);
        out.put("latencyMs", System.currentTimeMillis() - start);
        out.put("model", c.model);
        out.put("provider", c.name);
        out.put("reply", reply);
        return out;
    }

    private String chat(Config c, String systemPrompt, String userPrompt, int maxTokens, double temperature) {
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", c.model);
            body.put("temperature", temperature);
            body.put("max_tokens", maxTokens);
            body.put("messages", List.of(
                    Map.of("role", "system", "content", systemPrompt),
                    Map.of("role", "user", "content", userPrompt)
            ));
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint(c.baseUrl)))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
            if (!blank(c.apiKey)) builder.header("Authorization", "Bearer " + c.apiKey);
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                String detail = response.body() == null ? "" : response.body().trim();
                if (detail.length() > 300) detail = detail.substring(0, 300) + "…";
                throw new IllegalStateException("模型接口返回 HTTP " + response.statusCode()
                        + (detail.isBlank() ? "" : "：" + detail));
            }
            JsonNode root = json.readTree(response.body());
            String text = root.path("choices").path(0).path("message").path("content").asText("");
            if (text.isBlank()) text = root.path("choices").path(0).path("text").asText("");
            if (text.isBlank()) throw new IllegalStateException("模型接口未返回内容");
            return text.trim();
        } catch (IllegalStateException e) {
            throw e;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("模型调用被中断", e);
        } catch (Exception e) {
            throw new IllegalStateException("模型调用失败：" + e.getMessage(), e);
        }
    }

    private String endpoint(String baseUrl) {
        String value = baseUrl == null ? "" : baseUrl.trim();
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        if (value.toLowerCase(Locale.ROOT).endsWith("/chat/completions")) return value;
        return value + "/chat/completions";
    }

    private boolean ready(Config c) {
        if (!c.enabled || blank(c.baseUrl) || blank(c.model)) return false;
        return !blank(c.apiKey) || isLocal(c.baseUrl);
    }

    private boolean isLocal(String baseUrl) {
        try {
            String host = URI.create(baseUrl).getHost();
            if (host == null) return false;
            String h = host.toLowerCase(Locale.ROOT);
            return h.equals("localhost") || h.equals("127.0.0.1") || h.equals("::1") || h.equals("0.0.0.0");
        } catch (Exception e) {
            return false;
        }
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
