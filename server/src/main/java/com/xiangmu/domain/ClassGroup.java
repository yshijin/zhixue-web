package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "class_group")
public class ClassGroup {
    @Id
    public String id;
    public String name;
    public String courseId;
    public String teacherId;
    public String teacherName;
    @Column(name = "student_count")
    public int count;
    public String major;
    public String term;
}
