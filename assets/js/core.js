/* =========================================================
   课程知识点智能测评与学习诊断智能体 — 核心逻辑
   纯前端原型（无构建、无第三方依赖）
   ========================================================= */

/* ---------------- 图标 ---------------- */
var ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  layers: '<path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5"/><path d="M22 10v6"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  check2: '<polyline points="20 6 9 17 4 12"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  menu: '<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  spark: '<path d="M12 2l1.9 5.7L20 9.5l-5 3.9 1.7 6.1L12 15.8 7.3 19.5 9 13.4 4 9.5l6.1-1.8L12 2z"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
  arrowRight: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  bookOpen: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'
};

function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
}

/* ---------------- 基础工具 ---------------- */
function $(sel, root) { return (root || document).querySelector(sel); }
function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日';
}
function fmtDT(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function fmtFull(iso) {
  if (!iso) return '—';
  var d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function localInput(d) {
  var x = new Date(d);
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate()) + 'T' + pad2(x.getHours()) + ':' + pad2(x.getMinutes());
}
function todayLabel() {
  var d = new Date();
  var w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + w;
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function hashStr(s) {
  var h = 0;
  for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return Math.abs(h);
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
function downloadText(filename, text, mime) {
  var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
}
function downloadCSV(filename, rows) {
  var text = rows.map(function (r) {
    return r.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',');
  }).join('\r\n');
  downloadText(filename, '\ufeff' + text);
}

/* ---------------- 数据存取 ---------------- */
var DB = null;
var user = null;

/* 数据统一来自服务端 /api/bootstrap；浏览器不再保存业务数据快照。 */
function loadDB() { /* 兼容旧调用，实际由启动流程注入 */ }
function saveDB() { /* 兼容旧调用，服务端写入接口负责持久化 */ }
function readUser() { return user; }

/* ---------------- 常量 ---------------- */
var ROLE_PREFIX = { course_leader: 'cl', teacher: 't', student: 's' };
var ROLE_LABEL = { course_leader: '课程负责人', teacher: '教师', student: '学生' };
var ROLE_CHIP = { course_leader: '', teacher: 'teacher', student: 'student' };
var ROLE_HOME = { course_leader: 'cl/dashboard', teacher: 't/dashboard', student: 's/tests' };

var NAV = {
  course_leader: [
    { group: '概览', items: [{ key: 'cl/dashboard', label: '工作台', icon: 'grid' }] },
    { group: '教学资源', items: [
      { key: 'cl/courses', label: '课程管理', icon: 'book' },
      { key: 'cl/kps', label: '知识点管理', icon: 'layers' },
      { key: 'cl/questions', label: '题库管理', icon: 'database' },
      { key: 'cl/teachers', label: '教师管理', icon: 'users' }
    ] },
    { group: '测评与数据', items: [
      { key: 'cl/classes', label: '教学班总览', icon: 'school' },
      { key: 'cl/papers', label: '试卷中心', icon: 'file' },
      { key: 'cl/stats', label: '课程统计', icon: 'chart' },
      { key: 'cl/export', label: '导出中心', icon: 'download' }
    ] },
    { group: '系统', items: [{ key: 'cl/logs', label: '审计日志', icon: 'shield' }] }
  ],
  teacher: [
    { group: '概览', items: [{ key: 't/dashboard', label: '工作台', icon: 'grid' }] },
    { group: '教学管理', items: [
      { key: 't/students', label: '学生管理', icon: 'users' },
      { key: 't/create', label: '创建测试', icon: 'plus' },
      { key: 't/papers', label: '我的试卷', icon: 'file' }
    ] },
    { group: '数据分析', items: [
      { key: 't/progress', label: '测试进度', icon: 'clipboard' },
      { key: 't/stats', label: '班级统计', icon: 'chart' },
      { key: 't/reports', label: '学生报告', icon: 'spark' }
    ] },
    { group: '其他', items: [{ key: 't/export', label: '导出中心', icon: 'download' }] }
  ],
  student: [
    { group: '测评', items: [
      { key: 's/tests', label: '我的测试', icon: 'clipboard' },
      { key: 's/history', label: '历史记录', icon: 'clock' }
    ] }
  ]
};

var ROUTES = {};

/* ---------------- 数据查询辅助 ---------------- */
function KPBY(id) { return DB.kps.filter(function (k) { return k.id === id; })[0] || { id: id, name: '—' }; }
function QBY(id) { return DB.questions.filter(function (q) { return q.id === id; })[0]; }
function PAPER(id) { return DB.papers.filter(function (p) { return p.id === id; })[0]; }
function STUDENT(id) { return DB.students.filter(function (s) { return s.id === id; })[0]; }
function paperTotal(p) { return p.items.reduce(function (a, it) { return a + it.score; }, 0); }
function paperQuestions(p) {
  return p.items.map(function (it) {
    var q = QBY(it.qid);
    return Object.assign({}, q, { score: it.score, qid: it.qid });
  });
}
function paperStatus(p) {
  if (p.status === 'draft') return { key: 'draft', label: '草稿', cls: 'gray' };
  if (p.status === 'archived') return { key: 'archived', label: '已归档', cls: 'gray' };
  var now = window.serverNowMs ? window.serverNowMs() : Date.now(), s = new Date(p.startAt).getTime(), e = new Date(p.endAt).getTime();
  if (now < s) return { key: 'upcoming', label: '未开始', cls: 'blue' };
  if (now > e) return { key: 'ended', label: '已结束', cls: 'gray' };
  return { key: 'ongoing', label: '进行中', cls: 'green' };
}
function attemptOf(paperId, sid) {
  return DB.attempts.filter(function (a) {
    return a.paperId === paperId && a.studentId === (sid || user.id) && a.status !== 'in_progress';
  }).sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); })[0];
}
function attemptsOf(sid) {
  return DB.attempts.filter(function (a) { return a.studentId === (sid || user.id) && a.status !== 'in_progress'; })
    .sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); });
}
function myPapers() { return DB.papers.filter(function (p) { return p.teacherId === user.id; }); }
function myOngoingTests() {
  return DB.papers.filter(function (p) {
    return p.classIds.indexOf(user.classId || 'c1') > -1 && paperStatus(p).key === 'ongoing' && !attemptOf(p.id);
  });
}

