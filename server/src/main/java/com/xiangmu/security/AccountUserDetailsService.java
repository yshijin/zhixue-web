package com.xiangmu.security;

import com.xiangmu.domain.UserAccount;
import com.xiangmu.repo.UserRepo;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

@Service
public class AccountUserDetailsService implements UserDetailsService {
    private final UserRepo users;

    public AccountUserDetailsService(UserRepo users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        UserAccount account = users.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("账号不存在"));
        if (!account.enabled) throw new UsernameNotFoundException("账号已停用");
        return new AppPrincipal(account);
    }
}
