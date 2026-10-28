package com.xiangmu.repo;

import com.xiangmu.domain.Course;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CourseRepo extends JpaRepository<Course, String> {}
