/* =========================================================
   路由表、交互动作与启动
   ========================================================= */

ROUTES = {
  'cl/dashboard': viewCLDashboard,
  'cl/courses': viewCLCourses,
  'cl/kps': viewCLKps,
  'cl/questions': viewCLQuestions,
  'cl/teachers': viewCLTeachers,
  'cl/classes': viewCLClasses,
  'cl/papers': viewCLPapers,
  'cl/stats': viewCLStats,
  'cl/export': viewCLExport,
  'cl/logs': viewCLLogs,
  't/dashboard': viewTDashboard,
  't/students': viewTStudents,
  't/create': viewTCreate,
  't/papers': viewTPapers,
  't/progress': viewTProgress,
  't/stats': viewTStats,
  't/reports': viewTReports,
  't/export': viewTExport,
  's/tests': viewSTests,
  's/exam': viewExam,
  's/result': viewSResult,
  's/report': viewSReport,
  's/history': viewSHistory
};

/* ---------------- 组卷 ---------------- */
function shuffleArr(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function syncWizardFromDOM() {
  var w = S.wizard;
  if (!w) return;
  $$('[data-wiz]').forEach(function (el) {
    var key = el.dataset.wiz;
    if (key === 'class') return;
    if (key === 'count' || key === 'score') {
      w[key + 's'][el.dataset.type] = Math.max(0, parseInt(el.value, 10) || 0);
    } else if (key === 'duration' || key === 'attempts') {
      w[key] = Math.max(1, parseInt(el.value, 10) || 1);
    } else if (key === 'shuffle') {
      w.shuffle = el.value === '1';
    } else {
      w[key] = el.value;
    }
  });
  var classEls = $$('[data-wiz="class"]');
  if (classEls.length) {
    w.classIds = classEls.filter(function (el) { return el.checked; }).map(function (el) { return el.value; });
  }
}
function buildWizardPaper() {
  var w = S.wizard;
  if (!w.kpIds.length) { w.error = '请至少选择 1 个知识点。'; return false; }
  var types = ['single', 'multi', 'judge'];
  var picks = [];
  var deficits = [];
  types.forEach(function (type) {
    var need = w.counts[type] || 0;
    if (!need) return;
    var kps = w.kpIds;
    var base = Math.floor(need / kps.length);
    var rem = need % kps.length;
    kps.forEach(function (kpId, i) {
      var quota = base + (i < rem ? 1 : 0);
      if (!quota) return;
      var avail = DB.questions.filter(function (q) {
        return q.kpId === kpId && q.type === type && q.status === 'enabled';
      });
      if (avail.length < quota) {
        deficits.push({
          kp: KPBY(kpId).name,
          type: TYPE_LABEL[type],
          need: quota,
          avail: avail.length
        });
        return;
      }
      shuffleArr(avail).slice(0, quota).forEach(function (q) {
        picks.push({ qid: q.id, score: w.scores[type] || 5 });
      });
    });
  });
  if (deficits.length) {
    w.error = '题库数量不足，无法生成完整试卷：<br>' + deficits.map(function (d) {
      return '· 知识点「' + esc(d.kp) + '」' + d.type + '需要 ' + d.need + ' 题，可用 ' + d.avail + ' 题，缺 ' + (d.need - d.avail) + ' 题';
    }).join('<br>') + '<br>请调整题量、增加知识点或补充题库后再试。';
    w.paper = [];
    return false;
  }
  if (!picks.length) { w.error = '题量不能全部为 0，请至少设置一种题型。'; w.paper = []; return false; }
  var order = { single: 0, multi: 1, judge: 2 };
  picks.sort(function (a, b) {
    var qa = QBY(a.qid), qb = QBY(b.qid);
    return order[qa.type] - order[qb.type];
  });
  w.paper = picks;
  w.error = '';
  return true;
}

/* ---------------- 弹窗：新增 ---------------- */
function openAddKp() {
  showModal(modalHead('新增知识点', '单层平级知识点 · 课程内唯一') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field full"><label>知识点名称<i>*</i></label><input class="input" id="kpName" placeholder="如：Java异常处理"></div>' +
    '<div class="field full"><label>知识点说明</label><textarea class="textarea" id="kpDesc" placeholder="描述学习目标或范围（可选）"></textarea></div>' +
    '<div class="field"><label>知识点编号</label><input class="input" id="kpCode" value="KP' + String(DB.kps.length + 1).padStart(2, '0') + '" readonly></div>' +
    '<div class="field"><label>显示顺序</label><input class="input" value="' + (DB.kps.length + 1) + '" readonly></div>' +
    '<div class="field full"><div class="form-note">停用后不可用于新组卷，历史数据仍会保留。</div></div>' +
    '</div></div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveKp">保存知识点</button></div>');
}
function openAddQuestion() {
  showModal(modalHead('新增题目', '每题至少关联 1 个知识点') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field"><label>题型<i>*</i></label><select class="select" id="fqType" data-qtype>' +
    '<option value="single">单选题</option><option value="multi">多选题</option><option value="judge">判断题</option></select></div>' +
    '<div class="field"><label>关联知识点<i>*</i></label><select class="select" id="fqKp">' +
    DB.kps.map(function (k) { return '<option value="' + k.id + '">' + k.code + ' ' + esc(k.name) + '</option>'; }).join('') +
    '</select></div>' +
    '<div class="field full"><label>题干<i>*</i></label><textarea class="textarea" id="fqStem" placeholder="输入完整题目文本"></textarea></div>' +
    '<div class="field full" id="qOptionsWrap"><label>选项<i>*</i></label>' +
    '<div class="form-grid">' + ['A', 'B', 'C', 'D'].map(function (k) {
      return '<div class="field"><label>' + k + ' 选项</label><input class="input" id="fqOpt' + k + '" placeholder="选项 ' + k + ' 内容"></div>';
    }).join('') + '</div></div>' +
    '<div class="field"><label>标准答案<i>*</i></label><input class="input" id="fqAnswer" placeholder="单选 A / 多选 ABD / 判断 T 或 F"></div>' +
    '<div class="field"><label>难度</label><select class="select" id="fqDiff"><option>易</option><option selected>中</option><option>难</option></select></div>' +
    '<div class="field full"><label>答案解析</label><textarea class="textarea" id="fqAnalysis" placeholder="解释为什么正确，用于学生反馈与 AI 报告"></textarea></div>' +
    '</div></div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveQuestion">保存题目</button></div>', 'wide');
  var sel = $('#fqType');
  if (sel) sel.addEventListener('change', toggleQuestionTypeFields);
}
function toggleQuestionTypeFields() {
  var type = $('#fqType') ? $('#fqType').value : 'single';
  var wrap = $('#qOptionsWrap');
  if (wrap) wrap.style.display = type === 'judge' ? 'none' : '';
  var ans = $('#fqAnswer');
  if (ans) ans.placeholder = type === 'judge' ? 'T（正确）或 F（错误）' : type === 'multi' ? '如 ABD' : '如 A';
}
function openAddTeacher() {
  showModal(modalHead('新增教师', '课程负责人统一创建教师账号') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field"><label>教师工号<i>*</i></label><input class="input" id="ftNo" placeholder="如 T0005"></div>' +
    '<div class="field"><label>教师姓名<i>*</i></label><input class="input" id="ftName" placeholder="真实姓名"></div>' +
    '<div class="field"><label>教学班</label><input class="input" id="ftClass" placeholder="如 软件24203；多个用、分隔"></div>' +
    '<div class="field"><label>手机号</label><input class="input" id="ftPhone" placeholder="选填"></div>' +
    '</div><div class="form-note mt12">初始密码由系统随机生成，首次登录后修改。</div></div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveTeacher">保存</button></div>');
}
function openAddStudent() {
  if (!DB.classes.length) {
    toast(user.role === 'teacher' ? '当前账号尚未绑定教学班，请联系课程负责人' : '请先创建教学班', 'err');
    return;
  }
  var first = DB.classes[0];
  var options = DB.classes.map(function (c) {
    return '<option value="' + c.id + '">' + esc(c.name) + '（' + c.count + ' 人）</option>';
  }).join('');
  showModal(modalHead('添加学生', user.role === 'teacher' ? '仅可添加到本人教学班' : '课程负责人可添加到任意教学班') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field"><label>学号<i>*</i></label><input class="input" id="fsNo" placeholder="如 20260041"></div>' +
    '<div class="field"><label>姓名<i>*</i></label><input class="input" id="fsName" placeholder="学生姓名"></div>' +
    '<div class="field full"><label>教学班<i>*</i></label><select class="select" id="fsClass">' + options + '</select></div>' +
    '<div class="field"><label>专业</label><input class="input" id="fsMajor" value="软件工程"></div>' +
    '<div class="field"><label>行政班</label><input class="input" id="fsAdmin" value="' + esc(first.name) + '"></div>' +
    '</div><div class="form-note mt12">登录账号默认为学号，初始密码首次登录设置。</div></div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveStudent">保存</button></div>');
}
function openAddCourse() {
  showModal(modalHead('新建课程', '课程编码在课程内唯一') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field"><label>课程名称<i>*</i></label><input class="input" id="fcName" placeholder="如：Web应用开发"></div>' +
    '<div class="field"><label>课程编码<i>*</i></label><input class="input" id="fcCode" placeholder="如：CS-WEB-03"></div>' +
    '<div class="field full"><label>学期 / 学年</label><input class="input" id="fcTerm" value="2026-2027 学年第一学期"></div>' +
    '<div class="field full"><label>课程负责人</label><input class="input" value="' + esc(user.name) + '" readonly></div>' +
    '</div></div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveCourse">创建课程</button></div>');
}

/* ---------------- 导入 ---------------- */
var IMPORT_META = {
  kp: {
    title: '批量导入知识点',
    cols: '知识点编号 / 知识点名称 / 显示顺序 / 知识点说明',
    note: '知识点名称必填；编号可留空自动生成；重复名称会提示警告。',
    sample: [['知识点编号', '知识点名称', '显示顺序', '知识点说明'], ['KP01', 'Java概述', '1', 'Java语言特点与JDK/JRE/JVM关系'], ['KP29', '综合实践', '29', '综合案例与项目实践']],
    success: 26, warn: 2, fail: 0,
    lines: [['warn', '第 3 行：知识点名称「变量与类型」与已有「变量与数据类型」相似，请确认'], ['warn', '第 12 行：显示顺序为空，已按导入顺序自动生成'], ['ok', '第 1-26 行：格式校验通过，等待确认入库']]
  },
  question: {
    title: '批量导入题库',
    cols: '题目编号 / 题型 / 知识点编号 / 题干 / 选项 A-F / 标准答案 / 答案解析 / 难度',
    note: '校验题型、答案格式、选项完整性、知识点是否存在、题号是否重复；支持“仅校验不导入”。',
    sample: [['题目编号', '题型', '知识点编号', '题干', '选项A', '选项B', '标准答案', '答案解析'], ['Q0001', '单选题', 'KP01', 'Java 程序入口方法是？', 'main', 'start', 'A', '从 main 方法开始执行'], ['Q0002', '判断题', 'KP01', 'JVM 负责执行字节码。', '', '', 'T', 'JVM 执行编译后的字节码']],
    success: 118, warn: 2, fail: 1,
    lines: [['err', '第 47 行：题型「填空题」不在支持范围内（仅单选 / 多选 / 判断）'], ['warn', '第 82 行：题目编号 Q0031 已存在，默认不覆盖'], ['warn', '第 96 行：未填写答案解析，建议补充'], ['ok', '其余 118 行校验通过，等待确认入库']]
  },
  teacher: {
    title: '批量导入教师',
    cols: '教师工号 / 教师姓名 / 教学班名称 / 手机号 / 邮箱',
    note: '工号与姓名必填；教学班不存在时会自动创建并绑定。教学班已被其他教师占用时会报错，不会静默改绑。',
    sample: [['教师工号', '教师姓名', '教学班名称', '手机号', '邮箱'], ['T0005', '赵敏', '软件24203', '13800000000', ''], ['T0006', '孙杰', '软件24204', '', '']],
    success: 2, warn: 0, fail: 0,
    lines: [['ok', '第 1-2 行：工号与教学班校验通过，等待确认入库']]
  },
  student: {
    title: '批量导入学生',
    cols: '学号 / 姓名 / 教学班 / 专业 / 行政班',
    note: '学号与姓名必填；教学班必须属于当前教师可管理范围。',
    sample: [['学号', '姓名', '教学班', '专业', '行政班'], ['20260041', '周子涵', '软件24201', '软件工程', '软件24201'], ['20260042', '许安然', '软件24201', '软件工程', '软件24201']],
    success: 38, warn: 1, fail: 1,
    lines: [['err', '第 23 行：教学班「软件24999」不存在或不在您的管理范围'], ['warn', '第 31 行：学号 20260015 已存在，已跳过'], ['ok', '其余 38 行校验通过，等待确认入库']]
  }
};
function openImport(kind) {
  S.importKind = kind;
  S.importRows = null;
  S.importChecked = false;
  var m = IMPORT_META[kind];
  if (!m) return;
  showModal(modalHead(m.title, 'CSV 模板 + 服务端预检') +
    '<div class="modal-body"><div class="import-note mb12"><b>模板字段：</b>' + m.cols + '<br>' + m.note + '</div>' +
    '<div class="row mb12"><button class="btn btn-sm" data-act="downloadTemplate" data-kind="' + kind + '">' + icon('download') + '下载 CSV 模板</button>' +
    '<span class="small muted">UTF-8 编码；Excel 请“另存为 CSV UTF-8”后上传</span></div>' +
    '<div class="dropzone" data-act="pickImportFile"><div>' + icon('upload') + '<b>点击选择 CSV 文件</b><small>支持 .csv，单文件不超过 10MB</small></div></div>' +
    '<input type="file" id="importFile" accept=".csv,text/csv" style="display:none">' +
    '<div class="small muted mt8" id="importFileName">尚未选择文件</div>' +
    '<div id="importResult" class="mt16"></div></div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn" data-act="simulateImport">仅校验不导入</button>' +
    '<button class="btn btn-primary" data-act="confirmImport" disabled>确认导入</button></div>', 'wide');
}

function parseCSV(text) {
  text = String(text || '').replace(/^\uFEFF/, '');
  var rows = [], row = [], cur = '', quoted = false;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else { quoted = false; }
      } else { cur += ch; }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cur); cur = '';
    } else if (ch === '\n') {
      row.push(cur); rows.push(row); row = []; cur = '';
    } else if (ch !== '\r') {
      cur += ch;
    }
  }
  row.push(cur);
  rows.push(row);
  return rows.filter(function (r) {
    return r.some(function (c) { return String(c || '').trim() !== ''; });
  });
}

