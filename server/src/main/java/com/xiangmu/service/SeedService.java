package com.xiangmu.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangmu.domain.*;
import com.xiangmu.repo.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.InputStream;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Component
public class SeedService implements CommandLineRunner {
    private final ObjectMapper json;
    private final ApiMapper mapper;
    private final PasswordEncoder passwordEncoder;
    private final UserRepo users;
    private final CourseRepo courses;
    private final KnowledgePointRepo kps;
    private final QuestionRepo questions;
    private final PaperRepo papers;
    private final AttemptRepo attempts;
    private final TeacherRepo teachers;
    private final ClassGroupRepo classes;
    private final StudentRepo students;
    private final AuditLogRepo logs;

    private JsonNode root;

    public SeedService(ObjectMapper json, ApiMapper mapper, PasswordEncoder passwordEncoder,
                       UserRepo users, CourseRepo courses, KnowledgePointRepo kps, QuestionRepo questions,
                       PaperRepo papers, AttemptRepo attempts, TeacherRepo teachers, ClassGroupRepo classes,
                       StudentRepo students, AuditLogRepo logs) {
        this.json = json;
        this.mapper = mapper;
        this.passwordEncoder = passwordEncoder;
        this.users = users;
        this.courses = courses;
        this.kps = kps;
        this.questions = questions;
        this.papers = papers;
        this.attempts = attempts;
        this.teachers = teachers;
        this.classes = classes;
        this.students = students;
        this.logs = logs;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        try (InputStream in = new ClassPathResource("seed.json").getInputStream()) {
            root = json.readTree(in);
        }
        if (users.count() == 0 && courses.count() == 0) {
            seedFromRoot();
            System.out.println("[seed] 已导入演示数据："
                    + root.path("kps").size() + " 知识点 / "
                    + root.path("questions").size() + " 题 / "
                    + root.path("students").size() + " 学生");
        } else {
            System.out.println("[seed] 数据库已有数据，跳过初始化");
        }
        ensureDemoAccounts();
    }

    public JsonNode root() {
        return root;
    }

    @Transactional
    public void resetDemoData() throws Exception {
        attempts.deleteAllInBatch();
        logs.deleteAllInBatch();
        papers.deleteAllInBatch();
        questions.deleteAllInBatch();
        kps.deleteAllInBatch();
        classes.deleteAllInBatch();
        students.deleteAllInBatch();
        teachers.deleteAllInBatch();
        courses.deleteAllInBatch();
        users.deleteAllInBatch();
        seedFromRoot();
        ensureDemoAccounts();
    }

    private void seedFromRoot() {
        for (JsonNode n : root.path("courses")) {
            Course c = new Course();
            c.id = text(n, "id");
            c.name = text(n, "name");
            c.code = text(n, "code");
            c.term = text(n, "term");
            c.owner = text(n, "owner");
            c.classCount = n.path("classes").asInt();
            c.status = text(n, "status");
            c.createdAt = text(n, "createdAt");
            courses.save(c);
        }
        for (JsonNode n : root.path("kps")) {
            KnowledgePoint k = new KnowledgePoint();
            k.id = text(n, "id");
            k.courseId = text(n, "courseId");
            k.code = text(n, "code");
            k.name = text(n, "name");
            k.description = text(n, "desc");
            k.sort = n.path("sort").asInt();
            k.status = text(n, "status");
            kps.save(k);
        }
        for (JsonNode n : root.path("questions")) {
            Question q = new Question();
            q.id = text(n, "id");
            q.kpId = text(n, "kpId");
            q.type = text(n, "type");
            q.stem = text(n, "stem");
            q.optionsJson = mapper.write(n.path("options"));
            q.answer = text(n, "answer");
            q.analysis = text(n, "analysis");
            q.difficulty = text(n, "difficulty");
            q.status = text(n, "status");
            q.realQuestion = n.path("real").asBoolean(false);
            questions.save(q);
        }
        for (JsonNode n : root.path("papers")) {
            Paper p = new Paper();
            p.id = text(n, "id");
            p.name = text(n, "name");
            p.courseId = text(n, "courseId");
            p.teacherId = text(n, "teacherId");
            p.teacherName = text(n, "teacherName");
            p.classIdsJson = mapper.write(n.path("classIds"));
            p.className = text(n, "className");
            p.itemsJson = mapper.write(n.path("items"));
            p.status = text(n, "status");
            p.startAt = mapper.instant(n.path("startAt").asText(null));
            p.endAt = mapper.instant(n.path("endAt").asText(null));
            p.duration = n.path("duration").asInt(60);
            p.attemptsAllowed = n.path("attemptsAllowed").asInt(1);
            p.answerPolicy = text(n, "answerPolicy");
            p.shuffle = n.path("shuffle").asBoolean(false);
            p.publishedAt = mapper.instant(n.path("publishedAt").asText(null));
            papers.save(p);
        }
        for (JsonNode n : root.path("teachers")) {
            Teacher t = new Teacher();
            t.id = text(n, "id");
            t.no = text(n, "no");
            t.name = text(n, "name");
            t.courseId = text(n, "courseId");
            t.classes = text(n, "classes");
            t.phone = text(n, "phone");
            t.status = text(n, "status");
            teachers.save(t);
        }
        for (JsonNode n : root.path("classes")) {
            ClassGroup c = new ClassGroup();
            c.id = text(n, "id");
            c.name = text(n, "name");
            c.courseId = text(n, "courseId");
            c.teacherId = text(n, "teacherId");
            c.teacherName = text(n, "teacherName");
            c.count = n.path("count").asInt();
            c.major = text(n, "major");
            c.term = text(n, "term");
            classes.save(c);
        }
        for (JsonNode n : root.path("students")) {
            Student s = new Student();
            s.id = text(n, "id");
            s.no = text(n, "no");
            s.name = text(n, "name");
            s.classId = text(n, "classId");
            s.major = text(n, "major");
            s.adminClass = text(n, "adminClass");
            s.status = text(n, "status");
            students.save(s);
        }
        for (JsonNode n : root.path("attempts")) {
            Attempt a = new Attempt();
            a.id = text(n, "id");
            a.paperId = text(n, "paperId");
            a.studentId = text(n, "studentId");
            a.answersJson = mapper.write(n.path("answers"));
            a.score = n.path("score").asInt();
            a.total = n.path("total").asInt();
            a.correctCount = n.path("correctCount").asInt();
            a.submittedAt = mapper.instant(n.path("submittedAt").asText(null));
            a.timeUsed = n.path("timeUsed").asInt();
            a.startedAt = a.submittedAt == null ? null : a.submittedAt.minus(a.timeUsed, ChronoUnit.MINUTES);
            a.updatedAt = a.submittedAt;
            a.status = "submitted";
            attempts.save(a);
        }
        for (JsonNode n : root.path("logs")) {
            AuditLog l = new AuditLog();
            l.id = text(n, "id");
            l.operator = text(n, "operator");
            l.role = text(n, "role");
            l.action = text(n, "action");
            l.detail = text(n, "detail");
            l.time = mapper.instant(n.path("time").asText(null));
            logs.save(l);
        }
        seedSyntheticP1();
    }

