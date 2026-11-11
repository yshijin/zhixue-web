package com.xiangmu.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xiangmu.domain.*;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

@Component
public class ApiMapper {
    private final ObjectMapper json;

    public ApiMapper(ObjectMapper json) {
        this.json = json;
    }

    public String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException("JSON 序列化失败", e);
        }
    }

    public <T> T read(String value, TypeReference<T> type, T fallback) {
        if (value == null || value.isBlank()) return fallback;
        try {
            return json.readValue(value, type);
        } catch (Exception e) {
            return fallback;
        }
    }

    public Map<String, Object> course(Course c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.id);
        m.put("name", c.name);
        m.put("code", c.code);
        m.put("term", c.term);
        m.put("owner", c.owner);
        m.put("classes", c.classCount);
        m.put("status", c.status);
        m.put("createdAt", c.createdAt);
        return m;
    }

    public Map<String, Object> kp(KnowledgePoint k) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", k.id);
        m.put("courseId", k.courseId);
        m.put("code", k.code);
        m.put("name", k.name);
        m.put("desc", k.description);
        m.put("sort", k.sort);
        m.put("status", k.status);
        return m;
    }

    public Map<String, Object> question(Question q, boolean withAnswer) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", q.id);
        m.put("kpId", q.kpId);
        m.put("type", q.type);
        m.put("stem", q.stem);
        m.put("options", read(q.optionsJson, new TypeReference<List<Map<String, Object>>>() {}, List.of()));
        if (withAnswer) {
            m.put("answer", q.answer);
            m.put("analysis", q.analysis);
        }
        m.put("difficulty", q.difficulty);
        m.put("status", q.status);
        m.put("real", q.realQuestion);
        return m;
    }

    public Map<String, Object> paper(Paper p) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.id);
        m.put("name", p.name);
        m.put("courseId", p.courseId);
        m.put("teacherId", p.teacherId);
        m.put("teacherName", p.teacherName);
        m.put("ownerStudentId", p.ownerStudentId);
        m.put("classIds", read(p.classIdsJson, new TypeReference<List<String>>() {}, List.of()));
        m.put("className", p.className);
        m.put("items", read(p.itemsJson, new TypeReference<List<Map<String, Object>>>() {}, List.of()));
        m.put("status", p.status);
        m.put("startAt", p.startAt);
        m.put("endAt", p.endAt);
        m.put("duration", p.duration);
        m.put("attemptsAllowed", p.attemptsAllowed);
        m.put("answerPolicy", p.answerPolicy);
        m.put("shuffle", p.shuffle);
        m.put("publishedAt", p.publishedAt);
        return m;
    }

    public Map<String, Object> attempt(Attempt a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id);
        m.put("paperId", a.paperId);
        m.put("studentId", a.studentId);
        m.put("answers", read(a.answersJson, new TypeReference<Map<String, String>>() {}, Map.of()));
        m.put("score", a.score);
        m.put("total", a.total);
        m.put("correctCount", a.correctCount);
        m.put("startedAt", a.startedAt);
        m.put("submittedAt", a.submittedAt);
        m.put("updatedAt", a.updatedAt);
        m.put("timeUsed", a.timeUsed);
        m.put("status", a.status);
        return m;
    }

    public Map<String, Object> teacher(Teacher t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.id);
        m.put("no", t.no);
        m.put("name", t.name);
        m.put("courseId", t.courseId);
        m.put("classes", t.classes);
        m.put("phone", t.phone);
        m.put("status", t.status);
        return m;
    }

    public Map<String, Object> classGroup(ClassGroup c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.id);
        m.put("name", c.name);
        m.put("courseId", c.courseId);
        m.put("teacherId", c.teacherId);
        m.put("teacherName", c.teacherName);
        m.put("count", c.count);
        m.put("major", c.major);
        m.put("term", c.term);
        return m;
    }

    public Map<String, Object> student(Student s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", s.id);
        m.put("no", s.no);
        m.put("name", s.name);
        m.put("classId", s.classId);
        m.put("major", s.major);
        m.put("adminClass", s.adminClass);
        m.put("status", s.status);
        return m;
    }

    public Map<String, Object> log(AuditLog l) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.id);
        m.put("operator", l.operator);
        m.put("role", l.role);
        m.put("action", l.action);
        m.put("detail", l.detail);
        m.put("time", l.time);
        return m;
    }

    public Instant instant(Object value) {
        if (value == null || value.toString().isBlank()) return null;
        return Instant.parse(value.toString());
    }
}