function readImportFile() {
  return new Promise(function (resolve, reject) {
    var input = $('#importFile');
    var file = input && input.files && input.files[0];
    if (!file) { reject(new Error('请先选择 CSV 文件')); return; }
    if (!/\.csv$/i.test(file.name)) { reject(new Error('当前版本支持 CSV；请在 Excel 中另存为 CSV UTF-8 后再上传')); return; }
    if (file.size > 10 * 1024 * 1024) { reject(new Error('文件超过 10MB，请拆分后导入')); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var rows = parseCSV(reader.result);
      if (rows.length < 2) reject(new Error('文件中没有数据行'));
      else resolve(rows);
    };
    reader.onerror = function () { reject(new Error('文件读取失败')); };
    reader.readAsText(file, 'UTF-8');
  });
}

function renderImportResult(res) {
  var box = $('#importResult');
  if (!box) return;
  var errors = res.errors || [];
  var warnings = res.warnings || [];
  var lines = [];
  errors.slice(0, 40).forEach(function (x) { lines.push(['err', x]); });
  warnings.slice(0, 40).forEach(function (x) { lines.push(['warn', x]); });
  if (!lines.length) lines.push(['ok', res.commit ? '数据已写入数据库。' : '格式校验通过，等待确认入库。']);
  if (res.commit) lines.push(['ok', '本次实际入库 ' + res.success + ' 条。']);
  box.innerHTML = '<div class="import-result"><div class="ir-head"><span style="color:var(--green)">' +
    (res.commit ? '已导入' : '可导入') + ' <b>' + res.success + '</b></span>' +
    '<span style="color:var(--amber)">警告 <b>' + warnings.length + '</b></span>' +
    '<span style="color:var(--red)">错误 <b>' + errors.length + '</b></span>' +
    '<span class="right muted">' + (res.commit ? '已入库' : '预检完成 · 尚未入库') + '</span></div><div class="ir-body">' +
    lines.map(function (l) {
      return '<div class="ir-line ' + (l[0] === 'err' ? 'err' : l[0] === 'warn' ? 'warn' : '') + '">' +
        (l[0] === 'err' ? '✕' : l[0] === 'warn' ? '!' : '✓') + '<span>' + esc(l[1]) + '</span></div>';
    }).join('') + '</div></div>';
  $$('[data-act="confirmImport"]').forEach(function (b) { b.disabled = errors.length > 0 || res.success < 1 || res.commit; });
}

