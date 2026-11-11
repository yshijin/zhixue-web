package com.xiangmu.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.xiangmu.domain.Attempt;
import com.xiangmu.domain.Paper;
import com.xiangmu.domain.Question;
import com.xiangmu.repo.AttemptRepo;
import com.xiangmu.repo.PaperRepo;
import com.xiangmu.repo.QuestionRepo;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

@Service
public class AttemptService {
    private final AttemptRepo attempts;
    private final PaperRepo papers;
    private final QuestionRepo questions;
    private final ApiMapper mapper;
    private final AuditService audit;

    public AttemptService(AttemptRepo attempts, PaperRepo papers, QuestionRepo questions,
                          ApiMapper mapper, AuditService audit) {
        this.attempts = attempts;
        this.papers = papers;
        this.questions = questions;
        this.mapper = mapper;
        this.audit = audit;
    }

    public record StartRequest(String paperId) {}
    public record SubmitRequest(Map<String, String> answers) {}

    @Transactional
    public synchronized Map<String, Object> start(AppPrincipal p, String paperId) {
        requireStudent(p);
        Paper paper = papers.findById(paperId).orElseThrow(() -> ApiException.notFound("试卷不存在"));
        requireVisible(paper, p);
        if ("draft".equals(paper.status)) throw ApiException.forbidden("试卷尚未发布");
        Instant now = Instant.now();
        if (paper.startAt != null && now.isBefore(paper.startAt)) throw ApiException.conflict("测评尚未开始");
        Attempt existing = attempts.findByPaperIdAndStudentId(paperId, p.id).orElse(null);
        if (existing != null) {
            if ("submitted".equals(existing.status)) return attemptView(existing, null);
            if (isExpired(existing, paper, now)) {
                submitInternal(existing, paper, null, p, now);
                return attemptView(existing, "考试时间已结束，系统已自动交卷");
            }
            return attemptView(existing, null);
        }
        if (paper.endAt != null && now.isAfter(paper.endAt)) throw ApiException.conflict("测评已结束");
        Attempt a = new Attempt();
        a.id = "a" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        a.paperId = paperId;
        a.studentId = p.id;
        a.answersJson = "{}";
        a.score = 0;
        a.total = totalOf(paper);
        a.correctCount = 0;
        a.startedAt = now;
        a.updatedAt = now;
        a.status = "in_progress";
        a.timeUsed = 0;
        attempts.save(a);
        if (paper.ownerStudentId == null) audit.log(p, "考试", "开始作答「" + paper.name + "」");
        return attemptView(a, null);
    }

    @Transactional
    public Map<String, Object> save(AppPrincipal p, String attemptId, Map<String, String> answers) {
        requireStudent(p);
        Attempt a = attempts.findForUpdate(attemptId).orElseThrow(() -> ApiException.notFound("作答记录不存在"));
        if (!p.id.equals(a.studentId)) throw ApiException.forbidden("不能修改他人的作答");
        if ("submitted".equals(a.status)) throw ApiException.conflict("本次作答已提交");
        Paper paper = papers.findById(a.paperId).orElseThrow(() -> ApiException.notFound("试卷不存在"));
        Instant now = Instant.now();
        if (isExpired(a, paper, now)) {
            submitInternal(a, paper, answers, p, now);
            Map<String, Object> out = attemptView(a, "考试时间已结束，系统已自动交卷");
            out.put("saved", false);
            return out;
        }
        a.answersJson = mapper.write(answers == null ? Map.of() : answers);
        a.updatedAt = now;
        attempts.save(a);
        Map<String, Object> out = attemptView(a, null);
        out.put("saved", true);
        return out;
    }

    @Transactional
    public Map<String, Object> submit(AppPrincipal p, String attemptId, Map<String, String> answers) {
        requireStudent(p);
        Attempt a = attempts.findForUpdate(attemptId).orElseThrow(() -> ApiException.notFound("作答记录不存在"));
        if (!p.id.equals(a.studentId)) throw ApiException.forbidden("不能提交他人的作答");
        if ("submitted".equals(a.status)) return attemptView(a, null);
        Paper paper = papers.findById(a.paperId).orElseThrow(() -> ApiException.notFound("试卷不存在"));
        submitInternal(a, paper, answers, p, Instant.now());
        return attemptView(a, null);
    }

