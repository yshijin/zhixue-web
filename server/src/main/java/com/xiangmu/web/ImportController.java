package com.xiangmu.web;

import com.xiangmu.domain.*;
import com.xiangmu.repo.*;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.AuditService;
import com.xiangmu.service.ClassGroupService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/import")
public class ImportController {
    private final KnowledgePointRepo kps;
    private final QuestionRepo questions;
    private final TeacherRepo teachers;
    private final StudentRepo students;
    private final ClassGroupRepo classes;
    private final UserRepo users;
    private final PasswordEncoder encoder;
    private final AuditService audit;
    private final ClassGroupService classGroupService;

    public ImportController(KnowledgePointRepo kps, QuestionRepo questions, TeacherRepo teachers,
                            StudentRepo students, ClassGroupRepo classes, UserRepo users,
                            PasswordEncoder encoder, AuditService audit,
                            ClassGroupService classGroupService) {
        this.kps = kps;
        this.questions = questions;
        this.teachers = teachers;
        this.students = students;
        this.classes = classes;
        this.users = users;
        this.encoder = encoder;
        this.audit = audit;
        this.classGroupService = classGroupService;
    }

    public record ImportRequest(List<List<String>> rows, boolean commit) {}

    private record TeacherImportRow(Teacher teacher, ClassGroupService.BindingPlan plan) {}

