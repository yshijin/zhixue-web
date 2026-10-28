package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "student")
public class Student {
    @Id
    public String id;
    public String no;
    public String name;
    public String classId;
    public String major;
    public String adminClass;
    public String status;
}
