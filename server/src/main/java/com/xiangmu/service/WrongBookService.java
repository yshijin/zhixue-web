package com.xiangmu.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.xiangmu.domain.Attempt;
import com.xiangmu.domain.KnowledgePoint;
import com.xiangmu.domain.Paper;
import com.xiangmu.domain.Question;
import com.xiangmu.repo.AttemptRepo;
import com.xiangmu.repo.KnowledgePointRepo;
import com.xiangmu.repo.PaperRepo;
import com.xiangmu.repo.QuestionRepo;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.web.ApiException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * 学生个人错题本：从已提交作答和试卷题目快照中整理错题，
 * 并可把选中的错题生成一份仅本人可见、仅本人可作答的个人测试。
 */
@Service
public class WrongBookService {
    private static final int QUESTION_SCORE = 5;

    private final AttemptRepo attempts;
    private final PaperRepo papers;
    private final QuestionRepo questions;
    private final KnowledgePointRepo kps;
    private final ApiMapper mapper;

    public WrongBookService(AttemptRepo attempts, PaperRepo papers, QuestionRepo questions,
                            KnowledgePointRepo kps, ApiMapper mapper) {
        this.attempts = attempts;
        this.papers = papers;
        this.questions = questions;
        this.kps = kps;
        this.mapper = mapper;
    }

    public record CreateWrongTestRequest(List<String> qids, String name, Integer duration) {}

    public Map<String, Object> build(AppPrincipal p) {
        requireStudent(p);
        Instant now = Instant.now();
        Map<String, Question> questionMap = new HashMap<>();
        for (Question q : questions.findAll()) questionMap.put(q.id, q);
        Map<String, KnowledgePoint> kpMap = new HashMap<>();
        for (KnowledgePoint k : kps.findAll()) kpMap.put(k.id, k);

        Map<String, WrongAcc> byQuestion = new LinkedHashMap<>();
        List<Attempt> submitted = attempts.findByStudentIdOrderBySubmittedAtDesc(p.id).stream()
                .filter(a -> "submitted".equals(a.status) && a.submittedAt != null)
                .toList();

        for (Attempt attempt : submitted) {
            Paper paper = papers.findById(attempt.paperId).orElse(null);
            if (paper == null) continue;
            boolean answerVisible = answerVisible(paper, now);
            Map<String, String> answers = mapper.read(attempt.answersJson,
                    new TypeReference<Map<String, String>>() {}, Map.of());
            List<Map<String, Object>> items = mapper.read(paper.itemsJson,
                    new TypeReference<List<Map<String, Object>>>() {}, List.of());
            for (Map<String, Object> item : items) {
                String qid = String.valueOf(item.get("qid"));
                Question q = questionMap.get(qid);
                if (q == null) continue;
                int points = item.get("score") instanceof Number n ? n.intValue() : 0;
                String mine = answers.get(qid);
                boolean correct = normalize(mine, q.type).equals(normalize(q.answer, q.type));
                WrongAcc acc = byQuestion.computeIfAbsent(qid, id -> new WrongAcc(id));
                if (correct) {
                    acc.lastCorrectAt = later(acc.lastCorrectAt, attempt.submittedAt);
                } else {
                    acc.wrongCount++;
                    if (acc.lastWrongAt == null || attempt.submittedAt.isAfter(acc.lastWrongAt)) {
                        acc.lastWrongAt = attempt.submittedAt;
                        acc.lastWrongPaperId = paper.id;
                        acc.lastWrongPaperName = paper.name;
                        acc.lastWrongAttemptId = attempt.id;
                        acc.lastWrongAnswer = mine == null ? "" : mine;
                        acc.lastWrongScore = points;
                        acc.lastWrongAnswerVisible = answerVisible;
                    }
                }
            }
        }

        List<Map<String, Object>> entries = new ArrayList<>();
        Set<String> sourcePaperIds = new HashSet<>();
        Set<String> kpIds = new HashSet<>();
        int correctedCount = 0;
        for (WrongAcc acc : byQuestion.values()) {
            if (acc.wrongCount == 0) continue;
            Question q = questionMap.get(acc.qid);
            if (q == null) continue;
            KnowledgePoint kp = kpMap.get(q.kpId);
            boolean corrected = acc.lastCorrectAt != null
                    && (acc.lastWrongAt == null || acc.lastCorrectAt.isAfter(acc.lastWrongAt));
            if (corrected) correctedCount++;
            sourcePaperIds.add(acc.lastWrongPaperId);
            kpIds.add(q.kpId);

            Map<String, Object> e = new LinkedHashMap<>();
            e.put("qid", q.id);
            e.put("kpId", q.kpId);
            e.put("kpName", kp == null ? "未分类知识点" : kp.name);
            e.put("kpCode", kp == null ? "" : kp.code);
            e.put("type", q.type);
            e.put("stem", q.stem);
            e.put("options", mapper.read(q.optionsJson,
                    new TypeReference<List<Map<String, Object>>>() {}, List.of()));
            e.put("difficulty", q.difficulty);
            e.put("score", acc.lastWrongScore);
            e.put("sourcePaperId", acc.lastWrongPaperId);
            e.put("sourcePaperName", acc.lastWrongPaperName);
            e.put("sourceAttemptId", acc.lastWrongAttemptId);
            e.put("lastWrongAt", acc.lastWrongAt);
            e.put("myAnswer", acc.lastWrongAnswer);
            e.put("wrongCount", acc.wrongCount);
            e.put("corrected", corrected);
            e.put("lastCorrectAt", acc.lastCorrectAt);
            e.put("answerVisible", acc.lastWrongAnswerVisible);
            if (acc.lastWrongAnswerVisible) {
                e.put("answer", q.answer);
                e.put("analysis", q.analysis);
            }
            entries.add(e);
        }
        entries.sort((a, b) -> {
            Instant ta = (Instant) a.get("lastWrongAt");
            Instant tb = (Instant) b.get("lastWrongAt");
            if (ta == null && tb == null) return String.valueOf(a.get("qid")).compareTo(String.valueOf(b.get("qid")));
            if (ta == null) return 1;
            if (tb == null) return -1;
            int cmp = tb.compareTo(ta);
            return cmp != 0 ? cmp : String.valueOf(a.get("qid")).compareTo(String.valueOf(b.get("qid")));
        });

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("serverTime", now);
        out.put("entries", entries);
        out.put("total", entries.size());
        out.put("corrected", correctedCount);
        out.put("remaining", entries.size() - correctedCount);
        out.put("paperCount", sourcePaperIds.size());
        out.put("kpCount", kpIds.size());
        out.put("personalTests", personalTests(p));
        return out;
    }