/* ---------------- 统计与诊断 ---------------- */
function attemptIsCorrect(attempt, qid) {
  if (attempt && attempt.correct && Object.prototype.hasOwnProperty.call(attempt.correct, qid)) {
    return !!attempt.correct[qid];
  }
  var q = QBY(qid);
  return !!q && attempt.answers[qid] === q.answer;
}
function kpStatsOf(attempt) {
  var p = PAPER(attempt.paperId);
  if (!p) return [];
  var map = {};
  var order = [];
  p.items.forEach(function (it) {
    var q = QBY(it.qid);
    if (!q) return;
    if (!map[q.kpId]) {
      map[q.kpId] = { id: q.kpId, name: KPBY(q.kpId).name, count: 0, right: 0, total: 0, got: 0 };
      order.push(q.kpId);
    }
    var r = map[q.kpId];
    r.count += 1;
    r.total += it.score;
    if (attemptIsCorrect(attempt, q.id)) { r.got += it.score; r.right += 1; }
  });
  return order.map(function (id) {
    var r = map[id];
    r.rate = pct(r.got, r.total);
    return r;
  });
}
function levelOf(rate) {
  if (rate >= 85) return { label: '表现较好', cls: 'green', advice: '保持当前节奏，可尝试更高难度的综合题。' };
  if (rate >= 70) return { label: '基本掌握', cls: 'blue', advice: '整体掌握良好，建议重点复盘错题和易混点。' };
  if (rate >= 60) return { label: '掌握不稳定', cls: 'amber', advice: '建议重新学习核心概念，再进行针对性练习。' };
  return { label: '需要重点加强', cls: 'red', advice: '建议从基础概念与例题开始，分阶段巩固。' };
}
function answerText(q, val, short) {
  if (!val) return '未作答';
  if (q.type === 'judge') return val === 'T' ? '正确' : '错误';
  if (short) return val.split('').join('');
  return val.split('').map(function (k) {
    var o = (q.options || []).filter(function (x) { return x.key === k; })[0];
    return o ? (k + '．' + o.text) : k;
  }).join('；');
}
function wrongAnswerFor(q) {
  if (q.type === 'judge') return q.answer === 'T' ? 'F' : 'T';
  if (q.type === 'multi') return q.answer === 'A' ? 'B' : 'A';
  var keys = (q.options || []).map(function (o) { return o.key; });
  return keys.filter(function (k) { return k !== q.answer; })[0] || 'B';
}
function buildReport(attempt) {
  var p = PAPER(attempt.paperId);
  var kps = kpStatsOf(attempt);
  var total = attempt.total || paperTotal(p);
  var overall = pct(attempt.score, total);
  var level = levelOf(overall);
  var sorted = kps.slice().sort(function (a, b) { return a.rate - b.rate; });
  var weak = sorted.filter(function (k) { return k.rate < 70; });
  var strong = kps.slice().sort(function (a, b) { return b.rate - a.rate; }).filter(function (k) { return k.rate >= 70; })[0];
  var lowSample = kps.some(function (k) { return k.count <= 1; }) || p.items.length < 5;

  var summary = '本次「' + p.name + '」共 ' + p.items.length + ' 道题，满分 ' + total + ' 分，你的得分是 ' +
    attempt.score + ' 分，正确率 ' + overall + '%。';
  if (strong) summary += '在已测试题目中，「' + strong.name + '」表现相对较好（' + strong.rate + '%）';
  if (weak.length) {
    summary += (strong ? '；' : '在已测试题目中，') + '「' + weak.slice(0, 2).map(function (k) { return k.name; }).join('」「') +
      '」还有提升空间（' + weak.slice(0, 2).map(function (k) { return k.rate + '%'; }).join('、') + '）。';
  } else {
    summary += '各知识点表现较为均衡，可以继续通过综合题巩固。';
  }

  var suggestions = [];
  if (weak[0]) {
    suggestions.push({
      title: '优先复习「' + weak[0].name + '」',
      text: '本次该知识点正确 ' + weak[0].right + '/' + weak[0].count + ' 题，得分率 ' + weak[0].rate +
        '%。建议先回看概念与课堂例题，再完成 5~8 道同知识点基础题，重点记录每道错题的错因。'
    });
  }
  if (weak[1]) {
    suggestions.push({
      title: '安排「' + weak[1].name + '」的专项练习',
      text: '该知识点得分率 ' + weak[1].rate + '%，建议结合错题回顾相关概念，并用"先做后讲"的方式检验是否真正理解。'
    });
  }
  var multiWrong = p.items.filter(function (it) {
    var q = QBY(it.qid);
    return q && q.type === 'multi' && !attemptIsCorrect(attempt, q.id);
  }).length;
  if (multiWrong > 0) {
    suggestions.push({
      title: '多选题注意完整性与准确性',
      text: '本次有 ' + multiWrong + ' 道多选题未完全答对。多选题需要"选全且不选错"，建议逐项判断每个选项，不要凭印象排除。'
    });
  }
  if (suggestions.length < 3) {
    suggestions.push({
      title: '建立"概念—例题—变式"的复习节奏',
      text: '先用自己的话复述核心概念，再对照例题梳理解题步骤，最后完成 2~3 道变式题。每完成一组，记录仍然模糊的点。'
    });
  }

  var prev = DB.attempts.filter(function (a) {
    return a.studentId === attempt.studentId && a.id !== attempt.id &&
      new Date(a.submittedAt) < new Date(attempt.submittedAt);
  }).sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); })[0];
  var trend = null;
  if (prev) {
    var pp = PAPER(prev.paperId);
    trend = {
      prevScore: prev.score, prevTotal: prev.total || (pp ? paperTotal(pp) : 100),
      prevRate: pct(prev.score, prev.total || (pp ? paperTotal(pp) : 100)),
      prevName: pp ? pp.name : '上次测评',
      delta: overall - pct(prev.score, prev.total || (pp ? paperTotal(pp) : 100))
    };
  }
  return {
    overall: overall, level: level, kps: kps, weak: weak, strong: strong,
    summary: summary, suggestions: suggestions.slice(0, 3),
    lowSample: lowSample, trend: trend, total: total
  };
}
function pseudoAttempt(student, paperId, target) {
  var p = PAPER(paperId);
  var answers = {}, got = 0, correct = 0;
  p.items.forEach(function (it) {
    var q = QBY(it.qid);
    if (got + it.score <= target) { answers[q.id] = q.answer; got += it.score; correct += 1; }
    else { answers[q.id] = wrongAnswerFor(q); }
  });
  return {
    id: 'x_' + student.id + '_' + paperId, paperId: paperId, studentId: student.id,
    answers: answers, score: got, total: paperTotal(p), correctCount: correct,
    submittedAt: new Date(Date.now() - (hashStr(student.id) % 20 + 1) * 60000).toISOString(),
    timeUsed: Math.round(p.duration * 0.65), pseudo: true
  };
}
function perfFor(p) {
  var classInfo = DB.classes.filter(function (c) { return c.id === p.classIds[0]; })[0] || { count: 40 };
  var expected = classInfo.count || DB.students.length;
  var rows = DB.students.map(function (s) {
    var att = DB.attempts.filter(function (a) {
      return a.paperId === p.id && a.studentId === s.id && a.status !== 'in_progress';
    }).sort(function (a, b) { return new Date(b.submittedAt) - new Date(a.submittedAt); })[0];
    return {
      student: s,
      score: att ? att.score : null,
      submittedAt: att ? att.submittedAt : null
    };
  });
  var completed = rows.filter(function (r) { return r.score != null; }).length;
  var scores = rows.filter(function (r) { return r.score != null; }).map(function (r) { return r.score; });
  var total = paperTotal(p);
  var avg = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length * 10) / 10 : 0;
  var buckets = [
    { label: '90-100', min: 90, max: 101, count: 0 },
    { label: '80-89', min: 80, max: 90, count: 0 },
    { label: '70-79', min: 70, max: 80, count: 0 },
    { label: '60-69', min: 60, max: 70, count: 0 },
    { label: '60 以下', min: 0, max: 60, count: 0 }
  ];
  scores.forEach(function (s) {
    var b = buckets.filter(function (x) { return s >= x.min && s < x.max; })[0];
    if (b) b.count += 1;
  });
  return {
    rows: rows, expected: expected, completed: completed, scores: scores, total: total,
    avg: avg, max: scores.length ? Math.max.apply(null, scores) : 0,
    min: scores.length ? Math.min.apply(null, scores) : 0, buckets: buckets
  };
}

