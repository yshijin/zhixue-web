package com.xiangmu.web;

import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.AttemptService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/attempts")
public class AttemptController {
    private final AttemptService service;

    public AttemptController(AttemptService service) {
        this.service = service;
    }

    @PostMapping("/start")
    public Map<String, Object> start(@AuthenticationPrincipal AppPrincipal p, @RequestBody AttemptService.StartRequest body) {
        if (body == null || body.paperId() == null) throw ApiException.bad("缺少试卷编号");
        return service.start(p, body.paperId());
    }

    @PutMapping("/{id}/answers")
    public Map<String, Object> save(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id,
                                    @RequestBody AttemptService.SubmitRequest body) {
        return service.save(p, id, body == null ? Map.of() : body.answers());
    }

    @PostMapping("/{id}/submit")
    public Map<String, Object> submit(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id,
                                      @RequestBody(required = false) AttemptService.SubmitRequest body) {
        return service.submit(p, id, body == null ? null : body.answers());
    }
}