    @Transactional
    public Map<String, Object> create(AppPrincipal p, CreateWrongTestRequest request) {
        requireStudent(p);
        Map<String, Object> data = build(p);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> entries = (List<Map<String, Object>>) data.get("entries");
        Map<String, Map<String, Object>> entryMap = new LinkedHashMap<>();
        for (Map<String, Object> entry : entries) entryMap.put(String.valueOf(entry.get("qid")), entry);

        LinkedHashSet<String> requested = new LinkedHashSet<>();
        if (request != null && request.qids() != null) {
            for (String qid : request.qids()) {
                if (qid == null || qid.isBlank()) continue;
                String value = qid.trim();
                if (!entryMap.containsKey(value)) throw ApiException.bad("错题不存在或不属于当前学生：" + value);
                requested.add(value);
            }
        }
        boolean selectAll = request == null || request.qids() == null || request.qids().isEmpty();
        List<Map<String, Object>> selected = new ArrayList<>();
        for (Map<String, Object> entry : entries) {
            String qid = String.valueOf(entry.get("qid"));
            if (selectAll || requested.contains(qid)) selected.add(entry);
        }
        if (selected.isEmpty()) throw ApiException.bad("暂无可加入错题测试的题目，请先完成一次测评");
        if (selected.size() > 100) throw ApiException.bad("单次错题测试最多包含 100 道题");

        Instant now = Instant.now();
        String name = request == null ? null : trimToNull(request.name());
        if (name == null) {
            name = "错题重练 · " + DateTimeFormatter.ofPattern("MM-dd HH:mm")
                    .withZone(ZoneId.of("Asia/Shanghai")).format(now);
        }
        if (name.length() > 80) name = name.substring(0, 80);
        int duration = request == null || request.duration() == null
                ? Math.max(10, Math.min(120, selected.size() * 2))
                : Math.max(5, Math.min(180, request.duration()));

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> entry : selected) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("qid", entry.get("qid"));
            item.put("score", QUESTION_SCORE);
            items.add(item);
        }

        Paper paper = new Paper();
        paper.id = "p" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        paper.name = name;
        paper.courseId = p.courseId == null ? "c1" : p.courseId;
        paper.teacherId = p.id;
        paper.teacherName = "个人错题本";
        paper.ownerStudentId = p.id;
        paper.classIdsJson = mapper.write(List.of());
        paper.className = "仅本人可见";
        paper.itemsJson = mapper.write(items);
        paper.status = "published";
        paper.startAt = now.minusSeconds(1);
        paper.endAt = now.plus(30, ChronoUnit.DAYS);
        paper.duration = duration;
        paper.attemptsAllowed = 1;
        paper.answerPolicy = "afterSubmit";
        paper.shuffle = false;
        paper.publishedAt = now;
        papers.save(paper);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("serverTime", now);
        out.put("paper", mapper.paper(paper));
        out.put("message", "已生成 " + selected.size() + " 道错题的个人测试");
        return out;
    }

    @Transactional
    public Map<String, Object> delete(AppPrincipal p, String paperId) {
        requireStudent(p);
        Paper paper = papers.findById(paperId).orElseThrow(() -> ApiException.notFound("错题测试不存在"));
        if (!p.id.equals(paper.ownerStudentId)) throw ApiException.forbidden("只能删除自己的错题测试");
        List<Attempt> related = attempts.findByPaperId(paper.id);
        attempts.deleteAllInBatch(related);
        papers.delete(paper);
        return Map.of("ok", true, "message", "错题测试已删除", "paper", paper.name, "attempts", related.size());
    }

    private List<Map<String, Object>> personalTests(AppPrincipal p) {
        List<Paper> own = papers.findAll().stream()
                .filter(x -> p.id.equals(x.ownerStudentId))
                .sorted(Comparator.comparing((Paper x) -> x.publishedAt,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Paper paper : own) {
            List<Map<String, Object>> items = mapper.read(paper.itemsJson,
                    new TypeReference<List<Map<String, Object>>>() {}, List.of());
            int total = items.stream()
                    .mapToInt(item -> item.get("score") instanceof Number n ? n.intValue() : 0)
                    .sum();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", paper.id);
            row.put("name", paper.name);
            row.put("questionCount", items.size());
            row.put("total", total);
            row.put("duration", paper.duration);
            row.put("startAt", paper.startAt);
            row.put("endAt", paper.endAt);
            row.put("publishedAt", paper.publishedAt);
            row.put("status", paper.status);
            attempts.findByPaperIdAndStudentId(paper.id, p.id)
                    .ifPresent(a -> row.put("attempt", mapper.attempt(a)));
            out.add(row);
        }
        return out;
    }

    private boolean answerVisible(Paper paper, Instant now) {
        String policy = paper.answerPolicy == null || paper.answerPolicy.isBlank()
                ? "afterSubmit" : paper.answerPolicy;
        if ("never".equals(policy)) return false;
        if ("afterEnd".equals(policy)) return paper.endAt != null && !paper.endAt.isAfter(now);
        return "afterSubmit".equals(policy);
    }

    private Instant later(Instant current, Instant candidate) {
        if (candidate == null) return current;
        return current == null || candidate.isAfter(current) ? candidate : current;
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

    private String trimToNull(String value) {
        if (value == null) return null;
        String s = value.trim();
        return s.isEmpty() ? null : s;
    }

    private void requireStudent(AppPrincipal p) {
        if (p == null || !"student".equals(p.role)) throw ApiException.forbidden("仅学生可以使用错题本");
    }

    private static class WrongAcc {
        final String qid;
        int wrongCount;
        Instant lastWrongAt;
        String lastWrongPaperId;
        String lastWrongPaperName;
        String lastWrongAttemptId;
        String lastWrongAnswer;
        int lastWrongScore;
        boolean lastWrongAnswerVisible;
        Instant lastCorrectAt;

        WrongAcc(String qid) {
            this.qid = qid;
        }
    }
}