async function simulateImport() {
  if (!S.importKind) return;
  try {
    S.importRows = await readImportFile();
    var res = await API.importRows(S.importKind, S.importRows, false);
    S.importChecked = true;
    renderImportResult(res);
  } catch (e) {
    toast(e.message, 'err');
  }
}
function downloadTemplate(kind) {
  var m = IMPORT_META[kind];
  if (!m) return;
  downloadCSV('导入模板_' + kind + '.csv', m.sample);
  toast('模板已下载');
}

/* ---------------- 试卷查看 / 导出 ---------------- */
function openPaper(id) {
  var p = PAPER(id);
  if (!p) return;
  var st = paperStatus(p);
  var total = paperTotal(p);
  showModal(modalHead(p.name, p.teacherName + ' · ' + p.className) +
    '<div class="modal-body"><div class="row wrap mb16">' + statusTag(p) +
    tag(p.items.length + ' 题', 'gray') + tag('满分 ' + total, 'gray') + tag(p.duration + ' 分钟', 'gray') +
    tag({ single: '提交后展示', afterEnd: '截止后展示', never: '不展示' }[p.answerPolicy] || '提交后展示', 'blue') +
    '<span class="small muted right">' + fmtDT(p.startAt) + ' — ' + fmtDT(p.endAt) + '</span></div>' +
    '<div class="alert info mb12">' + icon('info') + '<div>发布后已冻结题目、选项、答案与知识点映射快照。</div></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>#</th><th>题目</th><th>知识点</th><th>题型</th><th>答案</th><th>分值</th></tr></thead><tbody>' +
    p.items.map(function (it, i) {
      var q = QBY(it.qid);
      if (!q) return '';
      return '<tr><td class="muted num">' + (i + 1) + '</td><td style="max-width:460px">' + esc(q.stem) + '</td>' +
        '<td class="muted small">' + esc(KPBY(q.kpId).name) + '</td><td>' + tag(TYPE_LABEL[q.type], TYPE_CLS[q.type]) + '</td>' +
        '<td><b>' + q.answer + '</b></td><td class="num">' + it.score + '</td></tr>';
    }).join('') + '</tbody></table></div></div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button>' +
    '<button class="btn btn-soft" data-act="exportPaper" data-id="' + p.id + '">' + icon('download') + '导出试卷（含答案）</button></div>', 'xwide');
}

