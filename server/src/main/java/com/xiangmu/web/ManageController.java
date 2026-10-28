package com.xiangmu.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.xiangmu.domain.*;
import com.xiangmu.repo.*;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.ApiMapper;
import com.xiangmu.service.AuditService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api")
public class ManageController {
    private final KnowledgePointRepo kps;
    private final QuestionRepo questions;
    private final TeacherRepo teachers;
    private final StudentRepo students;
    private final CourseRepo courses;
    private final ClassGroupRepo classes;
    private final PaperRepo papers;
    private final UserRepo users;
    private final ApiMapper mapper;
    private final AuditService audit;
    private final PasswordEncoder encoder;

    public ManageController(KnowledgePointRepo kps, QuestionRepo questions, TeacherRepo teachers,
                            StudentRepo students, CourseRepo courses, ClassGroupRepo classes,
                            PaperRepo papers, UserRepo users, ApiMapper mapper, AuditService audit,
                            PasswordEncoder encoder) {
        this.kps = kps;
        this.questions = questions;
        this.teachers = teachers;
        this.students = students;
        this.courses = courses;
        this.classes = classes;
        this.papers = papers;
        this.users = users;
        this.mapper = mapper;
        this.audit = audit;
        this.encoder = encoder;
    }

    public record AuditRequest(String action, String detail) {}

    @PostMapping("/kps")
    @Transactional
    public Map<String, Object> addKp(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireCl(p);
        String name = text(body, "name");
        if (name == null || name.isBlank()) throw ApiException.bad("请填写知识点名称");
        if (kps.findAll().stream().anyMatch(k -> name.trim().equals(k.name))) throw ApiException.bad("知识点名称已存在");
        KnowledgePoint k = new KnowledgePoint();
        k.id = "kp" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        k.courseId = p.courseId == null ? "c1" : p.courseId;
        int next = kps.findAll().stream().mapToInt(x -> x.sort).max().orElse(0) + 1;
        k.code = "KP" + String.format("%02d", next);
        k.name = name.trim();
        k.description = text(body, "desc");
        k.sort = next;
        k.status = "enabled";
        kps.save(k);
        audit.log(p, "题库", "新增知识点「" + k.name + "」");
        return mapper.kp(k);
    }

    @PostMapping("/questions")
    @Transactional
    public Map<String, Object> addQuestion(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireCl(p);
        String stem = text(body, "stem");
        String type = text(body, "type");
        String answer = text(body, "answer");
        String kpId = text(body, "kpId");
        if (stem == null || stem.isBlank()) throw ApiException.bad("请填写题干");
        if (!List.of("single", "multi", "judge").contains(type)) throw ApiException.bad("题型不正确");
        if (kpId == null || kps.findById(kpId).isEmpty()) throw ApiException.bad("知识点不存在");
        if (answer == null || answer.isBlank()) throw ApiException.bad("请填写标准答案");
        Object options = body.getOrDefault("options", List.of());
        Question q = new Question();
        q.id = "Q" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
        q.kpId = kpId;
        q.type = type;
        q.stem = stem.trim();
        q.optionsJson = mapper.write(options);
        q.answer = answer.trim().toUpperCase(Locale.ROOT);
        q.analysis = text(body, "analysis");
        q.difficulty = text(body, "difficulty");
        q.status = "enabled";
        q.realQuestion = Boolean.TRUE.equals(body.get("real"));
        questions.save(q);
        audit.log(p, "题库", "新增题目「" + q.id + "」");
        return mapper.question(q, true);
    }

    @PostMapping("/teachers")
    @Transactional
    public Map<String, Object> addTeacher(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireCl(p);
        String no = text(body, "no");
        String name = text(body, "name");
        if (no == null || no.isBlank() || name == null || name.isBlank()) throw ApiException.bad("工号和姓名不能为空");
        if (teachers.findAll().stream().anyMatch(t -> no.equalsIgnoreCase(t.no))) throw ApiException.bad("教师工号已存在");
        Teacher t = new Teacher();
        t.id = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        t.no = no.trim();
        t.name = name.trim();
        t.courseId = p.courseId == null ? "c1" : p.courseId;
        t.classes = text(body, "classes");
        t.phone = text(body, "phone");
        t.status = "active";
        teachers.save(t);
        UserAccount u = new UserAccount();
        u.id = t.id;
        u.username = uniqueUsername(t.no.toLowerCase(Locale.ROOT));
        u.passwordHash = encoder.encode("123456");
        u.displayName = t.name;
        u.role = "teacher";
        u.courseId = t.courseId;
        users.save(u);
        audit.log(p, "账号", "新增教师账号「" + t.name + "」（" + t.no + "）");
        return mapper.teacher(t);
    }

