package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "question")
public class Question {
    @Id
    public String id;
    public String kpId;
    public String type;
    @Column(columnDefinition = "text")
    public String stem;
    @Column(columnDefinition = "text")
    public String optionsJson;
    public String answer;
    @Column(columnDefinition = "text")
    public String analysis;
    public String difficulty;
    public String status;
    @Column(name = "is_real")
    public boolean realQuestion;
}