function exportPaper(id) {
  var p = PAPER(id);
  if (!p) return;
  var rows = [['题目编号', '题型', '知识点', '题干', '选项', '标准答案', '答案解析', '分值']];
  p.items.forEach(function (it) {
    var q = QBY(it.qid);
    rows.push([
      q.id, TYPE_LABEL[q.type], KPBY(q.kpId).name, q.stem,
      (q.options || []).map(function (o) { return o.key + '.' + o.text; }).join(' / '),
      q.answer, q.analysis || '', it.score
    ]);
  });
  downloadCSV(p.name + '_含答案.csv', rows);
  logAction('导出', '导出试卷「' + p.name + '」（含答案）');
  toast('试卷已导出');
}

/* ---------------- 数据导出 ---------------- */
function handleExport(kind, id) {
  var rows = [], name = '导出数据';
  var date = new Date().toISOString().slice(0, 10);
  if (kind === 'students') {
    name = '学生测试明细';
    var paper = (id && PAPER(id)) || PAPER(S.statPaper) || myPapers()[0] || DB.papers[0];
    if (!paper) { toast('暂无可导出的试卷数据', 'err'); return; }
    var perf = perfFor(paper);
    var classLabel = DB.classes.filter(function (c) { return paper.classIds.indexOf(c.id) > -1; })
      .map(function (c) { return c.name; }).join('、') || '—';
    rows.push(['学号', '姓名', '教学班', '测评', '得分', '满分', '提交时间']);
    perf.rows.forEach(function (r) {
      if (r.score == null) return;
      rows.push([r.student.no, r.student.name, classLabel, paper.name, r.score, perf.total, fmtFull(r.submittedAt)]);
    });
  } else if (kind === 'kps') {
    name = '知识点统计';
    rows.push(['知识点编号', '知识点名称', '平均得分率', '参与人数', '题量']);
    DB.kpAvg.forEach(function (k) { rows.push([k.code, k.name, k.avg + '%', 38, k.count]); });
  } else if (kind === 'classSummary') {
    name = '教学班汇总';
    rows.push(['教学班', '任课教师', '应测人数', '完成人数', '完成率', '平均分', '最高分', '最低分']);
    DB.classSummaries.forEach(function (c) {
      rows.push([c.className, c.teacher, c.expected, c.completed, pct(c.completed, c.expected) + '%', c.avg, c.max, c.min]);
    });
  } else if (kind === 'papers') {
    name = '试卷清单';
    rows.push(['试卷名称', '教师', '教学班', '题量', '满分', '状态', '开放时间']);
    DB.papers.forEach(function (p) {
      rows.push([p.name, p.teacherName, p.className, p.items.length, paperTotal(p), paperStatus(p).label, fmtFull(p.startAt)]);
    });
  } else if (kind === 'questions') {
    name = '题库全量';
    rows.push(['题目编号', '题型', '知识点编号', '知识点', '题干', '选项', '答案', '解析', '难度']);
    DB.questions.forEach(function (q) {
      rows.push([q.id, TYPE_LABEL[q.type], KPBY(q.kpId).code, KPBY(q.kpId).name, q.stem,
        (q.options || []).map(function (o) { return o.key + '.' + o.text; }).join(' / '), q.answer, q.analysis || '', q.difficulty]);
    });
  } else if (kind === 'logs') {
    name = '审计日志';
    rows.push(['时间', '操作人', '角色', '操作', '详情']);
    DB.logs.forEach(function (l) { rows.push([fmtFull(l.time), l.operator, l.role, l.action, l.detail]); });
  } else {
    toast('暂不支持该导出类型', 'err');
    return;
  }
  downloadCSV(name + '_' + date + '.csv', rows);
  logAction('导出', '导出' + name + '（' + (rows.length - 1) + ' 条）');
  toast('已导出：' + name);
  render();
}