    @PostMapping("/students")
    @Transactional
    public Map<String, Object> addStudent(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireStaff(p);
        String no = text(body, "no");
        String name = text(body, "name");
        if (no == null || no.isBlank() || name == null || name.isBlank()) throw ApiException.bad("学号和姓名不能为空");
        if (students.findByNo(no) != null) throw ApiException.bad("学号已存在");
        String classId = text(body, "classId");
        if (classId == null || classId.isBlank()) classId = p.classId;
        if (classId == null || classId.isBlank()) throw ApiException.bad("请选择教学班");
        ClassGroup group = classes.findById(classId).orElseThrow(() -> ApiException.bad("教学班不存在"));
        if ("teacher".equals(p.role) && !p.id.equals(group.teacherId)) {
            throw ApiException.forbidden("只能向本人负责的教学班添加学生");
        }
        if (!"course_leader".equals(p.role) && p.courseId != null
                && group.courseId != null && !p.courseId.equals(group.courseId)) {
            throw ApiException.forbidden("不能向其他课程的教学班添加学生");
        }
        Student s = new Student();
        s.id = "s" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        s.no = no.trim();
        s.name = name.trim();
        s.classId = classId;
        s.major = text(body, "major");
        s.adminClass = text(body, "adminClass");
        s.status = "active";
        students.save(s);
        UserAccount u = new UserAccount();
        u.id = s.id;
        u.username = uniqueUsername(s.no);
        u.passwordHash = encoder.encode("123456");
        u.displayName = s.name;
        u.role = "student";
        u.courseId = group.courseId != null ? group.courseId : (p.courseId == null ? "c1" : p.courseId);
        u.classId = s.classId;
        users.save(u);
        group.count = Math.max(0, group.count) + 1;
        classes.save(group);
        audit.log(p, "导入", "新增学生「" + s.name + "」（" + s.no + "）到" + group.name);
        return mapper.student(s);
    }

    @PostMapping("/courses")
    @Transactional
    public Map<String, Object> addCourse(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireCl(p);
        String name = text(body, "name");
        String code = text(body, "code");
        if (name == null || name.isBlank() || code == null || code.isBlank()) throw ApiException.bad("课程名称和编码不能为空");
        Course c = new Course();
        c.id = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        c.name = name.trim();
        c.code = code.trim();
        c.term = text(body, "term");
        c.owner = p.displayName;
        c.classCount = 0;
        c.status = "active";
        c.createdAt = Instant.now().toString();
        courses.save(c);
        audit.log(p, "账号", "创建课程「" + c.name + "」");
        return mapper.course(c);
    }

