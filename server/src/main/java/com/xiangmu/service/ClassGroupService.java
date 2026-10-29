package com.xiangmu.service;

import com.xiangmu.domain.ClassGroup;
import com.xiangmu.domain.Teacher;
import com.xiangmu.repo.ClassGroupRepo;
import com.xiangmu.repo.CourseRepo;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 教学班与教师的绑定逻辑。
 *
 * <p>教师导入/新增时，教学班名称不能只写入 Teacher.classes 文本字段，
 * 还必须创建或绑定真正的 ClassGroup，否则教师登录后看不到教学班、学生和试卷。</p>
 */
@Service
public class ClassGroupService {
    private final ClassGroupRepo classes;
    private final CourseRepo courses;

    public ClassGroupService(ClassGroupRepo classes, CourseRepo courses) {
        this.classes = classes;
        this.courses = courses;
    }

    public record PlannedClass(String name, ClassGroup existing) {}

    public record BindingPlan(List<PlannedClass> classes, List<String> names, List<String> errors) {
        public boolean hasErrors() {
            return !errors.isEmpty();
        }
    }

    /**
     * 只做校验和计划，不写数据库。供导入预检和正式导入共用。
     */
    public BindingPlan plan(Teacher teacher, String rawNames) {
        List<String> names = splitNames(rawNames);
        List<PlannedClass> planned = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        List<ClassGroup> all = classes.findAll();
        for (String name : names) {
            String key = name.toLowerCase(Locale.ROOT);
            if (!seen.add(key)) continue;
            ClassGroup existing = all.stream()
                    .filter(c -> sameCourse(c.courseId, teacher.courseId))
                    .filter(c -> c.name != null && name.equalsIgnoreCase(c.name.trim()))
                    .findFirst()
                    .orElse(null);
            if (existing != null && !blank(existing.teacherId) && !existing.teacherId.equals(teacher.id)) {
                String owner = blank(existing.teacherName) ? existing.teacherId : existing.teacherName;
                errors.add("教学班「" + name + "」已由教师「" + owner + "」负责，不能重复绑定");
                continue;
            }
            planned.add(new PlannedClass(name, existing));
        }
        return new BindingPlan(planned, planned.stream().map(PlannedClass::name).toList(), errors);
    }

    /**
     * 按计划创建/绑定教学班。必须在 plan 无错误、Teacher 已保存后调用。
     */
    public List<ClassGroup> apply(Teacher teacher, BindingPlan plan) {
        List<ClassGroup> result = new ArrayList<>();
        for (PlannedClass planned : plan.classes()) {
            ClassGroup group = planned.existing();
            if (group == null) {
                group = new ClassGroup();
                group.id = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
                group.name = planned.name();
                group.courseId = teacher.courseId;
                group.count = 0;
                group.term = courseTerm(teacher.courseId);
            }
            if (blank(group.teacherId)) {
                group.teacherId = teacher.id;
                group.teacherName = teacher.name;
            } else if (group.teacherId.equals(teacher.id)) {
                group.teacherName = teacher.name;
            }
            classes.save(group);
            result.add(group);
        }
        refreshCourseClassCount(teacher.courseId);
        return result;
    }

    /**
     * 课程负责人新增教学班时使用。调用方负责保存 teacher（本方法会追加教师的教学班名称）。
     */
    public ClassGroup createForTeacher(Teacher teacher, String name, String major, String term) {
        ClassGroup group = new ClassGroup();
        group.id = "c" + UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        group.name = name;
        group.courseId = teacher.courseId;
        group.teacherId = teacher.id;
        group.teacherName = teacher.name;
        group.count = 0;
        group.major = blank(major) ? null : major.trim();
        group.term = blank(term) ? courseTerm(teacher.courseId) : term.trim();
        classes.save(group);
        teacher.classes = joinNames(classes.findAll().stream()
                .filter(c -> teacher.id.equals(c.teacherId))
                .map(c -> c.name)
                .toList());
        refreshCourseClassCount(teacher.courseId);
        return group;
    }

    public String joinNames(List<String> names) {
        return names == null || names.isEmpty() ? null : String.join("、", names);
    }

    public List<String> splitNames(String raw) {
        if (blank(raw)) return List.of();
        LinkedHashSet<String> names = new LinkedHashSet<>();
        for (String part : raw.split("[,，;；、\\n\\r]+")) {
            String value = part.trim();
            if (!value.isEmpty()) names.add(value);
        }
        return new ArrayList<>(names);
    }

    private void refreshCourseClassCount(String courseId) {
        if (blank(courseId)) return;
        courses.findById(courseId).ifPresent(course -> {
            course.classCount = (int) classes.findAll().stream()
                    .filter(c -> courseId.equals(c.courseId))
                    .count();
            courses.save(course);
        });
    }

    private String courseTerm(String courseId) {
        if (blank(courseId)) return null;
        return courses.findById(courseId).map(c -> c.term).orElse(null);
    }

    private boolean sameCourse(String a, String b) {
        return a == null || b == null || a.equals(b);
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