/* ---------------- 动作表 ---------------- */
var ACTIONS = {
  noop: function () {},
  resetPwd: function (el) {
    var name = el.dataset.name || '该教师';
    var id = el.dataset.id || '';
    showModal(modalHead('重置登录密码', '服务端账号操作') +
      '<div class="modal-body"><div class="report-text">确认将教师 <b>' + esc(name) + '</b> 的登录密码重置为初始密码 <b>123456</b> 吗？</div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmResetPwd" data-name="' + esc(name) + '" data-id="' + esc(id) + '">确认重置</button></div>');
  },
  confirmResetPwd: async function (el) {
    var name = el.dataset.name || '该教师';
    var id = el.dataset.id;
    if (!id) { toast('缺少教师编号，请刷新页面重试', 'err'); return; }
    try {
      await API.resetTeacherPassword(id);
      await reloadDB();
      closeModal();
      render();
      toast('已重置「' + name + '」的登录密码为 123456');
    } catch (e) { toast(e.message, 'err'); }
  },
  logout: async function () {
    try { await API.logout(); } catch (e) {}
    try { localStorage.removeItem('xiangmu_user'); sessionStorage.removeItem('xiangmu_user'); } catch (e) {}
    location.href = 'index.html';
  },
  toggleSidebar: function () {
    $('#sidebar').classList.toggle('open');
  },
  closeModal: closeModal,
  go: function (el) {
    go(el.dataset.to);
  },
  toggleKp: function (el) {
    var w = S.wizard;
    var id = el.dataset.id;
    var i = w.kpIds.indexOf(id);
    if (i > -1) w.kpIds.splice(i, 1); else w.kpIds.push(id);
    render();
  },
  qPage: function (el) {
    S.q.page = parseInt(el.dataset.page, 10) || 1;
    refreshQTable();
  },
  stuPage: function (el) {
    S.stu.page = parseInt(el.dataset.page, 10) || 1;
    refreshStuTable();
  },
  openAddKp: openAddKp,
  openAddQuestion: openAddQuestion,
  openAddTeacher: openAddTeacher,
  openAddStudent: openAddStudent,
  openAddCourse: openAddCourse,
  openImport: function (el) { openImport(el.dataset.kind); },
  downloadTemplate: function (el) { downloadTemplate(el.dataset.kind); },
  simulateImport: simulateImport,
  confirmImport: async function () {
    if (!S.importKind || !S.importRows || !S.importChecked) { toast('请先选择文件并完成校验', 'err'); return; }
    var btn = $('[data-act="confirmImport"]');
    if (btn) btn.disabled = true;
    try {
      var res = await API.importRows(S.importKind, S.importRows, true);
      renderImportResult(res);
      await reloadDB();
      S.importChecked = false;
      S.importRows = null;
      toast('成功导入 ' + res.success + ' 条数据');
      setTimeout(function () { closeModal(); render(); }, 900);
    } catch (e) {
      if (btn) btn.disabled = false;
      toast(e.message, 'err');
    }
  },
  pickImportFile: function () {
    var f = $('#importFile');
    if (f) f.click();
  },
  saveKp: async function () {
    var name = ($('#kpName') || {}).value;
    if (!name || !name.trim()) { toast('请填写知识点名称', 'err'); return; }
    name = name.trim();
    if (DB.kps.some(function (k) { return k.name === name; })) { toast('知识点名称已存在', 'err'); return; }
    try {
      await API.addKp({ name: name, desc: (($('#kpDesc') || {}).value || '').trim(), courseId: 'c1' });
      await reloadDB();
      closeModal();
      render();
      toast('知识点已新增');
    } catch (e) { toast(e.message, 'err'); }
  },
  saveQuestion: async function () {
    var type = $('#fqType').value;
    var kpId = $('#fqKp').value;
    var stem = ($('#fqStem').value || '').trim();
    var answer = ($('#fqAnswer').value || '').trim().toUpperCase();
    var analysis = ($('#fqAnalysis').value || '').trim();
    var diff = $('#fqDiff').value;
    if (!stem) { toast('请填写题干', 'err'); return; }
    var options = [];
    if (type === 'judge') {
      options = [{ key: 'T', text: '正确' }, { key: 'F', text: '错误' }];
      if (answer !== 'T' && answer !== 'F') { toast('判断题答案请填写 T 或 F', 'err'); return; }
    } else {
      ['A', 'B', 'C', 'D'].forEach(function (k) {
        var v = ($('#fqOpt' + k).value || '').trim();
        if (v) options.push({ key: k, text: v });
      });
      if (options.length < 2) { toast('单选题 / 多选题至少需要 2 个选项', 'err'); return; }
      if (!/^[A-F]+$/.test(answer)) { toast('答案格式不正确，请填写选项字母', 'err'); return; }
      if (type === 'single' && answer.length !== 1) { toast('单选题只能有 1 个正确选项', 'err'); return; }
      if (type === 'multi' && answer.length < 2) { toast('多选题至少需要 2 个正确选项', 'err'); return; }
      var keys = options.map(function (o) { return o.key; });
      if (answer.split('').some(function (k) { return keys.indexOf(k) < 0; })) { toast('答案包含不存在的选项', 'err'); return; }
    }
    try {
      await API.addQuestion({
        kpId: kpId, type: type, stem: stem, options: options, answer: answer,
        analysis: analysis, difficulty: diff, status: 'enabled', real: false
      });
      await reloadDB();
      closeModal();
      render();
      toast('题目已新增');
    } catch (e) { toast(e.message, 'err'); }
  },
  saveTeacher: async function () {
    var no = ($('#ftNo').value || '').trim();
    var name = ($('#ftName').value || '').trim();
    if (!no || !name) { toast('工号和姓名不能为空', 'err'); return; }
    if (DB.teachers.some(function (t) { return t.no === no; })) { toast('教师工号已存在', 'err'); return; }
    try {
      await API.addTeacher({
        no: no, name: name, classes: ($('#ftClass').value || '').trim(),
        phone: ($('#ftPhone').value || '').trim()
      });
      await reloadDB();
      closeModal(); render(); toast('教师已新增（初始密码 123456）');
    } catch (e) { toast(e.message, 'err'); }
  },
  saveStudent: async function () {
    var no = ($('#fsNo').value || '').trim();
    var name = ($('#fsName').value || '').trim();
    var classId = $('#fsClass') ? $('#fsClass').value : '';
    if (!no || !name) { toast('学号和姓名不能为空', 'err'); return; }
    if (!classId) { toast('请选择教学班', 'err'); return; }
    if (DB.students.some(function (s) { return s.no === no; })) { toast('学号已存在', 'err'); return; }
    var cls = DB.classes.filter(function (c) { return c.id === classId; })[0];
    try {
      await API.addStudent({
        no: no, name: name, classId: classId,
        major: ($('#fsMajor').value || '软件工程'), adminClass: ($('#fsAdmin').value || (cls ? cls.name : ''))
      });
      await reloadDB();
      closeModal(); render(); toast('学生已添加（初始密码 123456）');
    } catch (e) { toast(e.message, 'err'); }
  },
  saveCourse: async function () {
    var name = ($('#fcName').value || '').trim();
    var code = ($('#fcCode').value || '').trim();
    if (!name || !code) { toast('课程名称和编码不能为空', 'err'); return; }
    try {
      await API.addCourse({ name: name, code: code, term: ($('#fcTerm').value || '') });
      await reloadDB();
      closeModal(); render(); toast('课程已创建');
    } catch (e) { toast(e.message, 'err'); }
  },
  viewQuestion: function (el) {
    var q = QBY(el.dataset.id);
    if (!q) return;
    showModal(modalHead('题目详情', q.id + ' · ' + KPBY(q.kpId).name) +
      '<div class="modal-body"><div class="row mb12">' + tag(TYPE_LABEL[q.type], TYPE_CLS[q.type]) + tag('难度 ' + q.difficulty, 'gray') + tag('启用', 'green') + '</div>' +
      '<div class="q-stem" style="font-size:15px;margin-bottom:14px">' + esc(q.stem) + '</div>' +
      '<div class="q-options">' + (q.options || []).map(function (o) {
        return '<div class="q-opt static"><span class="key">' + o.key + '</span><span class="txt">' + esc(o.text) + '</span></div>';
      }).join('') + '</div>' +
      '<div class="alert ok mt16">' + icon('check') + '<div><b>标准答案：' + q.answer + '</b><br>解析：' + esc(q.analysis || '暂无解析') + '</div></div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button></div>', 'wide');
  },
  viewStudentReport: function (el) {
    studentReportModal(el.dataset.sid, el.dataset.paper);
  },
  aiDiagnose: async function (el) {
    var id = el.dataset.id;
    if (!id) { toast('缺少作答记录编号', 'err'); return; }
    showModal(modalHead('云端 AI 学习解读', '由服务端调用云端 AI · 结果仅供参考') +
      '<div class="modal-body"><div class="empty" style="padding:24px"><div class="e-ico">' + icon('refresh') + '</div><b>正在生成解读…</b><p>分数与知识点统计仍由服务端规则计算</p></div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button></div>', 'wide');
    try {
      var res = await API.aiDiagnose(id);
      showModal(modalHead('云端 AI 学习解读', '模型：' + (res.model || '云端模型') + ' · 结果仅供参考') +
        '<div class="modal-body"><div class="report-text" style="white-space:normal;line-height:1.9">' +
        esc(res.text || '').replace(/\n/g, '<br>') + '</div>' +
        '<div class="alert info mt16">' + icon('info') + '<div>AI 负责组织语言与建议，分数、正确率、知识点表现均由服务端规则计算，可回溯至作答记录。</div></div></div>' +
        '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button></div>', 'wide');
    } catch (e) {
      showModal(modalHead('云端 AI 学习解读', '调用未完成') +
        '<div class="modal-body"><div class="alert warn">' + icon('alert') + '<div>' + esc(e.message || '云端 AI 暂不可用') + '</div></div>' +
        '<div class="report-text mt12">当前页面中的规则化诊断报告仍然有效，可继续使用知识点得分率、错题复盘和学习建议。</div></div>' +
        '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button></div>', 'wide');
    }
  },
  viewClass: function (el) { classDetailModal(el.dataset.id); },
  viewPaper: function (el) { openPaper(el.dataset.id); },
  exportPaper: function (el) { exportPaper(el.dataset.id); },
  export: function (el) { handleExport(el.dataset.kind, el.dataset.id); },
  printReport: function () { window.print(); },
  remind: function () {
    toast('已向未提交学生发送提醒（演示）');
    logAction('通知', '提醒未提交学生参加测评');
  },
  newWizard: function () {
    initWizard();
    if (parseRoute().key === 't/create') render(); else go('t/create');
  },
  wizNext: function () {
    syncWizardFromDOM();
    var w = S.wizard;
    if (!w.name || !w.name.trim()) { toast('请填写测试名称', 'err'); return; }
    if (!w.classIds.length) { toast('请选择目标教学班', 'err'); return; }
    if (!w.kpIds.length) { toast('请至少选择 1 个知识点', 'err'); return; }
    w.step = 2;
    render();
  },
  wizBack: function () {
    syncWizardFromDOM();
    S.wizard.step = Math.max(1, S.wizard.step - 1);
    render();
  },
  wizGenerate: function () {
    syncWizardFromDOM();
    var w = S.wizard;
    if (!w.start || !w.end || new Date(w.end) <= new Date(w.start)) { toast('截止时间必须晚于开放时间', 'err'); return; }
    if (w.counts.single + w.counts.multi + w.counts.judge <= 0) { toast('题量不能全部为 0', 'err'); return; }
    buildWizardPaper();
    w.step = 3;
    render();
  },
  wizRegenerate: function () {
    buildWizardPaper();
    render();
  },
  wizPublish: async function () {
    var w = S.wizard;
    if (!w.paper || !w.paper.length || w.error) { toast('试卷尚未生成或存在缺口', 'err'); return; }
    var ids = w.classIds;
    var targetClass = DB.classes.filter(function (c) { return ids.indexOf(c.id) > -1; })[0];
    var className = DB.classes.filter(function (c) { return ids.indexOf(c.id) > -1; }).map(function (c) { return c.name; }).join('、');
    var p = {
      name: w.name,
      courseId: targetClass ? targetClass.courseId : (user.courseId || 'c1'),
      classIds: ids.slice(),
      items: w.paper.map(function (it) { return { qid: it.qid, score: it.score }; }),
      startAt: new Date(w.start).toISOString(),
      endAt: new Date(w.end).toISOString(),
      duration: w.duration,
      attemptsAllowed: w.attempts,
      answerPolicy: w.policy,
      shuffle: !!w.shuffle
    };
    try {
      await API.publishPaper(p);
      await reloadDB();
      S.wizard = null;
      go('t/papers');
      toast('试卷已发布至' + className);
    } catch (e) { toast(e.message, 'err'); }
  },
  swapQ: function (el) {
    var w = S.wizard;
    var qid = el.dataset.id;
    var cur = QBY(qid);
    var used = w.paper.map(function (x) { return x.qid; });
    var cands = DB.questions.filter(function (q) {
      return q.kpId === cur.kpId && q.type === cur.type && q.id !== qid && used.indexOf(q.id) < 0;
    });
    if (!cands.length) { toast('该知识点下暂无可替换题目', 'err'); return; }
    var next = cands[Math.floor(Math.random() * cands.length)];
    w.paper = w.paper.map(function (it) {
      return it.qid === qid ? { qid: next.id, score: it.score } : it;
    });
    render();
    toast('已更换题目 ' + qid + ' → ' + next.id);
  },
  endPaper: function (el) {
    var p = PAPER(el.dataset.id);
    if (!p) return;
    showModal(modalHead('结束测评', '结束后学生不可继续作答') +
      '<div class="modal-body"><div class="report-text">确认结束「' + esc(p.name) + '」吗？结束后将停止接收新提交，已提交的作答与统计不受影响。</div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmEnd" data-id="' + p.id + '">确认结束</button></div>');
  },
  confirmEnd: async function (el) {
    var p = PAPER(el.dataset.id);
    if (!p) return;
    try {
      await API.endPaper(p.id);
      await reloadDB();
      closeModal(); render(); toast('测评已结束');
    } catch (e) { toast(e.message, 'err'); }
  },
  setStatsPaper: function (el) {
    S.statPaper = el.dataset.id;
    if (parseRoute().key === 't/stats') render(); else go('t/stats');
  },
  startExam: function (el) {
    go('s/exam/' + el.dataset.id);
  },
  answer: function (el) {
    if (!S.exam) return;
    var q = QBY(S.exam.paper.items[S.exam.idx].qid);
    var key = el.dataset.key;
    var draft = S.exam.draft;
    if (q.type === 'multi') {
      var set = (draft.answers[q.id] || '').split('').filter(Boolean);
      var i = set.indexOf(key);
      if (i > -1) set.splice(i, 1); else set.push(key);
      set.sort();
      draft.answers[q.id] = set.join('');
    } else {
      draft.answers[q.id] = key;
    }
    draft.savedAt = new Date().toISOString();
    paintExam();
    if (S.exam.saveTimer) clearTimeout(S.exam.saveTimer);
    S.exam.saveTimer = setTimeout(saveExamProgress, 350);
  },
  navQ: function (el) {
    if (!S.exam) return;
    S.exam.idx = parseInt(el.dataset.i, 10) || 0;
    paintExam();
  },
  prevQ: function () {
    if (!S.exam) return;
    S.exam.idx = Math.max(0, S.exam.idx - 1);
    paintExam();
  },
  nextQ: function () {
    if (!S.exam) return;
    S.exam.idx = Math.min(S.exam.paper.items.length - 1, S.exam.idx + 1);
    paintExam();
  },
  submitExam: function () {
    if (!S.exam) return;
    var p = S.exam.paper, draft = S.exam.draft;
    var answered = p.items.filter(function (it) {
      return (draft.answers[QBY(it.qid).id] || '') !== '';
    }).length;
    var unanswered = p.items.length - answered;
    showModal(modalHead('确认交卷', '提交后答案将锁定') +
      '<div class="modal-body"><div class="report-text">本次共 <b>' + p.items.length + '</b> 题，已作答 <b>' + answered + '</b> 题' +
      (unanswered ? '，仍有 <b style="color:var(--amber)">' + unanswered + '</b> 题未作答' : '，全部题目已作答') + '。</div>' +
      '<div class="alert warn mt16">' + icon('alert') + '<div>交卷后不可再修改答案；倒计时结束后系统也会自动交卷。</div></div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">继续作答</button>' +
      '<button class="btn btn-primary" data-act="confirmSubmit">确认交卷</button></div>');
  },
  confirmSubmit: function () {
    closeModal();
    finishExam(false);
  },
  exitExam: function () {
    showModal(modalHead('退出作答', '已作答内容会自动暂存') +
      '<div class="modal-body"><div class="report-text">退出后可以重新进入继续作答，但<b>计时不会暂停</b>。确认退出吗？</div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">继续作答</button>' +
      '<button class="btn btn-danger" data-act="confirmExit">确认退出</button></div>');
  },
  confirmExit: async function () {
    closeModal();
    if (S.exam) {
      var e = S.exam;
      if (e.saveTimer) { clearTimeout(e.saveTimer); e.saveTimer = null; }
      try { await API.saveAttempt(e.attemptId, e.draft.answers); } catch (err) {}
    }
    S.exam = null;
    go('s/tests');
  }
};