    @PostMapping("/papers")
    @Transactional
    public Map<String, Object> publishPaper(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireStaff(p);
        String name = text(body, "name");
        if (name == null || name.isBlank()) throw ApiException.bad("请填写试卷名称");
        List<String> classIds = mapper.read(mapper.write(body.getOrDefault("classIds", List.of())),
                new TypeReference<List<String>>() {}, List.of());
        classIds = new ArrayList<>(new LinkedHashSet<>(classIds));
        if (classIds.isEmpty()) throw ApiException.bad("请选择目标教学班");
        List<ClassGroup> targetGroups = new ArrayList<>();
        for (String classId : classIds) {
            ClassGroup group = classes.findById(classId)
                    .orElseThrow(() -> ApiException.bad("教学班不存在：" + classId));
            if ("teacher".equals(p.role) && !p.id.equals(group.teacherId)) {
                throw ApiException.forbidden("只能向本人负责的教学班发布试卷");
            }
            if ("course_leader".equals(p.role) && p.courseId != null
                    && group.courseId != null && !p.courseId.equals(group.courseId)) {
                throw ApiException.forbidden("不能向其他课程的教学班发布试卷");
            }
            targetGroups.add(group);
        }
        List<Map<String, Object>> items = mapper.read(mapper.write(body.getOrDefault("items", List.of())),
                new TypeReference<List<Map<String, Object>>>() {}, List.of());
        if (items.isEmpty()) throw ApiException.bad("试卷没有题目");
        Set<String> known = new HashSet<>();
        questions.findAll().forEach(q -> known.add(q.id));
        for (Map<String, Object> item : items) {
            String qid = String.valueOf(item.get("qid"));
            if (!known.contains(qid)) throw ApiException.bad("题目不存在：" + qid);
            if (!(item.get("score") instanceof Number n) || n.intValue() <= 0) throw ApiException.bad("题目分值不正确");
        }
        String teacherId;
        String teacherName;
        if ("teacher".equals(p.role)) {
            teacherId = p.id;
            teacherName = p.displayName;
        } else {
            teacherId = text(body, "teacherId");
            if (teacherId == null || teacherId.isBlank()) {
                teacherId = targetGroups.get(0).teacherId;
            }
            Teacher teacher = teachers.findById(teacherId)
                    .orElseThrow(() -> ApiException.bad("任课教师不存在"));
            teacherName = teacher.name;
        }
        String courseId = targetGroups.get(0).courseId != null ? targetGroups.get(0).courseId
                : (p.courseId == null ? "c1" : p.courseId);
        Paper paper = new Paper();
        paper.id = "p" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        paper.name = name.trim();
        paper.courseId = courseId;
        paper.teacherId = teacherId;
        paper.teacherName = teacherName;
        paper.classIdsJson = mapper.write(classIds);
        paper.className = targetGroups.stream().map(c -> c.name).reduce((a, b) -> a + "、" + b).orElse("");
        paper.itemsJson = mapper.write(items);
        paper.status = "published";
        paper.startAt = parseInstant(body.get("startAt"), "开放时间");
        paper.endAt = parseInstant(body.get("endAt"), "截止时间");
        if (paper.startAt != null && paper.endAt != null && !paper.endAt.isAfter(paper.startAt)) {
            throw ApiException.bad("截止时间必须晚于开放时间");
        }
        paper.duration = intVal(body.get("duration"), 60);
        paper.attemptsAllowed = intVal(body.get("attemptsAllowed"), 1);
        paper.answerPolicy = text(body, "answerPolicy");
        paper.shuffle = Boolean.TRUE.equals(body.get("shuffle"));
        paper.publishedAt = Instant.now();
        papers.save(paper);
        audit.log(p, "组卷", "发布试卷「" + paper.name + "」至" + paper.className + "（" + items.size() + " 题）");
        return mapper.paper(paper);
    }

    @PostMapping("/papers/{id}/end")
    @Transactional
    public Map<String, Object> endPaper(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireStaff(p);
        Paper paper = papers.findById(id).orElseThrow(() -> ApiException.notFound("试卷不存在"));
        if ("teacher".equals(p.role) && !p.id.equals(paper.teacherId)) throw ApiException.forbidden("不能操作其他教师的试卷");
        paper.endAt = Instant.now();
        papers.save(paper);
        audit.log(p, "组卷", "结束试卷「" + paper.name + "」");
        return mapper.paper(paper);
    }

    @PostMapping("/teachers/{id}/reset-password")
    @Transactional
    public Map<String, Object> resetTeacherPassword(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        Teacher t = teachers.findById(id).orElseThrow(() -> ApiException.notFound("教师不存在"));
        UserAccount u = users.findById(t.id).orElseThrow(() -> ApiException.notFound("教师账号不存在"));
        u.passwordHash = encoder.encode("123456");
        users.save(u);
        audit.log(p, "账号", "重置教师「" + t.name + "」登录密码");
        return Map.of("ok", true, "message", "已重置为 123456");
    }

    @PostMapping("/audit")
    public Map<String, Object> audit(@AuthenticationPrincipal AppPrincipal p, @RequestBody AuditRequest body) {
        if (body == null || body.action() == null) throw ApiException.bad("缺少操作类型");
        String detail = body.detail() == null ? "" : body.detail();
        if (detail.length() > 1000) detail = detail.substring(0, 1000);
        audit.log(p, body.action(), detail);
        return Map.of("ok", true);
    }

    private void requireCl(AppPrincipal p) {
        if (!"course_leader".equals(p.role)) throw ApiException.forbidden("仅课程负责人可以执行此操作");
    }

    private void requireStaff(AppPrincipal p) {
        if (!"course_leader".equals(p.role) && !"teacher".equals(p.role)) {
            throw ApiException.forbidden("仅教师可以执行此操作");
        }
    }

    private String uniqueUsername(String base) {
        String username = base;
        int n = 2;
        while (users.findByUsername(username).isPresent()) username = base + n++;
        return username;
    }

    private String text(Map<String, Object> body, String key) {
        Object v = body == null ? null : body.get(key);
        return v == null ? null : String.valueOf(v);
    }

    private int intVal(Object value, int fallback) {
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return fallback;
        }
    }

    private Instant parseInstant(Object value, String label) {
        if (value == null || String.valueOf(value).isBlank()) return null;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception e) {
            throw ApiException.bad(label + "格式不正确");
        }
    }
}
