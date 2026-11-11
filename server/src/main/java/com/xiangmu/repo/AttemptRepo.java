package com.xiangmu.repo;

import com.xiangmu.domain.Attempt;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AttemptRepo extends JpaRepository<Attempt, String> {
    Optional<Attempt> findByPaperIdAndStudentId(String paperId, String studentId);
    List<Attempt> findByPaperId(String paperId);
    List<Attempt> findByStudentIdOrderBySubmittedAtDesc(String studentId);
    List<Attempt> findByPaperIdAndStatus(String paperId, String status);
    long countByPaperIdAndStatus(String paperId, String status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Attempt a where a.id = :id")
    Optional<Attempt> findForUpdate(@Param("id") String id);
}