/* ---------------- 日志 / 导出 ---------------- */
function logAction(action, detail) {
  if (window.API) API.audit(action, detail).catch(function () {});
}

/* ---------------- 框架渲染 ---------------- */
function parseRoute() {
  var raw = (location.hash || '').replace(/^#\/?/, '');
  var parts = raw.split('/').filter(Boolean);
  return { prefix: parts[0] || '', page: parts[1] || '', param: parts[2] || '', key: (parts[0] || '') + '/' + (parts[1] || '') };
}
function go(key) { location.hash = '#/' + key; }
function renderSidebar(activeKey) {
  var groups = NAV[user.role] || [];
  var html = '<div class="side-brand"><div class="brand-mark">智</div><div><b>智学测评</b><small>知识点 · 诊断 · 改进</small></div></div><nav class="nav">';
  groups.forEach(function (g) {
    html += '<div class="nav-group"><div class="nav-label">' + g.group + '</div>';
    g.items.forEach(function (it) {
      var badge = '';
      if (it.key === 's/tests') {
        var c = myOngoingTests().length;
        if (c) badge = '<span class="nav-badge">' + c + '</span>';
      }
      html += '<a class="nav-item ' + (it.key === activeKey ? 'active' : '') + '" href="#/' + it.key + '">' +
        icon(it.icon) + '<span>' + it.label + '</span>' + badge + '</a>';
    });
    html += '</div>';
  });
  html += '</nav><div class="side-user"><div class="avatar">' + esc(user.name.slice(-2)) + '</div><div><b>' + esc(user.name) + '</b><small>' + ROLE_LABEL[user.role] + '</small></div>' +
    '<button class="logout-btn" data-act="logout" title="退出登录">' + icon('logout') + '</button></div>';
  $('#sidebar').innerHTML = html;
}
function renderTopbar(activeKey) {
  var label = '工作台';
  (NAV[user.role] || []).forEach(function (g) {
    g.items.forEach(function (it) { if (it.key === activeKey) label = it.label; });
  });
  var groupName = '';
  (NAV[user.role] || []).forEach(function (g) {
    if (g.items.some(function (it) { return it.key === activeKey; })) groupName = g.group;
  });
  $('#topbar').innerHTML =
    '<button class="menu-btn" data-act="toggleSidebar">' + icon('menu') + '</button>' +
    '<div class="crumb"><span>' + (groupName || '工作台') + '</span><span class="sep">/</span><b>' + label + '</b></div>' +
    '<div class="topbar-right"><span class="today">' + todayLabel() + '</span>' +
    '<span class="role-chip ' + ROLE_CHIP[user.role] + '">' + ROLE_LABEL[user.role] + '</span>' +
    '<div class="top-avatar"><div class="avatar">' + esc(user.name.slice(-2)) + '</div><b>' + esc(user.name) + '</b></div></div>';
}
function render() {
  stopExamTimer();
  S.exam = null;
  var r = parseRoute();
  var prefix = ROLE_PREFIX[user.role];
  var home = ROLE_HOME[user.role] || 'cl/dashboard';
  if (!r.prefix || r.prefix !== prefix) { location.hash = '#/' + home; return; }
  var fn = ROUTES[r.key];
  if (!fn) { location.hash = '#/' + home; return; }
  var shell = $('#shell');
  shell.classList.toggle('focus', r.key === 's/exam');
  $('#content').innerHTML = fn(r.param);
  renderSidebar(r.key);
  renderTopbar(r.key);
  document.title = '工作台 · 智学测评';
  window.scrollTo(0, 0);
  requestAnimationFrame(function () { window.scrollTo(0, 0); });
  setTimeout(function () { window.scrollTo(0, 0); }, 60);
  if (S.exam) { paintExam(); startExamTimer(); }
}

/* ---------------- 通用 UI ---------------- */
function pageHead(title, sub, actions) {
  return '<div class="page-head"><div><h1>' + title + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
    (actions ? '<div class="page-actions">' + actions + '</div>' : '') + '</div>';
}
function statCard(label, value, iconName, cls, foot) {
  return '<div class="stat ' + (cls || '') + '"><div class="stat-ico">' + icon(iconName) + '</div>' +
    '<div class="label">' + label + '</div><div class="value">' + value + '</div>' +
    (foot ? '<div class="trend">' + foot + '</div>' : '') + '</div>';
}
function tag(text, cls) { return '<span class="tag ' + (cls || '') + '">' + text + '</span>'; }
function statusTag(p) {
  var st = paperStatus(p);
  return '<span class="tag ' + st.cls + ' dot">' + st.label + '</span>';
}
function donutHTML(v, label, cls) {
  return '<div class="donut ' + (cls || '') + '" style="--v:' + v + '"><div><b>' + v + '%</b><small>' + label + '</small></div></div>';
}
function barsHTML(items) {
  return '<div class="bar-list">' + items.map(function (it) {
    var rate = it.rate == null ? it.avg : it.rate;
    var color = rate >= 85 ? 'green' : rate >= 70 ? '' : rate >= 60 ? 'amber' : 'red';
    return '<div class="bar-item"><div class="bar-top"><b>' + esc(it.name) + '</b><span>' + rate + '%</span></div>' +
      '<div class="progress ' + color + '"><i style="width:' + clamp(rate, 0, 100) + '%"></i></div></div>';
  }).join('') + '</div>';
}
function emptyHTML(title, text, iconName) {
  return '<div class="empty"><div class="e-ico">' + icon(iconName || 'file') + '</div><b>' + title + '</b><p>' + (text || '') + '</p></div>';
}
function showModal(html, cls) {
  $('#overlay').innerHTML = '<div class="modal ' + (cls || '') + '">' + html + '</div>';
  $('#overlay').classList.add('open');
  document.body.classList.add('modal-open');
}
function closeModal() {
  $('#overlay').classList.remove('open');
  $('#overlay').innerHTML = '';
  document.body.classList.remove('modal-open');
  S.importKind = null;
}
function modalHead(title, sub) {
  return '<div class="modal-head"><div><h3>' + title + '</h3>' + (sub ? '<div class="sub">' + sub + '</div>' : '') +
    '</div><button class="x" data-act="closeModal">' + icon('x') + '</button></div>';
}
function toast(msg, type) {
  var el = document.createElement('div');
  el.className = 'toast ' + (type || 'ok');
  el.innerHTML = icon(type === 'err' ? 'alert' : 'check2') + '<span>' + esc(msg) + '</span>';
  $('#toast').appendChild(el);
  setTimeout(function () { el.remove(); }, 2800);
}
function refreshQTable() {
  var wrap = $('#qTableWrap');
  if (wrap) wrap.innerHTML = questionTableHTML();
}
function refreshStuTable() {
  var wrap = $('#stuTableWrap');
  if (wrap) wrap.innerHTML = studentTableHTML();
}

var S = {
  q: { kp: '', type: '', kw: '', page: 1 },
  stu: { kw: '', page: 1 },
  statPaper: 'p1',
  progressPaper: 'p1',
  paperFilter: 'all',
  wizard: null,
  exam: null,
  timer: null,
  importKind: null
};
