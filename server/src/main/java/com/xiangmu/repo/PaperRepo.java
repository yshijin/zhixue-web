package com.xiangmu.repo;

import com.xiangmu.domain.Paper;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PaperRepo extends JpaRepository<Paper, String> {
    List<Paper> findByTeacherIdOrderByPublishedAtDesc(String teacherId);
}
