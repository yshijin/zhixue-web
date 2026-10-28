package com.xiangmu.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AiService {
    private final ObjectMapper json;
    private final boolean enabled;
    private final String baseUrl;
    private final String apiKey;
    private final String model;
    private final int timeoutSeconds;
    private final HttpClient http;

    public AiService(ObjectMapper json,
                     @Value("${app.ai.enabled:false}") boolean enabled,
                     @Value("${app.ai.base-url:https://api.deepseek.com/v1}") String baseUrl,
                     @Value("${app.ai.api-key:}") String apiKey,
                     @Value("${app.ai.model:deepseek-chat}") String model,
                     @Value("${app.ai.timeout-seconds:25}") int timeoutSeconds) {
        this.json = json;
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
        this.model = model;
        this.timeoutSeconds = timeoutSeconds;
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(Math.max(5, Math.min(timeoutSeconds, 60))))
                .build();
    }

    public boolean configured() {
        return enabled && apiKey != null && !apiKey.isBlank();
    }

    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("enabled", enabled);
        out.put("configured", configured());
        out.put("model", model);
        out.put("provider", "OpenAI-compatible");
        return out;
    }

    public String diagnose(String context) {
        if (!configured()) throw new IllegalStateException("云端 AI 未配置，请设置 AI_ENABLED=true 与 AI_API_KEY");
        try {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("model", model);
            body.put("temperature", 0.4);
            body.put("max_tokens", 700);
            body.put("messages", List.of(
                    Map.of("role", "system", "content",
                            "你是职业院校课程测评的学习诊断助手。只依据给定的分数、知识点和错题事实，"
                                    + "用简洁、具体、可执行的中文给出一段学习诊断与 3 条建议。不要虚构未提供的统计，不要改变分数。"),
                    Map.of("role", "user", "content", context)
            ));
            String url = baseUrl.endsWith("/") ? baseUrl + "chat/completions" : baseUrl + "/chat/completions";
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IllegalStateException("云端 AI 返回 HTTP " + response.statusCode());
            }
            JsonNode root = json.readTree(response.body());
            String text = root.path("choices").path(0).path("message").path("content").asText("");
            if (text.isBlank()) throw new IllegalStateException("云端 AI 未返回诊断内容");
            return text.trim();
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("云端 AI 调用失败：" + e.getMessage(), e);
        }
    }
}
