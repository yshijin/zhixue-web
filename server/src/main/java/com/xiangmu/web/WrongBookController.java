package com.xiangmu.web;

import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.WrongBookService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/wrongbook")
public class WrongBookController {
    private final WrongBookService service;

    public WrongBookController(WrongBookService service) {
        this.service = service;
    }

    @PostMapping("/tests")
    public Map<String, Object> create(@AuthenticationPrincipal AppPrincipal p,
                                      @RequestBody(required = false) WrongBookService.CreateWrongTestRequest body) {
        return service.create(p, body);
    }

    @DeleteMapping("/tests/{id}")
    public Map<String, Object> delete(@AuthenticationPrincipal AppPrincipal p, @PathVariable String id) {
        return service.delete(p, id);
    }
}