/* ---------------- 事件绑定 ---------------- */
document.addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var act = el.dataset.act;
  if (act === 'pickImportFile') {
    var inp = document.getElementById('importFile');
    if (inp) inp.click();
    return;
  }
  var fn = ACTIONS[act];
  if (fn) {
    e.preventDefault();
    fn(el, e);
  }
});

document.addEventListener('change', function (e) {
  var el = e.target;
  if (el.id === 'importFile') {
    var nameEl = document.getElementById('importFileName');
    if (nameEl) nameEl.textContent = el.files && el.files[0] ? '已选择：' + el.files[0].name : '尚未选择文件';
    S.importRows = null;
    S.importChecked = false;
    var box = document.getElementById('importResult');
    if (box) box.innerHTML = '';
    var confirm = document.querySelector('[data-act="confirmImport"]');
    if (confirm) confirm.disabled = true;
    return;
  }
  if (el.dataset.filter === 'qkp') {
    S.q.kp = el.value; S.q.page = 1; refreshQTable(); return;
  }
  if (el.dataset.filter === 'qtype') {
    S.q.type = el.value; S.q.page = 1; refreshQTable(); return;
  }
  if (el.dataset.select === 'paperFilter') {
    S.paperFilter = el.value; render(); return;
  }
  if (el.dataset.select === 'statPaper') {
    S.statPaper = el.value; render(); return;
  }
  if (el.dataset.select === 'progressPaper') {
    S.progressPaper = el.value; render(); return;
  }
  if (el.id === 'fqType') { toggleQuestionTypeFields(); return; }
  if (el.dataset.wiz) {
    updateWizardField(el);
  }
});

