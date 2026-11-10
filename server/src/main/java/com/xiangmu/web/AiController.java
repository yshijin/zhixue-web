package com.xiangmu.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.xiangmu.domain.Attempt;
import com.xiangmu.domain.KnowledgePoint;
import com.xiangmu.domain.Paper;
import com.xiangmu.domain.Question;
import com.xiangmu.repo.AttemptRepo;
import com.xiangmu.repo.KnowledgePointRepo;
import com.xiangmu.repo.PaperRepo;
import com.xiangmu.repo.QuestionRepo;
import com.xiangmu.security.AppPrincipal;
import com.xiangmu.service.AiService;
import com.xiangmu.service.ApiMapper;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/ai")
public class AiController {
    private final AiService ai;
    private final AttemptRepo attempts;
    private final PaperRepo papers;
    private final QuestionRepo questions;
    private final KnowledgePointRepo kps;
    private final ApiMapper mapper;

    public AiController(AiService ai, AttemptRepo attempts, PaperRepo papers,
                        QuestionRepo questions, KnowledgePointRepo kps, ApiMapper mapper) {
        this.ai = ai;
        this.attempts = attempts;
        this.papers = papers;
        this.questions = questions;
        this.kps = kps;
        this.mapper = mapper;
    }

    public record DiagnoseRequest(String attemptId) {}

    @GetMapping("/status")
    public Map<String, Object> status() {
        return ai.status();
    }

    @PostMapping("/diagnose")
    public Map<String, Object> diagnose(@AuthenticationPrincipal AppPrincipal p, @RequestBody DiagnoseRequest body) {
        if (body == null || body.attemptId() == null || body.attemptId().isBlank()) {
            throw ApiException.bad("缺少作答记录编号");
        }
        Attempt attempt = attempts.findById(body.attemptId())
                .orElseThrow(() -> ApiException.notFound("作答记录不存在"));
        Paper paper = papers.findById(attempt.paperId)
                .orElseThrow(() -> ApiException.notFound("试卷不存在"));
        if ("student".equals(p.role) && !p.id.equals(attempt.studentId)) {
            throw ApiException.forbidden("不能查看他人的作答");
        }
        if ("teacher".equals(p.role) && !p.id.equals(paper.teacherId)) {
            throw ApiException.forbidden("不能查看其他教师试卷的作答");
        }
        if (!"student".equals(p.role) && !"teacher".equals(p.role) && !"course_leader".equals(p.role)) {
            throw ApiException.forbidden("无权查看");
        }
        if (!"submitted".equals(attempt.status)) throw ApiException.conflict("作答尚未提交");
        if (!ai.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE,
                    "当前模型未就绪：请课程负责人在「模型设置」中选择供应商并填写 API Key；本地规则诊断仍可正常使用");
        }
        Map<String, Question> qmap = new HashMap<>();
        questions.findAll().forEach(q -> qmap.put(q.id, q));
        Map<String, String> kpNames = new HashMap<>();
        for (KnowledgePoint k : kps.findAll()) kpNames.put(k.id, k.name);
        Map<String, String> answers = mapper.read(attempt.answersJson,
                new TypeReference<Map<String, String>>() {}, Map.of());

        StringBuilder context = new StringBuilder();
        context.append("试卷：").append(paper.name).append("\n")
                .append("得分：").append(attempt.score).append("/").append(attempt.total)
                .append("，正确题数：").append(attempt.correctCount)
                .append("，用时：").append(attempt.timeUsed).append(" 分钟\n")
                .append("知识点与逐题结果：\n");
        int wrong = 0;
        for (Map<String, Object> item : mapper.read(paper.itemsJson,
                new TypeReference<List<Map<String, Object>>>() {}, List.of())) {
            String qid = String.valueOf(item.get("qid"));
            Question q = qmap.get(qid);
            if (q == null) continue;
            String mine = answers.getOrDefault(qid, "");
            boolean ok = normalize(mine, q.type).equals(normalize(q.answer, q.type));
            context.append("- [").append(kpNames.getOrDefault(q.kpId, q.kpId)).append("] ")
                    .append(q.stem).append("；你的答案：").append(mine.isBlank() ? "未作答" : mine)
                    .append("；标准答案：").append(q.answer)
                    .append("；").append(ok ? "正确" : "错误").append("\n");
            if (!ok) wrong++;
        }
        if (wrong == 0) context.append("本次全部答对，请给出保持与拓展建议。\n");
        else context.append("本次共有 ").append(wrong).append(" 道错题，请重点解释错因并给出可执行的复习建议。\n");

        try {
            String text = ai.diagnose(context.toString());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("source", "cloud");
            out.put("model", ai.status().get("model"));
            out.put("attemptId", attempt.id);
            out.put("text", text);
            return out;
        } catch (IllegalStateException e) {
            throw new ApiException(HttpStatus.BAD_GATEWAY, e.getMessage());
        }
    }

    private String normalize(String value, String type) {
        if (value == null) return "";
        String s = value.trim().toUpperCase(Locale.ROOT);
        if ("multi".equals(type)) {
            char[] chars = s.replaceAll("[^A-F]", "").toCharArray();
            Arrays.sort(chars);
            return new String(chars);
        }
        if ("judge".equals(type)) {
            if (s.equals("TRUE") || s.equals("正确")) return "T";
            if (s.equals("FALSE") || s.equals("错误")) return "F";
        }
        return s;
    }
}
