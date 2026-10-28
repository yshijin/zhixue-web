package com.xiangmu.repo;

import com.xiangmu.domain.*;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface UserRepo extends JpaRepository<UserAccount, String> {
    Optional<UserAccount> findByUsername(String username);
    List<UserAccount> findByRole(String role);
}
