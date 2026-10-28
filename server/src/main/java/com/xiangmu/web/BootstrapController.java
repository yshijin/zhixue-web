package com.xiangmu.web;

import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.BootstrapService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class BootstrapController {
    private final BootstrapService bootstrapService;

    public BootstrapController(BootstrapService bootstrapService) {
        this.bootstrapService = bootstrapService;
    }

    @GetMapping("/bootstrap")
    public Map<String, Object> bootstrap(@AuthenticationPrincipal AppPrincipal principal) {
        return bootstrapService.build(principal);
    }
}
