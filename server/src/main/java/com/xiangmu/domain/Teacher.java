package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "teacher")
public class Teacher {
    @Id
    public String id;
    public String no;
    public String name;
    public String courseId;
    public String classes;
    public String phone;
    public String status;
}