    private void seedSyntheticP1() {
        Paper p1 = papers.findById("p1").orElse(null);
        if (p1 == null) return;
        Map<String, String> correct = new HashMap<>();
        for (Question q : questions.findAll()) correct.put(q.id, q.answer);
        List<Map<String, Object>> items = mapper.read(p1.itemsJson,
                new TypeReference<List<Map<String, Object>>>() {}, List.of());
        JsonNode scoreNode = root.path("p1Scores");
        List<Student> ordered = students.findAll(org.springframework.data.domain.Sort.by("no"));
        for (int i = 0; i < ordered.size() && i < scoreNode.size(); i++) {
            JsonNode scoreValue = scoreNode.get(i);
            if (scoreValue == null || scoreValue.isNull()) continue;
            Student s = ordered.get(i);
            if (attempts.findByPaperIdAndStudentId("p1", s.id).isPresent()) continue;
            int score = scoreValue.asInt();
            int correctCount = Math.min(items.size(), Math.max(0, score / 10));
            Map<String, String> answers = new LinkedHashMap<>();
            for (int j = 0; j < correctCount; j++) {
                String qid = String.valueOf(items.get(j).get("qid"));
                answers.put(qid, correct.getOrDefault(qid, ""));
            }
            Attempt a = new Attempt();
            a.id = "seed-p1-" + s.id;
            a.paperId = "p1";
            a.studentId = s.id;
            a.answersJson = mapper.write(answers);
            a.score = score;
            a.total = 100;
            a.correctCount = correctCount;
            a.timeUsed = 18 + (i * 7) % 34;
            a.submittedAt = p1.startAt.plus(a.timeUsed, ChronoUnit.MINUTES);
            a.startedAt = p1.startAt;
            a.updatedAt = a.submittedAt;
            a.status = "submitted";
            attempts.save(a);
        }
    }

    private void ensureDemoAccounts() {
        String hash = passwordEncoder.encode("123456");
        if (users.findByUsername("admin").isEmpty()) {
            UserAccount u = new UserAccount();
            u.id = "cl1";
            u.username = "admin";
            u.passwordHash = hash;
            u.displayName = "赵璘";
            u.role = "course_leader";
            u.courseId = "c1";
            users.save(u);
        }
        for (Teacher t : teachers.findAll()) {
            String username = t.id.equals("t1") ? "zhaolin" : t.no.toLowerCase(Locale.ROOT);
            if (users.findByUsername(username).isPresent()) continue;
            UserAccount u = new UserAccount();
            u.id = t.id;
            u.username = username;
            u.passwordHash = hash;
            u.displayName = t.name;
            u.role = "teacher";
            u.courseId = t.courseId;
            classes.findAll().stream().filter(c -> t.id.equals(c.teacherId)).findFirst()
                    .ifPresent(c -> u.classId = c.id);
            users.save(u);
        }
        for (Student s : students.findAll()) {
            if (users.findByUsername(s.no).isPresent()) continue;
            UserAccount u = new UserAccount();
            u.id = s.id;
            u.username = s.no;
            u.passwordHash = hash;
            u.displayName = s.name;
            u.role = "student";
            u.courseId = "c1";
            u.classId = s.classId;
            users.save(u);
        }
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? null : v.asText();
    }
}
