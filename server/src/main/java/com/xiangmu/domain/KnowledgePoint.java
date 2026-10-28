package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "knowledge_point")
public class KnowledgePoint {
    @Id
    public String id;
    public String courseId;
    public String code;
    public String name;
    @Column(name = "description")
    public String description;
    @Column(name = "sort_order")
    public int sort;
    public String status;
}
