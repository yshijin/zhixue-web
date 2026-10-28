package com.xiangmu.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<?> handle(ApiException e) {
        return ResponseEntity.status(e.status).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<?> handleOther(Exception e) {
        e.printStackTrace();
        return ResponseEntity.internalServerError().body(Map.of("message", "服务器处理失败，请稍后重试"));
    }
}
