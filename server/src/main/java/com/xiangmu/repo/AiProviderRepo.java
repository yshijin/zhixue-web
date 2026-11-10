package com.xiangmu.repo;

import com.xiangmu.domain.AiProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AiProviderRepo extends JpaRepository<AiProvider, String> {
    Optional<AiProvider> findFirstByActiveTrue();
}
