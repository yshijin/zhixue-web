package com.xiangmu.repo;

import com.xiangmu.domain.KnowledgePoint;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgePointRepo extends JpaRepository<KnowledgePoint, String> {}