document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.dataset.input === 'qsearch') {
    S.q.kw = el.value; S.q.page = 1; refreshQTable(); return;
  }
  if (el.dataset.input === 'ssearch') {
    S.stu.kw = el.value; S.stu.page = 1; refreshStuTable(); return;
  }
  if (el.dataset.wiz && el.type !== 'checkbox') {
    updateWizardField(el);
  }
});

function updateWizardField(el) {
  var w = S.wizard;
  if (!w) return;
  var key = el.dataset.wiz;
  if (key === 'class') {
    w.classIds = $$('[data-wiz="class"]').filter(function (x) { return x.checked; }).map(function (x) { return x.value; });
    return;
  }
  if (key === 'count' || key === 'score') {
    w[key + 's'][el.dataset.type] = clamp(parseInt(el.value, 10) || 0, 0, 50);
    return;
  }
  if (key === 'duration') { w.duration = clamp(parseInt(el.value, 10) || 1, 5, 180); return; }
  if (key === 'attempts') { w.attempts = parseInt(el.value, 10) || 1; return; }
  if (key === 'shuffle') { w.shuffle = el.value === '1'; return; }
  w[key] = el.value;
}

$('#overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeModal();
});
window.addEventListener('hashchange', render);
document.addEventListener('click', function (e) {
  if (e.target.closest('.nav-item')) {
    var sb = $('#sidebar');
    if (sb) sb.classList.remove('open');
  }
});

