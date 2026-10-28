package com.xiangmu.domain;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "attempt", uniqueConstraints = {
        @UniqueConstraint(name = "uk_attempt_paper_student", columnNames = {"paper_id", "student_id"})
})
public class Attempt {
    @Id
    public String id;
    @Column(name = "paper_id", nullable = false)
    public String paperId;
    @Column(name = "student_id", nullable = false)
    public String studentId;
    @Column(columnDefinition = "text")
    public String answersJson;
    public int score;
    public int total;
    public int correctCount;
    public Instant startedAt;
    public Instant submittedAt;
    public Instant updatedAt;
    public int timeUsed;
    public String status;
}
