package com.xiangmu.domain;

import jakarta.persistence.*;

@Entity
@Table(name = "ai_provider")
public class AiProvider {
    @Id
    public String id;
    public String name;
    public String baseUrl;
    @Column(columnDefinition = "text")
    public String apiKey;
    public String model;
    public boolean active;
    public String createdAt;
    public String updatedAt;
}
