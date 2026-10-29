package com.xiangmu.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.xiangmu.domain.*;
import com.xiangmu.repo.*;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.ApiMapper;
import com.xiangmu.service.AuditService;
import com.xiangmu.service.ClassGroupService;
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
    private final AttemptRepo attempts;
    private final UserRepo users;
    private final ApiMapper mapper;
    private final AuditService audit;
    private final PasswordEncoder encoder;
    private final ClassGroupService classGroupService;

    public ManageController(KnowledgePointRepo kps, QuestionRepo questions, TeacherRepo teachers,
                            StudentRepo students, CourseRepo courses, ClassGroupRepo classes,
                            PaperRepo papers, AttemptRepo attempts, UserRepo users, ApiMapper mapper,
                            AuditService audit, PasswordEncoder encoder, ClassGroupService classGroupService) {
        this.kps = kps;
        this.questions = questions;
        this.teachers = teachers;
        this.students = students;
        this.courses = courses;
        this.classes = classes;
        this.papers = papers;
        this.attempts = attempts;
        this.users = users;
        this.mapper = mapper;
        this.audit = audit;
        this.encoder = encoder;
        this.classGroupService = classGroupService;
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
        t.phone = text(body, "phone");
        t.status = "active";

        ClassGroupService.BindingPlan plan = classGroupService.plan(t, text(body, "classes"));
        if (plan.hasErrors()) throw ApiException.bad(String.join("；", plan.errors()));
        t.classes = classGroupService.joinNames(plan.names());
        teachers.save(t);
        classGroupService.apply(t, plan);

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

    @PostMapping("/classes")
    @Transactional
    public Map<String, Object> addClass(@AuthenticationPrincipal AppPrincipal p, @RequestBody Map<String, Object> body) {
        requireCl(p);
        String name = text(body, "name");
        String teacherId = text(body, "teacherId");
        if (name == null || name.isBlank()) throw ApiException.bad("请填写教学班名称");
        if (teacherId == null || teacherId.isBlank()) throw ApiException.bad("请选择任课教师");
        Teacher teacher = teachers.findById(teacherId).orElseThrow(() -> ApiException.bad("教师不存在"));
        if (p.courseId != null && teacher.courseId != null && !p.courseId.equals(teacher.courseId)) {
            throw ApiException.forbidden("不能为其他课程的教师创建教学班");
        }
        String courseId = teacher.courseId != null ? teacher.courseId : p.courseId;
        if (courseId == null) courseId = "c1";
        String resolvedCourseId = courseId;
        teacher.courseId = resolvedCourseId;
        boolean duplicate = classes.findAll().stream()
                .filter(c -> resolvedCourseId.equals(c.courseId))
                .anyMatch(c -> name.trim().equalsIgnoreCase(c.name == null ? "" : c.name.trim()));
        if (duplicate) throw ApiException.bad("本课程已存在同名教学班");
        ClassGroup group = classGroupService.createForTeacher(teacher, name.trim(), text(body, "major"), text(body, "term"));
        teachers.save(teacher);
        audit.log(p, "教学班", "新增教学班「" + group.name + "」，任课教师「" + teacher.name + "」");
        return mapper.classGroup(group);
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

    /**
     * 彻底删除教师及其教学班、班内学生、关联试卷和全部作答记录。
     * 该操作用于课程负责人清理账号，必须在服务端事务内完成。
     */
    @DeleteMapping("/teachers/{id}")
    @Transactional
    public Map<String, Object> deleteTeacher(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        Teacher teacher = teachers.findById(id).orElseThrow(() -> ApiException.notFound("教师不存在"));
        if (p.courseId != null && teacher.courseId != null && !p.courseId.equals(teacher.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的教师");
        }

        List<ClassGroup> ownedClasses = new ArrayList<>();
        Set<String> classIds = new HashSet<>();
        for (ClassGroup group : classes.findAll()) {
            if (id.equals(group.teacherId)) {
                ownedClasses.add(group);
                if (group.id != null) classIds.add(group.id);
            }
        }

        List<Student> relatedStudents = new ArrayList<>();
        Set<String> studentIds = new HashSet<>();
        for (Student student : students.findAll()) {
            if (student.classId != null && classIds.contains(student.classId)) {
                relatedStudents.add(student);
                studentIds.add(student.id);
            }
        }

        List<Paper> relatedPapers = new ArrayList<>();
        Set<String> paperIds = new HashSet<>();
        for (Paper paper : papers.findAll()) {
            if (id.equals(paper.teacherId) || paperTargetsAnyClass(paper, classIds)) {
                relatedPapers.add(paper);
                paperIds.add(paper.id);
            }
        }

        List<Attempt> relatedAttempts = new ArrayList<>();
        for (Attempt attempt : attempts.findAll()) {
            if (paperIds.contains(attempt.paperId) || studentIds.contains(attempt.studentId)) {
                relatedAttempts.add(attempt);
            }
        }

        attempts.deleteAllInBatch(relatedAttempts);
        papers.deleteAllInBatch(relatedPapers);
        Set<String> userIds = new LinkedHashSet<>(studentIds);
        userIds.add(teacher.id);
        users.deleteAllById(new ArrayList<>(userIds));
        students.deleteAllInBatch(relatedStudents);
        classes.deleteAllInBatch(ownedClasses);
        teachers.delete(teacher);

        Set<String> courseIds = new LinkedHashSet<>();
        if (teacher.courseId != null) courseIds.add(teacher.courseId);
        for (ClassGroup group : ownedClasses) {
            if (group.courseId != null) courseIds.add(group.courseId);
        }
        for (String courseId : courseIds) classGroupService.refreshCourseClassCount(courseId);

        audit.log(p, "账号", "删除教师「" + teacher.name + "」（" + teacher.no + "），级联删除教学班 "
                + ownedClasses.size() + " 个、学生 " + relatedStudents.size() + " 人、试卷 "
                + relatedPapers.size() + " 份、作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "教师及关联数据已彻底删除");
        result.put("teacher", teacher.name);
        result.put("classes", ownedClasses.size());
        result.put("students", relatedStudents.size());
        result.put("papers", relatedPapers.size());
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 彻底删除学生及其账号、作答记录，并同步扣减教学班人数。
     */
    @DeleteMapping("/students/{id}")
    @Transactional
    public Map<String, Object> deleteStudent(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireStaff(p);
        Student student = students.findById(id).orElseThrow(() -> ApiException.notFound("学生不存在"));
        ClassGroup group = student.classId == null ? null : classes.findById(student.classId).orElse(null);
        if ("teacher".equals(p.role)) {
            if (group == null || !p.id.equals(group.teacherId)) {
                throw ApiException.forbidden("只能删除本人教学班的学生");
            }
        }
        if (p.courseId != null && group != null && group.courseId != null
                && !p.courseId.equals(group.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的学生");
        }

        List<Attempt> relatedAttempts = attempts.findByStudentIdOrderBySubmittedAtDesc(student.id);
        attempts.deleteAllInBatch(relatedAttempts);
        users.deleteAllById(List.of(student.id));
        students.delete(student);
        if (group != null) {
            group.count = Math.max(0, group.count - 1);
            classes.save(group);
        }

        audit.log(p, "账号", "删除学生「" + student.name + "」（" + student.no + "），教学班「"
                + (group == null ? "未绑定" : group.name) + "」，删除作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "学生及关联数据已彻底删除");
        result.put("student", student.name);
        result.put("classId", student.classId);
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 彻底删除课程及其课程下的知识点、题目、教师、教学班、学生、关联试卷和作答记录。
     * 当前登录账号所属课程禁止删除，避免账号上下文失效。
     */
    @DeleteMapping("/courses/{id}")
    @Transactional
    public Map<String, Object> deleteCourse(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        Course course = courses.findById(id).orElseThrow(() -> ApiException.notFound("课程不存在"));
        if (course.id.equals(p.courseId)) {
            throw ApiException.conflict("当前账号所属课程不能删除，请先切换课程");
        }

        List<ClassGroup> relatedClasses = new ArrayList<>();
        Set<String> classIds = new HashSet<>();
        Set<String> boundTeacherIds = new HashSet<>();
        for (ClassGroup group : classes.findAll()) {
            if (id.equals(group.courseId)) {
                relatedClasses.add(group);
                if (group.id != null) classIds.add(group.id);
                if (group.teacherId != null) boundTeacherIds.add(group.teacherId);
            }
        }

        List<Teacher> relatedTeachers = new ArrayList<>();
        Set<String> teacherIds = new HashSet<>();
        for (Teacher teacher : teachers.findAll()) {
            if (id.equals(teacher.courseId) || boundTeacherIds.contains(teacher.id)) {
                relatedTeachers.add(teacher);
                if (teacher.id != null) teacherIds.add(teacher.id);
            }
        }

        List<KnowledgePoint> relatedKps = new ArrayList<>();
        Set<String> kpIds = new HashSet<>();
        for (KnowledgePoint kp : kps.findAll()) {
            if (id.equals(kp.courseId)) {
                relatedKps.add(kp);
                if (kp.id != null) kpIds.add(kp.id);
            }
        }

        List<Question> relatedQuestions = new ArrayList<>();
        Set<String> questionIds = new HashSet<>();
        for (Question question : questions.findAll()) {
            if (question.kpId != null && kpIds.contains(question.kpId)) {
                relatedQuestions.add(question);
                if (question.id != null) questionIds.add(question.id);
            }
        }

        List<Student> relatedStudents = new ArrayList<>();
        Set<String> studentIds = new HashSet<>();
        for (Student student : students.findAll()) {
            if (student.classId != null && classIds.contains(student.classId)) {
                relatedStudents.add(student);
                if (student.id != null) studentIds.add(student.id);
            }
        }

        List<Paper> relatedPapers = new ArrayList<>();
        Set<String> paperIds = new HashSet<>();
        for (Paper paper : papers.findAll()) {
            if (id.equals(paper.courseId)
                    || paperTargetsAnyClass(paper, classIds)
                    || paperUsesAnyQuestion(paper, questionIds)) {
                relatedPapers.add(paper);
                if (paper.id != null) paperIds.add(paper.id);
            }
        }

        List<Attempt> relatedAttempts = relatedAttempts(paperIds, studentIds);
        deleteRelated(relatedAttempts, relatedPapers, relatedQuestions, relatedKps, relatedStudents, relatedClasses);
        Set<String> userIds = new LinkedHashSet<>(studentIds);
        userIds.addAll(teacherIds);
        users.deleteAllById(new ArrayList<>(userIds));
        teachers.deleteAllInBatch(relatedTeachers);
        courses.delete(course);

        audit.log(p, "账号", "删除课程「" + course.name + "」，级联删除知识点 " + relatedKps.size()
                + " 个、题目 " + relatedQuestions.size() + " 道、教师 " + relatedTeachers.size()
                + " 人、教学班 " + relatedClasses.size() + " 个、学生 " + relatedStudents.size()
                + " 人、试卷 " + relatedPapers.size() + " 份、作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "课程及关联数据已彻底删除");
        result.put("course", course.name);
        result.put("kps", relatedKps.size());
        result.put("questions", relatedQuestions.size());
        result.put("teachers", relatedTeachers.size());
        result.put("classes", relatedClasses.size());
        result.put("students", relatedStudents.size());
        result.put("papers", relatedPapers.size());
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 删除知识点时同时删除其下题目；若这些题目已被试卷引用，则连同相关试卷和作答一并删除，
     * 避免试卷快照指向不存在的题目。
     */
    @DeleteMapping("/kps/{id}")
    @Transactional
    public Map<String, Object> deleteKp(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        KnowledgePoint kp = kps.findById(id).orElseThrow(() -> ApiException.notFound("知识点不存在"));
        if (p.courseId != null && kp.courseId != null && !p.courseId.equals(kp.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的知识点");
        }

        List<Question> relatedQuestions = new ArrayList<>();
        Set<String> questionIds = new HashSet<>();
        for (Question question : questions.findAll()) {
            if (id.equals(question.kpId)) {
                relatedQuestions.add(question);
                if (question.id != null) questionIds.add(question.id);
            }
        }
        List<Paper> relatedPapers = papersUsingQuestions(questionIds);
        Set<String> paperIds = new HashSet<>();
        for (Paper paper : relatedPapers) paperIds.add(paper.id);
        List<Attempt> relatedAttempts = relatedAttempts(paperIds, Set.of());

        attempts.deleteAllInBatch(relatedAttempts);
        papers.deleteAllInBatch(relatedPapers);
        questions.deleteAllInBatch(relatedQuestions);
        kps.delete(kp);

        audit.log(p, "题库", "删除知识点「" + kp.name + "」，级联删除题目 " + relatedQuestions.size()
                + " 道、试卷 " + relatedPapers.size() + " 份、作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "知识点及关联题目已彻底删除");
        result.put("kp", kp.name);
        result.put("questions", relatedQuestions.size());
        result.put("papers", relatedPapers.size());
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 删除题目时连同引用它的试卷和作答一并删除，避免试卷详情和统计出现空题。
     */
    @DeleteMapping("/questions/{id}")
    @Transactional
    public Map<String, Object> deleteQuestion(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        Question question = questions.findById(id).orElseThrow(() -> ApiException.notFound("题目不存在"));
        KnowledgePoint kp = question.kpId == null ? null : kps.findById(question.kpId).orElse(null);
        if (kp != null && p.courseId != null && kp.courseId != null && !p.courseId.equals(kp.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的题目");
        }

        List<Paper> relatedPapers = papersUsingQuestions(Set.of(question.id));
        Set<String> paperIds = new HashSet<>();
        for (Paper paper : relatedPapers) paperIds.add(paper.id);
        List<Attempt> relatedAttempts = relatedAttempts(paperIds, Set.of());

        attempts.deleteAllInBatch(relatedAttempts);
        papers.deleteAllInBatch(relatedPapers);
        questions.delete(question);

        audit.log(p, "题库", "删除题目「" + question.id + "」，级联删除试卷 " + relatedPapers.size()
                + " 份、作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "题目及引用试卷已彻底删除");
        result.put("question", question.id);
        result.put("papers", relatedPapers.size());
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 删除教学班及其学生账号、该班关联试卷和全部作答，并同步教师教学班文本与课程班级数。
     */
    @DeleteMapping("/classes/{id}")
    @Transactional
    public Map<String, Object> deleteClass(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireCl(p);
        ClassGroup group = classes.findById(id).orElseThrow(() -> ApiException.notFound("教学班不存在"));
        if (p.courseId != null && group.courseId != null && !p.courseId.equals(group.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的教学班");
        }

        List<Student> relatedStudents = new ArrayList<>();
        Set<String> studentIds = new HashSet<>();
        for (Student student : students.findAll()) {
            if (id.equals(student.classId)) {
                relatedStudents.add(student);
                if (student.id != null) studentIds.add(student.id);
            }
        }

        List<Paper> relatedPapers = new ArrayList<>();
        Set<String> paperIds = new HashSet<>();
        for (Paper paper : papers.findAll()) {
            if (paperTargetsAnyClass(paper, Set.of(id))) {
                relatedPapers.add(paper);
                if (paper.id != null) paperIds.add(paper.id);
            }
        }
        List<Attempt> relatedAttempts = relatedAttempts(paperIds, studentIds);

        attempts.deleteAllInBatch(relatedAttempts);
        papers.deleteAllInBatch(relatedPapers);
        users.deleteAllById(new ArrayList<>(studentIds));
        students.deleteAllInBatch(relatedStudents);
        classes.delete(group);
        refreshTeacherClassNames(group.teacherId);
        classGroupService.refreshCourseClassCount(group.courseId);

        audit.log(p, "教学班", "删除教学班「" + group.name + "」，级联删除学生 " + relatedStudents.size()
                + " 人、试卷 " + relatedPapers.size() + " 份、作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "教学班及关联数据已彻底删除");
        result.put("class", group.name);
        result.put("students", relatedStudents.size());
        result.put("papers", relatedPapers.size());
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    /**
     * 彻底删除试卷及其全部作答记录。教师只能删除本人发布的试卷。
     */
    @DeleteMapping("/papers/{id}")
    @Transactional
    public Map<String, Object> deletePaper(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        requireStaff(p);
        Paper paper = papers.findById(id).orElseThrow(() -> ApiException.notFound("试卷不存在"));
        if ("teacher".equals(p.role) && !p.id.equals(paper.teacherId)) {
            throw ApiException.forbidden("不能删除其他教师的试卷");
        }
        if ("course_leader".equals(p.role) && p.courseId != null && paper.courseId != null
                && !p.courseId.equals(paper.courseId)) {
            throw ApiException.forbidden("不能删除其他课程的试卷");
        }

        List<Attempt> relatedAttempts = new ArrayList<>();
        for (Attempt attempt : attempts.findAll()) {
            if (id.equals(attempt.paperId)) relatedAttempts.add(attempt);
        }
        attempts.deleteAllInBatch(relatedAttempts);
        papers.delete(paper);

        audit.log(p, "组卷", "删除试卷「" + paper.name + "」，级联删除作答 " + relatedAttempts.size() + " 条");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("ok", true);
        result.put("message", "试卷及作答记录已彻底删除");
        result.put("paper", paper.name);
        result.put("attempts", relatedAttempts.size());
        return result;
    }

    private void deleteRelated(List<Attempt> relatedAttempts, List<Paper> relatedPapers,
                               List<Question> relatedQuestions, List<KnowledgePoint> relatedKps,
                               List<Student> relatedStudents, List<ClassGroup> relatedClasses) {
        attempts.deleteAllInBatch(relatedAttempts);
        papers.deleteAllInBatch(relatedPapers);
        questions.deleteAllInBatch(relatedQuestions);
        kps.deleteAllInBatch(relatedKps);
        students.deleteAllInBatch(relatedStudents);
        classes.deleteAllInBatch(relatedClasses);
    }

    private List<Attempt> relatedAttempts(Set<String> paperIds, Set<String> studentIds) {
        List<Attempt> result = new ArrayList<>();
        for (Attempt attempt : attempts.findAll()) {
            if (paperIds.contains(attempt.paperId) || studentIds.contains(attempt.studentId)) {
                result.add(attempt);
            }
        }
        return result;
    }

    private List<Paper> papersUsingQuestions(Set<String> questionIds) {
        List<Paper> result = new ArrayList<>();
        if (questionIds.isEmpty()) return result;
        for (Paper paper : papers.findAll()) {
            if (paperUsesAnyQuestion(paper, questionIds)) result.add(paper);
        }
        return result;
    }

    private boolean paperUsesAnyQuestion(Paper paper, Set<String> questionIds) {
        if (questionIds.isEmpty() || paper.itemsJson == null) return false;
        List<Map<String, Object>> items = mapper.read(paper.itemsJson,
                new TypeReference<List<Map<String, Object>>>() {}, List.of());
        for (Map<String, Object> item : items) {
            if (item.get("qid") != null && questionIds.contains(String.valueOf(item.get("qid")))) {
                return true;
            }
        }
        return false;
    }

    private void refreshTeacherClassNames(String teacherId) {
        if (teacherId == null) return;
        teachers.findById(teacherId).ifPresent(teacher -> {
            teacher.classes = classGroupService.joinNames(classes.findAll().stream()
                    .filter(group -> teacherId.equals(group.teacherId))
                    .map(group -> group.name)
                    .toList());
            teachers.save(teacher);
        });
    }

    private boolean paperTargetsAnyClass(Paper paper, Set<String> classIds) {
        if (classIds.isEmpty()) return false;
        List<String> targetIds = mapper.read(paper.classIdsJson,
                new TypeReference<List<String>>() {}, List.of());
        for (String targetId : targetIds) {
            if (classIds.contains(targetId)) return true;
        }
        return false;
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
