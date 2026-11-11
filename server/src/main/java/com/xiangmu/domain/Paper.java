package com.xiangmu.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "paper")
public class Paper {
    @Id
    public String id;
    public String name;
    public String courseId;
    public String teacherId;
    public String teacherName;
    /** 非空表示学生个人错题测试，只允许该学生本人查看和作答。 */
    @Column(name = "owner_student_id")
    public String ownerStudentId;
    @Column(columnDefinition = "text")
    public String classIdsJson;
    public String className;
    @Column(columnDefinition = "text")
    public String itemsJson;
    public String status;
    public Instant startAt;
    public Instant endAt;
    public int duration;
    public int attemptsAllowed;
    public String answerPolicy;
    public boolean shuffle;
    public Instant publishedAt;
}