    private void submitInternal(Attempt a, Paper paper, Map<String, String> incoming, AppPrincipal p, Instant now) {
        if ("submitted".equals(a.status)) return;
        Map<String, String> answers = incoming != null
                ? incoming
                : mapper.read(a.answersJson, new TypeReference<Map<String, String>>() {}, Map.of());
        Map<String, Question> questionMap = new HashMap<>();
        for (Question q : questions.findAll()) questionMap.put(q.id, q);
        List<Map<String, Object>> items = mapper.read(paper.itemsJson,
                new TypeReference<List<Map<String, Object>>>() {}, List.of());
        int score = 0;
        int total = 0;
        int correctCount = 0;
        for (Map<String, Object> item : items) {
            String qid = String.valueOf(item.get("qid"));
            int points = item.get("score") instanceof Number n ? n.intValue() : 0;
            total += points;
            Question q = questionMap.get(qid);
            if (q == null) continue;
            if (normalize(answers.get(qid), q.type).equals(normalize(q.answer, q.type))) {
                score += points;
                correctCount++;
            }
        }
        long seconds = a.startedAt == null ? 0 : Math.max(0, Duration.between(a.startedAt, now).getSeconds());
        a.answersJson = mapper.write(answers);
        a.score = score;
        a.total = total;
        a.correctCount = correctCount;
        a.submittedAt = now;
        a.updatedAt = now;
        // 与种子数据和界面口径保持一致：用时按分钟保存。
        a.timeUsed = (int) Math.min(Integer.MAX_VALUE, Math.max(1, (seconds + 59) / 60));
        a.status = "submitted";
        attempts.save(a);
        if (paper.ownerStudentId == null) {
            audit.log(p, "考试", "提交「" + paper.name + "」，得分 " + score + " / " + total);
        }
    }

    private boolean isExpired(Attempt a, Paper paper, Instant now) {
        if (paper.endAt != null && now.isAfter(paper.endAt)) return true;
        return a.startedAt != null && now.isAfter(a.startedAt.plusSeconds(paper.duration * 60L));
    }

    private String normalize(String value, String type) {
        if (value == null) return "";
        String s = value.trim().toUpperCase(Locale.ROOT);
        if ("multi".equals(type)) {
            char[] chars = s.replaceAll("[^A-F]", "").toCharArray();
            Arrays.sort(chars);
            return new String(chars);
        }
        if ("judge".equals(type)) {
            if (s.equals("TRUE") || s.equals("正确")) return "T";
            if (s.equals("FALSE") || s.equals("错误")) return "F";
        }
        return s;
    }

    private int totalOf(Paper paper) {
        int total = 0;
        for (Map<String, Object> item : mapper.read(paper.itemsJson,
                new TypeReference<List<Map<String, Object>>>() {}, List.of())) {
            if (item.get("score") instanceof Number n) total += n.intValue();
        }
        return total;
    }

    private Map<String, Object> attemptView(Attempt a, String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("serverNow", Instant.now());
        out.put("attempt", mapper.attempt(a));
        if (message != null) out.put("message", message);
        return out;
    }

    private void requireStudent(AppPrincipal p) {
        if (!"student".equals(p.role)) throw ApiException.forbidden("仅学生可以作答");
    }

    private void requireVisible(Paper paper, AppPrincipal p) {
        if (paper.ownerStudentId != null && !paper.ownerStudentId.isBlank()) {
            if (!p.id.equals(paper.ownerStudentId)) throw ApiException.forbidden("这份错题测试仅属于其他学生");
            return;
        }
        List<String> classIds = mapper.read(paper.classIdsJson, new TypeReference<List<String>>() {}, List.of());
        if (p.classId == null || !classIds.contains(p.classId)) throw ApiException.forbidden("本试卷不面向你的教学班");
    }
}
