package com.xiangmu.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "course")
public class Course {
    @Id
    public String id;
    public String name;
    public String code;
    public String term;
    public String owner;
    @Column(name = "class_count")
    public int classCount;
    public String status;
    public String createdAt;
}