/* ---------------- 启动 ---------------- */
function startAutoRefresh() {
  if (window.__autoRefreshTimer) return;
  window.__autoRefreshTimer = setInterval(async function () {
    if (!DB || !user || document.hidden || S.exam) return;
    if (Date.now() - (window.__lastUserAction || 0) < 10000) return;
    var route = parseRoute();
    if (route.key === 's/exam' || route.key === 't/create') return;
    if (S.wizard) return;
    var overlay = $('#overlay');
    if (overlay && overlay.classList.contains('open')) return;
    var active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
    try {
      var data = await API.bootstrap();
      var y = window.scrollY;
      DB = data;
      user = data.user;
      render();
      requestAnimationFrame(function () { window.scrollTo(0, y); });
    } catch (e) {
      if (e.status === 401) location.replace('index.html');
    }
  }, 30000);
}
document.addEventListener('pointerdown', function () { window.__lastUserAction = Date.now(); }, true);
document.addEventListener('keydown', function () { window.__lastUserAction = Date.now(); }, true);

(async function boot() {
  var content = $('#content');
  if (content) {
    content.innerHTML = '<div class="empty" style="margin-top:12vh"><div class="e-ico">' + icon('refresh') + '</div><b>正在连接教学数据服务…</b><p>首次启动需要初始化数据库，请稍候</p></div>';
  }
  try {
    var data = await API.bootstrap();
    DB = data;
    user = data.user;
    if (!location.hash) location.hash = '#/' + (ROLE_HOME[user.role] || 'cl/dashboard');
    render();
    startAutoRefresh();
  } catch (e) {
    if (e.status === 401) { location.replace('index.html'); return; }
    if (content) {
      content.innerHTML = '<div class="empty" style="margin-top:12vh"><div class="e-ico">' + icon('alert') + '</div><b>无法加载数据</b><p>' + esc(e.message || '请确认后端服务已启动') + '</p><button class="btn btn-primary mt16" onclick="location.reload()">重新连接</button></div>';
    }
  }
})();