    @PostMapping("/{kind}")
    @Transactional
    public Map<String, Object> importRows(@AuthenticationPrincipal AppPrincipal p, @PathVariable String kind,
                                          @RequestBody ImportRequest request) {
        if (request == null || request.rows() == null || request.rows().isEmpty()) {
            throw ApiException.bad("文件中没有可导入的数据");
        }
        List<List<String>> rows = request.rows();
        Map<String, Integer> header = headerIndex(rows.get(0));
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int success = 0;
        int from = looksLikeHeader(rows.get(0)) ? 1 : 0;
        switch (kind) {
            case "student" -> success = importStudents(p, rows, from, header, request.commit(), errors, warnings);
            case "teacher" -> {
                requireCl(p);
                success = importTeachers(p, rows, from, header, request.commit(), errors, warnings);
            }
            case "kp" -> {
                requireCl(p);
                success = importKps(p, rows, from, header, request.commit(), errors, warnings);
            }
            case "question" -> {
                requireCl(p);
                success = importQuestions(p, rows, from, header, request.commit(), errors, warnings);
            }
            default -> throw ApiException.bad("不支持的导入类型");
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("kind", kind);
        out.put("commit", request.commit());
        out.put("success", success);
        out.put("errors", errors);
        out.put("warnings", warnings);
        return out;
    }

    private int importStudents(AppPrincipal p, List<List<String>> rows, int from, Map<String, Integer> h,
                               boolean commit, List<String> errors, List<String> warnings) {
        if (!"course_leader".equals(p.role) && !"teacher".equals(p.role)) {
            throw ApiException.forbidden("仅教师或课程负责人可以导入学生");
        }
        Set<String> seen = new HashSet<>();
        Map<String, Integer> increments = new HashMap<>();
        List<Student> pending = new ArrayList<>();
        for (int i = from; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String no = cell(row, h, "学号", "no", "学生学号");
            String name = cell(row, h, "姓名", "name", "学生姓名");
            String className = cell(row, h, "教学班", "class", "班级");
            String major = cell(row, h, "专业", "major");
            String adminClass = cell(row, h, "行政班", "adminClass", "行政班级");
            String where = "第 " + (i + 1) + " 行：";
            if (blank(no) || blank(name)) { errors.add(where + "学号和姓名必填"); continue; }
            if (!seen.add(no)) { errors.add(where + "文件内学号重复：" + no); continue; }
            if (students.findByNo(no) != null) { warnings.add(where + "学号 " + no + " 已存在，跳过"); continue; }
            ClassGroup group = resolveClass(p, className);
            if (group == null) { errors.add(where + "教学班不存在或不在您的管理范围：" + (blank(className) ? "（空）" : className)); continue; }
            Student s = new Student();
            s.id = "s" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            s.no = no.trim();
            s.name = name.trim();
            s.classId = group.id;
            s.major = blank(major) ? null : major.trim();
            s.adminClass = blank(adminClass) ? null : adminClass.trim();
            s.status = "active";
            pending.add(s);
            increments.merge(group.id, 1, Integer::sum);
        }
        if (commit) {
            for (Student s : pending) {
                students.save(s);
                UserAccount u = new UserAccount();
                u.id = s.id;
                u.username = uniqueUsername(s.no);
                u.passwordHash = encoder.encode("123456");
                u.displayName = s.name;
                u.role = "student";
                ClassGroup g = classes.findById(s.classId).orElse(null);
                u.courseId = g == null ? p.courseId : g.courseId;
                u.classId = s.classId;
                users.save(u);
                if (g != null) {
                    g.count = Math.max(0, g.count) + 1;
                    classes.save(g);
                }
            }
            if (!pending.isEmpty()) audit.log(p, "导入", "批量导入学生 " + pending.size() + " 人");
        }
        return pending.size();
    }

    private int importTeachers(AppPrincipal p, List<List<String>> rows, int from, Map<String, Integer> h,
                               boolean commit, List<String> errors, List<String> warnings) {
        Set<String> seen = new HashSet<>();
        Map<String, String> claimedClasses = new HashMap<>();
        List<TeacherImportRow> pending = new ArrayList<>();
        for (int i = from; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String no = cell(row, h, "教师工号", "工号", "no");
            String name = cell(row, h, "教师姓名", "姓名", "name");
            String classes = cell(row, h, "教学班名称", "教学班", "classes");
            String phone = cell(row, h, "手机号", "电话", "phone");
            String where = "第 " + (i + 1) + " 行：";
            if (blank(no) || blank(name)) { errors.add(where + "教师工号和姓名必填"); continue; }
            if (!seen.add(no)) { errors.add(where + "文件内工号重复：" + no); continue; }
            if (teachers.findAll().stream().anyMatch(t -> no.equalsIgnoreCase(t.no))) {
                warnings.add(where + "工号 " + no + " 已存在，跳过");
                continue;
            }
            Teacher t = new Teacher();
            t.id = "t" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            t.no = no.trim();
            t.name = name.trim();
            t.courseId = p.courseId == null ? "c1" : p.courseId;
            t.phone = blank(phone) ? null : phone.trim();
            t.status = "active";

            ClassGroupService.BindingPlan plan = classGroupService.plan(t, classes);
            if (plan.hasErrors()) {
                errors.add(where + String.join("；", plan.errors()));
                continue;
            }
            // 同一份文件里不能有两个教师同时认领同一个教学班。
            String conflict = null;
            for (ClassGroupService.PlannedClass pc : plan.classes()) {
                String key = pc.existing() != null
                        ? "id:" + pc.existing().id
                        : "name:" + pc.name().toLowerCase(Locale.ROOT);
                String other = claimedClasses.putIfAbsent(key, t.no);
                if (other != null) {
                    conflict = "教学班「" + pc.name() + "」在文件中同时分配给了工号 " + other + " 和 " + t.no;
                    break;
                }
            }
            if (conflict != null) {
                errors.add(where + conflict);
                continue;
            }
            if (plan.names().isEmpty()) {
                warnings.add(where + "未填写教学班名称，教师账号可登录，但需要课程负责人后续绑定教学班");
            }
            t.classes = classGroupService.joinNames(plan.names());
            pending.add(new TeacherImportRow(t, plan));
        }
        if (commit) {
            int classCount = 0;
            for (TeacherImportRow row : pending) {
                Teacher t = row.teacher();
                teachers.save(t);
                classCount += classGroupService.apply(t, row.plan()).size();
                UserAccount u = new UserAccount();
                u.id = t.id;
                u.username = uniqueUsername(t.no.toLowerCase(Locale.ROOT));
                u.passwordHash = encoder.encode("123456");
                u.displayName = t.name;
                u.role = "teacher";
                u.courseId = t.courseId;
                users.save(u);
            }
            if (!pending.isEmpty()) {
                audit.log(p, "导入", "批量导入教师 " + pending.size() + " 人，绑定/创建教学班 " + classCount + " 个");
            }
        }
        return pending.size();
    }

    private int importKps(AppPrincipal p, List<List<String>> rows, int from, Map<String, Integer> h,
                          boolean commit, List<String> errors, List<String> warnings) {
        int next = kps.findAll().stream().mapToInt(x -> x.sort).max().orElse(0) + 1;
        Set<String> names = new HashSet<>();
        kps.findAll().forEach(k -> names.add(k.name));
        List<KnowledgePoint> pending = new ArrayList<>();
        for (int i = from; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String code = cell(row, h, "知识点编号", "编号", "code");
            String name = cell(row, h, "知识点名称", "名称", "name");
            String order = cell(row, h, "显示顺序", "顺序", "sort");
            String desc = cell(row, h, "知识点说明", "说明", "desc");
            String where = "第 " + (i + 1) + " 行：";
            if (blank(name)) { errors.add(where + "知识点名称必填"); continue; }
            if (!names.add(name.trim())) { warnings.add(where + "知识点「" + name + "」已存在，跳过"); continue; }
            KnowledgePoint k = new KnowledgePoint();
            k.id = "kp" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
            k.courseId = p.courseId == null ? "c1" : p.courseId;
            k.code = blank(code) ? "KP" + String.format("%02d", next) : code.trim();
            k.name = name.trim();
            k.description = blank(desc) ? null : desc.trim();
            k.sort = intOrDefault(order, next);
            if (k.sort <= 0) k.sort = next;
            next = Math.max(next, k.sort) + 1;
            k.status = "enabled";
            pending.add(k);
        }
        if (commit) {
            kps.saveAll(pending);
            if (!pending.isEmpty()) audit.log(p, "导入", "批量导入知识点 " + pending.size() + " 个");
        }
        return pending.size();
    }

    private int importQuestions(AppPrincipal p, List<List<String>> rows, int from, Map<String, Integer> h,
                                boolean commit, List<String> errors, List<String> warnings) {
        Map<String, KnowledgePoint> byCode = new HashMap<>();
        Map<String, KnowledgePoint> byId = new HashMap<>();
        for (KnowledgePoint k : kps.findAll()) {
            byId.put(k.id, k);
            if (k.code != null) byCode.put(k.code.toUpperCase(Locale.ROOT), k);
        }
        List<Question> pending = new ArrayList<>();
        for (int i = from; i < rows.size(); i++) {
            List<String> row = rows.get(i);
            String typeRaw = cell(row, h, "题型", "type");
            String kpRaw = cell(row, h, "知识点编号", "知识点", "kp");
            String stem = cell(row, h, "题干", "stem");
            String answer = cell(row, h, "标准答案", "答案", "answer");
            String analysis = cell(row, h, "答案解析", "解析", "analysis");
            String diff = cell(row, h, "难度", "difficulty");
            String where = "第 " + (i + 1) + " 行：";
            String type = mapType(typeRaw);
            if (type == null) { errors.add(where + "题型「" + typeRaw + "」不在支持范围内（单选/多选/判断）"); continue; }
            if (blank(stem)) { errors.add(where + "题干必填"); continue; }
            if (blank(answer)) { errors.add(where + "标准答案必填"); continue; }
            KnowledgePoint kp = byCode.get(kpRaw == null ? "" : kpRaw.trim().toUpperCase(Locale.ROOT));
            if (kp == null) kp = byId.get(kpRaw == null ? "" : kpRaw.trim());
            if (kp == null) { errors.add(where + "知识点不存在：" + (blank(kpRaw) ? "（空）" : kpRaw)); continue; }
            List<Map<String, String>> options = new ArrayList<>();
            if ("judge".equals(type)) {
                options.add(Map.of("key", "T", "text", "正确"));
                options.add(Map.of("key", "F", "text", "错误"));
                if (!"T".equals(answer.trim().toUpperCase(Locale.ROOT)) && !"F".equals(answer.trim().toUpperCase(Locale.ROOT))) {
                    errors.add(where + "判断题答案必须为 T 或 F");
                    continue;
                }
            } else {
                for (String key : List.of("A", "B", "C", "D", "E", "F")) {
                    String value = cell(row, h, "选项" + key, "选项 " + key, "选项" + key.toLowerCase(Locale.ROOT));
                    if (!blank(value)) options.add(Map.of("key", key, "text", value.trim()));
                }
                if (options.size() < 2) { errors.add(where + "至少需要 2 个选项"); continue; }
                String normalized = answer.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-F]", "");
                if (normalized.isEmpty()) { errors.add(where + "答案格式不正确"); continue; }
                Set<String> keys = new HashSet<>();
                for (Map<String, String> option : options) keys.add(option.get("key"));
                boolean invalid = normalized.chars().anyMatch(ch -> !keys.contains(String.valueOf((char) ch)));
                if (invalid) { errors.add(where + "答案包含不存在的选项"); continue; }
                if ("single".equals(type) && normalized.length() != 1) { errors.add(where + "单选题只能有 1 个正确选项"); continue; }
                if ("multi".equals(type) && normalized.length() < 2) { errors.add(where + "多选题至少需要 2 个正确选项"); continue; }
                answer = normalized;
            }
            Question q = new Question();
            q.id = "Q" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase(Locale.ROOT);
            q.kpId = kp.id;
            q.type = type;
            q.stem = stem.trim();
            q.optionsJson = toJson(options);
            q.answer = answer.trim().toUpperCase(Locale.ROOT);
            q.analysis = blank(analysis) ? null : analysis.trim();
            q.difficulty = blank(diff) ? "中" : diff.trim();
            q.status = "enabled";
            q.realQuestion = false;
            pending.add(q);
        }
        if (commit) {
            questions.saveAll(pending);
            if (!pending.isEmpty()) audit.log(p, "导入", "批量导入题目 " + pending.size() + " 道");
        }
        return pending.size();
    }

