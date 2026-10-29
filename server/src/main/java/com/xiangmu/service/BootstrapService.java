package com.xiangmu.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.xiangmu.domain.*;
import com.xiangmu.repo.*;
import com.xiangmu.security.AppPrincipal;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BootstrapService {
    private final CourseRepo courses;
    private final KnowledgePointRepo kps;
    private final QuestionRepo questions;
    private final PaperRepo papers;
    private final AttemptRepo attempts;
    private final TeacherRepo teachers;
    private final ClassGroupRepo classes;
    private final StudentRepo students;
    private final AuditLogRepo logs;
    private final ApiMapper mapper;
    private final SeedService seedService;

    public BootstrapService(CourseRepo courses, KnowledgePointRepo kps, QuestionRepo questions,
                            PaperRepo papers, AttemptRepo attempts, TeacherRepo teachers,
                            ClassGroupRepo classes, StudentRepo students, AuditLogRepo logs,
                            ApiMapper mapper, SeedService seedService) {
        this.courses = courses;
        this.kps = kps;
        this.questions = questions;
        this.papers = papers;
        this.attempts = attempts;
        this.teachers = teachers;
        this.classes = classes;
        this.students = students;
        this.logs = logs;
        this.mapper = mapper;
        this.seedService = seedService;
    }

    public Map<String, Object> build(AppPrincipal p) {
        boolean isCl = "course_leader".equals(p.role);
        boolean isTeacher = "teacher".equals(p.role);
        boolean isStudent = "student".equals(p.role);

        List<Course> allCourses = courses.findAll(Sort.by("id"));
        List<KnowledgePoint> allKps = kps.findAll(Sort.by("sort"));
        List<Question> allQuestions = questions.findAll(Sort.by("id"));
        List<Paper> allPapers = papers.findAll(Sort.by("id"));
        List<Teacher> allTeachers = teachers.findAll(Sort.by("no"));
        List<ClassGroup> allClasses = classes.findAll(Sort.by("id"));
        List<Student> allStudents = students.findAll(Sort.by("no"));
        List<Attempt> allAttempts = attempts.findAll(Sort.by("id"));
        List<AuditLog> allLogs = logs.findTop100ByOrderByTimeDesc();

        Set<String> ownClassIds = allClasses.stream()
                .filter(c -> p.id.equals(c.teacherId))
                .map(c -> c.id)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (isStudent && p.classId != null) ownClassIds.add(p.classId);

        List<Paper> visiblePapers = allPapers.stream().filter(paper -> {
            if (isCl) return true;
            if (isTeacher) return p.id.equals(paper.teacherId);
            if (!"draft".equals(paper.status)) {
                List<String> ids = mapper.read(paper.classIdsJson, new TypeReference<List<String>>() {}, List.of());
                return ids.contains(p.classId);
            }
            return false;
        }).toList();

        Set<String> visiblePaperIds = visiblePapers.stream().map(x -> x.id).collect(Collectors.toSet());
        Set<String> visibleClassIds = visiblePapers.stream()
                .flatMap(x -> mapper.read(x.classIdsJson, new TypeReference<List<String>>() {}, List.<String>of()).stream())
                .collect(Collectors.toSet());
        if (isTeacher) visibleClassIds.addAll(ownClassIds);
        if (isStudent && p.classId != null) visibleClassIds.add(p.classId);

        List<Student> visibleStudents = allStudents.stream().filter(s -> {
            if (isCl) return true;
            if (isTeacher) return visibleClassIds.contains(s.classId);
            return s.id.equals(p.id);
        }).toList();

        List<Attempt> visibleAttempts = allAttempts.stream().filter(a -> {
            if (isCl) return true;
            if (isTeacher) return visiblePaperIds.contains(a.paperId);
            return p.id.equals(a.studentId);
        }).toList();

        List<Teacher> visibleTeachers = allTeachers.stream().filter(t -> {
            if (isCl) return true;
            if (isTeacher) return p.id.equals(t.id);
            return false;
        }).toList();

        List<ClassGroup> visibleClasses = allClasses.stream().filter(c -> {
            if (isCl) return true;
            if (isTeacher) return p.id.equals(c.teacherId);
            return p.classId != null && p.classId.equals(c.id);
        }).toList();

        List<Course> visibleCourses = allCourses.stream().filter(c -> {
            if (isCl) return true;
            return c.id.equals(p.courseId);
        }).toList();

        List<Question> visibleQuestions;
        Set<String> answerableQuestionIds = new HashSet<>();
        if (isStudent) {
            Set<String> qids = new HashSet<>();
            Instant now = Instant.now();
            for (Paper paper : visiblePapers) {
                List<Map<String, Object>> items = mapper.read(paper.itemsJson,
                        new TypeReference<List<Map<String, Object>>>() {}, List.of());
                boolean ended = paper.endAt != null && !paper.endAt.isAfter(now);
                boolean submitted = visibleAttempts.stream()
                        .anyMatch(a -> a.paperId.equals(paper.id) && "submitted".equals(a.status));
                boolean upcoming = paper.startAt != null && now.isBefore(paper.startAt);
                if (!upcoming || submitted) {
                    for (Map<String, Object> item : items) qids.add(String.valueOf(item.get("qid")));
                }
                String policy = paper.answerPolicy == null ? "afterSubmit" : paper.answerPolicy;
                boolean reveal = ("afterSubmit".equals(policy) && submitted)
                        || ("afterEnd".equals(policy) && ended);
                if (reveal) {
                    for (Map<String, Object> item : items) answerableQuestionIds.add(String.valueOf(item.get("qid")));
                }
            }
            visibleQuestions = allQuestions.stream().filter(q -> qids.contains(q.id)).toList();
        } else {
            visibleQuestions = allQuestions;
            allQuestions.forEach(q -> answerableQuestionIds.add(q.id));
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", 3);
        out.put("serverTime", Instant.now());
        out.put("user", currentUser(p));
        out.put("courses", visibleCourses.stream().map(mapper::course).toList());
        out.put("kps", allKps.stream().map(mapper::kp).toList());
        out.put("questions", visibleQuestions.stream()
                .map(q -> mapper.question(q, answerableQuestionIds.contains(q.id))).toList());
        out.put("papers", visiblePapers.stream().map(mapper::paper).toList());
        out.put("attempts", visibleAttempts.stream()
                .map(a -> attemptView(a, visibleQuestions))
                .toList());
        out.put("teachers", visibleTeachers.stream().map(mapper::teacher).toList());
        out.put("classes", visibleClasses.stream().map(mapper::classGroup).toList());
        out.put("students", visibleStudents.stream().map(mapper::student).toList());
        out.put("logs", isStudent ? List.of() : allLogs.stream().map(mapper::log).toList());
        out.put("p1Scores", isStudent ? List.of() : p1Scores(visibleStudents));
        out.put("classSummaries", isStudent ? List.of() : classSummaries(visibleClasses, visibleStudents));
        Set<String> existingKpIds = allKps.stream().map(k -> k.id).collect(Collectors.toSet());
        Set<String> existingQuestionIds = allQuestions.stream().map(q -> q.id).collect(Collectors.toSet());
        out.put("kpAvg", isStudent ? List.of() : seedList("kpAvg", "kpId", existingKpIds));
        out.put("qAccuracy", isStudent ? List.of() : seedList("qAccuracy", "qid", existingQuestionIds));
        return out;
    }

    private Map<String, Object> attemptView(Attempt a, List<Question> knownQuestions) {
        Map<String, Object> m = mapper.attempt(a);
        if (!"submitted".equals(a.status)) return m;
        Map<String, Question> qmap = knownQuestions.stream().collect(Collectors.toMap(q -> q.id, q -> q));
        Map<String, Boolean> correct = new LinkedHashMap<>();
        papers.findById(a.paperId).ifPresent(paper -> {
            for (Map<String, Object> item : mapper.read(paper.itemsJson,
                    new TypeReference<List<Map<String, Object>>>() {}, List.of())) {
                String qid = String.valueOf(item.get("qid"));
                Question q = qmap.get(qid);
                if (q != null) {
                    correct.put(qid, normalize(a.answersJson == null ? null : mapper.read(a.answersJson,
                                    new TypeReference<Map<String, String>>() {}, Map.of()).get(qid), q.type)
                            .equals(normalize(q.answer, q.type)));
                }
            }
        });
        m.put("correct", correct);
        return m;
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

    private Map<String, Object> currentUser(AppPrincipal p) {
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

    private List<Object> p1Scores(List<Student> visibleStudents) {
        Map<String, Integer> scores = new HashMap<>();
        for (Attempt a : attempts.findAll()) {
            if ("p1".equals(a.paperId) && "submitted".equals(a.status)) {
                scores.put(a.studentId, a.score);
            }
        }
        List<Object> result = new ArrayList<>();
        for (Student s : visibleStudents) result.add(scores.get(s.id));
        return result;
    }

    private List<Map<String, Object>> classSummaries(List<ClassGroup> visibleClasses, List<Student> visibleStudents) {
        Map<String, List<Student>> byClass = visibleStudents.stream()
                .collect(Collectors.groupingBy(s -> s.classId == null ? "" : s.classId));
        Map<String, Integer> scores = new HashMap<>();
        for (Attempt a : attempts.findAll()) {
            if ("p1".equals(a.paperId) && "submitted".equals(a.status)) scores.put(a.studentId, a.score);
        }
        JsonNode seedSummaries = seedService.root() == null ? null : seedService.root().path("classSummaries");
        boolean seedPaperExists = papers.findById("p1").isPresent();
        List<Map<String, Object>> result = new ArrayList<>();
        for (ClassGroup c : visibleClasses) {
            List<Student> list = byClass.getOrDefault(c.id, List.of());
            List<Integer> values = list.stream().map(s -> scores.get(s.id)).filter(Objects::nonNull).toList();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("classId", c.id);
            m.put("className", c.name);
            m.put("teacher", c.teacherName);
            m.put("expected", c.count > 0 ? c.count : list.size());
            m.put("completed", values.size());
            double avg = values.isEmpty() ? 0 : Math.round(values.stream().mapToInt(Integer::intValue).average().orElse(0) * 10) / 10.0;
            m.put("avg", avg);
            m.put("max", values.isEmpty() ? 0 : Collections.max(values));
            m.put("min", values.isEmpty() ? 0 : Collections.min(values));
            if (values.isEmpty() && seedPaperExists && (c.count > 0 || !list.isEmpty())
                    && seedSummaries != null && seedSummaries.isArray()) {
                for (JsonNode n : seedSummaries) {
                    if (c.id.equals(n.path("classId").asText())) {
                        m.put("expected", n.path("expected").asInt(m.get("expected") instanceof Integer i ? i : 0));
                        m.put("completed", n.path("completed").asInt());
                        m.put("avg", n.path("avg").asDouble());
                        m.put("max", n.path("max").asInt());
                        m.put("min", n.path("min").asInt());
                        break;
                    }
                }
            }
            result.add(m);
        }
        return result;
    }

    private List<Object> seedList(String field, String idField, Set<String> existingIds) {
        JsonNode root = seedService.root();
        if (root == null || !root.path(field).isArray()) return List.of();
        List<Object> list = new ArrayList<>();
        for (JsonNode n : root.path(field)) {
            String id = n.path(idField).asText(null);
            if (id == null || existingIds.contains(id)) {
                list.add(mapper.read(n.toString(), new TypeReference<Map<String, Object>>() {}, Map.of()));
            }
        }
        return list;
    }
}
