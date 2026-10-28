package com.xiangmu.repo;

import com.xiangmu.domain.Teacher;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeacherRepo extends JpaRepository<Teacher, String> {}