    private ClassGroup resolveClass(AppPrincipal p, String className) {
        if (blank(className)) {
            if (p.classId != null) return classes.findById(p.classId).orElse(null);
            List<ClassGroup> own = classes.findAll().stream().filter(c -> p.id.equals(c.teacherId)).toList();
            return own.isEmpty() ? null : own.get(0);
        }
        String wanted = className.trim();
        return classes.findAll().stream()
                .filter(c -> wanted.equals(c.name) || wanted.equals(c.id))
                .filter(c -> "course_leader".equals(p.role) || p.id.equals(c.teacherId))
                .findFirst().orElse(null);
    }

    private String uniqueUsername(String base) {
        String username = base;
        int n = 2;
        while (users.findByUsername(username).isPresent()) username = base + n++;
        return username;
    }

    private Map<String, Integer> headerIndex(List<String> header) {
        Map<String, Integer> out = new HashMap<>();
        for (int i = 0; i < header.size(); i++) {
            String key = header.get(i) == null ? "" : header.get(i).trim().replace(" ", "");
            if (!key.isEmpty()) out.put(key, i);
        }
        return out;
    }

    private boolean looksLikeHeader(List<String> row) {
        if (row == null || row.isEmpty()) return false;
        return row.stream().filter(Objects::nonNull).map(String::trim)
                .anyMatch(x -> x.contains("学号") || x.contains("工号") || x.contains("编号")
                        || x.contains("题型") || x.contains("题干") || x.contains("姓名")
                        || x.contains("名称") || x.contains("标准答案"));
    }

    private String cell(List<String> row, Map<String, Integer> h, String... names) {
        for (String name : names) {
            Integer idx = h.get(name.replace(" ", ""));
            if (idx != null && idx < row.size()) {
                String value = row.get(idx);
                if (value != null) return value;
            }
        }
        return null;
    }

    private String mapType(String raw) {
        if (raw == null) return null;
        String s = raw.trim();
        return switch (s) {
            case "单选", "单选题", "single" -> "single";
            case "多选", "多选题", "multi" -> "multi";
            case "判断", "判断题", "judge" -> "judge";
            default -> null;
        };
    }

    private int intOrDefault(String value, int fallback) {
        try {
            return Integer.parseInt(value == null ? "" : value.trim());
        } catch (Exception e) {
            return fallback;
        }
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String toJson(Object value) {
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private void requireCl(AppPrincipal p) {
        if (!"course_leader".equals(p.role)) throw ApiException.forbidden("仅课程负责人可以执行此操作");
    }
}
