package com.xiangmu.repo;

import com.xiangmu.domain.Student;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface StudentRepo extends JpaRepository<Student, String> {
    List<Student> findByClassIdOrderByNo(String classId);
    Student findByNo(String no);
}
