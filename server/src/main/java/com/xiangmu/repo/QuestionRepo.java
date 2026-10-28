package com.xiangmu.repo;

import com.xiangmu.domain.Question;
import org.springframework.data.jpa.repository.JpaRepository;

public interface QuestionRepo extends JpaRepository<Question, String> {}
