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
  'cl/ai': viewCLAi,
  't/dashboard': viewTDashboard,
  't/students': viewTStudents,
  't/create': viewTCreate,
  't/papers': viewTPapers,
  't/progress': viewTProgress,
  't/stats': viewTStats,
  't/reports': viewTReports,
  't/export': viewTExport,
  's/tests': viewSTests,
  's/wrongbook': viewSWrongBook,
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
function openAddTeacherClasses(teacherId) {
  if (!DB.teachers.length) { toast('请先新增教师账号', 'err'); return; }
  var fixed = teacherId ? DB.teachers.filter(function (t) { return t.id === teacherId; })[0] : null;
  if (teacherId && !fixed) { toast('教师不存在或已被删除', 'err'); return; }
  var existing = fixed ? DB.classes.filter(function (c) { return c.teacherId === fixed.id; }) : [];
  var defaultTerm = (DB.courses[0] && DB.courses[0].term) || '2026-2027 学年第一学期';
  var teacherField = fixed
    ? '<div class="field full"><label>任课教师</label><input class="input" value="' + esc(fixed.name) + '（' + esc(fixed.no) + '）" readonly></div>'
    : '<div class="field full"><label>任课教师<i>*</i></label><select class="select" id="ftcTeacher">' +
      DB.teachers.map(function (t) {
        return '<option value="' + esc(t.id) + '">' + esc(t.name) + '（' + esc(t.no) + '）</option>';
      }).join('') + '</select></div>';
  showModal(modalHead(fixed ? '为「' + esc(fixed.name) + '」添加教学班' : '新增教学班', '可一次添加多个教学班') +
    '<div class="modal-body"><div class="form-grid">' + teacherField +
    '<div class="field full"><label>教学班名称<i>*</i></label><textarea class="textarea" id="ftcNames" rows="3" placeholder="如：软件24204&#10;多个班级可用换行、逗号或顿号分隔"></textarea>' +
    (existing.length ? '<div class="form-note mt8">当前已绑定：' + existing.map(function (c) { return esc(c.name); }).join('、') + '</div>' : '') +
    '</div>' +
    '<div class="field"><label>专业</label><input class="input" id="ftcMajor" value="软件工程"></div>' +
    '<div class="field"><label>学期</label><input class="input" id="ftcTerm" value="' + esc(defaultTerm) + '"></div>' +
    '</div><div class="form-note mt12">提交时会一次性校验全部名称；如其中有重名教学班，则本次不会添加任何班级。</div></div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveTeacherClasses" data-id="' + (fixed ? esc(fixed.id) : '') + '">保存</button></div>');
}
function openAddStudent() {
  var classList = user.role === 'teacher' ? teacherOwnClasses() : DB.classes;
  if (!classList.length) {
    toast(user.role === 'teacher' ? '当前账号尚未绑定教学班，请联系课程负责人' : '请先创建教学班', 'err');
    return;
  }
  var currentClassId = user.role === 'teacher' ? teacherCurrentClassId() : '';
  var first = classList.filter(function (c) { return c.id === currentClassId; })[0] || classList[0];
  var options = classList.map(function (c) {
    return '<option value="' + c.id + '" ' + (c.id === first.id ? 'selected' : '') + '>' + esc(c.name) + '（' + c.count + ' 人）</option>';
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

/* ---------------- 弹窗：AI 模型供应商 ---------------- */
var AI_PRESETS = {
  deepseek: { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  openai: { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  qwen: { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  kimi: { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  zhipu: { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  ollama: { name: 'Ollama 本地', baseUrl: 'http://127.0.0.1:11434/v1', model: 'qwen2.5:7b' }
};

function applyAiPreset(key) {
  var p = AI_PRESETS[key];
  if (!p) return;
  if ($('#aiName')) $('#aiName').value = p.name;
  if ($('#aiBaseUrl')) $('#aiBaseUrl').value = p.baseUrl;
  if ($('#aiModel')) $('#aiModel').value = p.model;
}

function openAiProviderModal(id) {
  var p = id ? (DB.aiProviders || []).filter(function (x) { return x.id === id; })[0] : null;
  var editing = !!p;
  var keyNote = editing
    ? (p.hasKey ? '当前已保存密钥：' + esc(p.keyHint || '') + '。留空表示继续使用原密钥。' : '当前尚未设置密钥。')
    : '本地模型可留空；云端模型需要填写对应平台的 API Key。';
  showModal(modalHead(editing ? '编辑供应商' : '新增供应商', 'OpenAI 兼容接口 · API Key 仅保存在服务端') +
    '<div class="modal-body"><div class="form-grid">' +
    '<div class="field full"><label>快速预设</label><select class="select" id="aiPreset" data-select="aiPreset">' +
    '<option value="">自定义 / 手动填写</option>' +
    '<option value="deepseek">DeepSeek</option>' +
    '<option value="openai">OpenAI</option>' +
    '<option value="qwen">通义千问</option>' +
    '<option value="kimi">Kimi</option>' +
    '<option value="zhipu">智谱 GLM</option>' +
    '<option value="ollama">Ollama 本地</option></select>' +
    '<div class="form-note mt8">选择预设会填入常用地址和模型，仍可手动修改。</div></div>' +
    '<div class="field"><label>供应商名称<i>*</i></label><input class="input" id="aiName" placeholder="如：DeepSeek 教学专用" value="' + (editing ? esc(p.name) : '') + '"></div>' +
    '<div class="field"><label>模型 ID<i>*</i></label><input class="input" id="aiModel" placeholder="如：deepseek-chat" value="' + (editing ? esc(p.model) : '') + '"></div>' +
    '<div class="field full"><label>接口地址<i>*</i></label><input class="input" id="aiBaseUrl" placeholder="https://api.deepseek.com/v1" value="' + (editing ? esc(p.baseUrl) : '') + '"></div>' +
    '<div class="field full"><label>API Key' + (editing ? '（留空保持不变）' : '') + '</label><input class="input" id="aiApiKey" type="password" autocomplete="new-password" placeholder="' + (editing && p.hasKey ? '已保存，如需更换请填写新密钥' : 'sk-...') + '"></div>' +
    '<div class="field full"><div class="form-note">' + keyNote + '</div></div>' +
    '</div></div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-primary" data-act="saveAiProvider" data-id="' + (editing ? esc(p.id) : '') + '">' + (editing ? '保存修改' : '创建供应商') + '</button></div>', 'wide');
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
    var allowedPapers = user.role === 'teacher' ? myPapers() : DB.papers;
    var requested = id ? PAPER(id) : PAPER(S.statPaper);
    var paper = requested && allowedPapers.some(function (x) { return x.id === requested.id; }) ? requested : allowedPapers[0];
    if (!paper) { toast('暂无可导出的试卷数据', 'err'); return; }
    var perf = user.role === 'teacher' ? teacherPerf(paper) : perfFor(paper);
    var paperClassLabel = DB.classes.filter(function (c) { return paper.classIds.indexOf(c.id) > -1; })
      .map(function (c) { return c.name; }).join('、') || '—';
    var classLabel = user.role === 'teacher' && teacherScopeIds() !== null ? teacherScopeLabel() : paperClassLabel;
    rows.push(['学号', '姓名', '教学班', '测评', '得分', '满分', '提交时间']);
    perf.rows.forEach(function (r) {
      if (r.score == null) return;
      rows.push([r.student.no, r.student.name, classLabel, paper.name, r.score, perf.total, fmtFull(r.submittedAt)]);
    });
  } else if (kind === 'kps') {
    name = '知识点统计';
    rows.push(['知识点编号', '知识点名称', '平均得分率', '参与人数', '题量']);
    if (user.role === 'teacher') {
      teacherKpStats().forEach(function (k) {
        rows.push([KPBY(k.id).code, k.name, k.rate + '%', teacherScopedStudents().length, k.count]);
      });
    } else {
      DB.kpAvg.forEach(function (k) { rows.push([k.code, k.name, k.avg + '%', 38, k.count]); });
    }
  } else if (kind === 'classSummary') {
    name = '教学班汇总';
    rows.push(['教学班', '任课教师', '应测人数', '完成人数', '完成率', '平均分', '最高分', '最低分']);
    var summaries = user.role === 'teacher' ? teacherScopedClassSummaries() : DB.classSummaries;
    summaries.forEach(function (c) {
      rows.push([c.className, c.teacher, c.expected, c.completed, pct(c.completed, c.expected) + '%', c.avg, c.max, c.min]);
    });
  } else if (kind === 'papers') {
    name = '试卷清单';
    rows.push(['试卷名称', '教师', '教学班', '题量', '满分', '状态', '开放时间']);
    var exportPapers = user.role === 'teacher' ? myPapers() : DB.papers;
    exportPapers.forEach(function (p) {
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

/* ---------------- 删除教师 / 学生 ---------------- */
function teacherDeleteSummary(id) {
  var teacher = DB.teachers.filter(function (t) { return t.id === id; })[0];
  var classes = DB.classes.filter(function (c) { return c.teacherId === id; });
  var classIds = classes.map(function (c) { return c.id; });
  var students = DB.students.filter(function (s) { return classIds.indexOf(s.classId) > -1; });
  var studentIds = {};
  students.forEach(function (s) { studentIds[s.id] = true; });
  var paperMap = {};
  DB.papers.forEach(function (p) {
    var related = p.teacherId === id;
    if (!related) {
      (p.classIds || []).forEach(function (cid) {
        if (classIds.indexOf(cid) > -1) related = true;
      });
    }
    if (related) paperMap[p.id] = p;
  });
  var attempts = DB.attempts.filter(function (a) {
    return !!paperMap[a.paperId] || !!studentIds[a.studentId];
  });
  return {
    teacher: teacher,
    classes: classes,
    students: students,
    papers: Object.keys(paperMap).map(function (pid) { return paperMap[pid]; }),
    attempts: attempts
  };
}

function studentDeleteSummary(id) {
  var student = STUDENT(id);
  var group = student ? DB.classes.filter(function (c) { return c.id === student.classId; })[0] : null;
  var attempts = DB.attempts.filter(function (a) { return a.studentId === id; });
  return { student: student, group: group, attempts: attempts };
}

function deleteMetric(label, value) {
  return '<div style="min-width:82px"><div class="small muted">' + label + '</div>' +
    '<b style="font-size:22px;font-variant-numeric:tabular-nums">' + value + '</b></div>';
}

/* ---------------- 删除课程 / 知识点 / 题目 / 教学班 / 试卷 ---------------- */
function paperUsesAnyQuestion(p, questionIds) {
  return (p.items || []).some(function (it) { return questionIds.indexOf(it.qid) > -1; });
}

function courseDeleteSummary(id) {
  var course = DB.courses.filter(function (c) { return c.id === id; })[0];
  var classes = DB.classes.filter(function (c) { return c.courseId === id; });
  var classIds = classes.map(function (c) { return c.id; });
  var boundTeacherIds = {};
  classes.forEach(function (c) { if (c.teacherId) boundTeacherIds[c.teacherId] = true; });
  var teachers = DB.teachers.filter(function (t) { return t.courseId === id || boundTeacherIds[t.id]; });
  var students = DB.students.filter(function (s) { return classIds.indexOf(s.classId) > -1; });
  var studentIds = students.map(function (s) { return s.id; });
  var kps = DB.kps.filter(function (k) { return k.courseId === id; });
  var kpIds = kps.map(function (k) { return k.id; });
  var questions = DB.questions.filter(function (q) { return kpIds.indexOf(q.kpId) > -1; });
  var questionIds = questions.map(function (q) { return q.id; });
  var papers = DB.papers.filter(function (p) {
    return p.courseId === id ||
      (p.classIds || []).some(function (cid) { return classIds.indexOf(cid) > -1; }) ||
      paperUsesAnyQuestion(p, questionIds);
  });
  var paperIds = papers.map(function (p) { return p.id; });
  var attemptMap = {};
  DB.attempts.forEach(function (a) {
    if (paperIds.indexOf(a.paperId) > -1 || studentIds.indexOf(a.studentId) > -1) attemptMap[a.id] = a;
  });
  return {
    course: course,
    kps: kps,
    questions: questions,
    teachers: teachers,
    classes: classes,
    students: students,
    papers: papers,
    attempts: Object.keys(attemptMap).map(function (k) { return attemptMap[k]; })
  };
}

function kpDeleteSummary(id) {
  var kp = DB.kps.filter(function (k) { return k.id === id; })[0];
  var questions = DB.questions.filter(function (q) { return q.kpId === id; });
  var questionIds = questions.map(function (q) { return q.id; });
  var papers = DB.papers.filter(function (p) { return paperUsesAnyQuestion(p, questionIds); });
  var paperIds = papers.map(function (p) { return p.id; });
  var attempts = DB.attempts.filter(function (a) { return paperIds.indexOf(a.paperId) > -1; });
  return { kp: kp, questions: questions, papers: papers, attempts: attempts };
}

function questionDeleteSummary(id) {
  var question = DB.questions.filter(function (q) { return q.id === id; })[0];
  var papers = DB.papers.filter(function (p) { return paperUsesAnyQuestion(p, [id]); });
  var paperIds = papers.map(function (p) { return p.id; });
  var attempts = DB.attempts.filter(function (a) { return paperIds.indexOf(a.paperId) > -1; });
  return { question: question, papers: papers, attempts: attempts };
}

function classDeleteSummary(id) {
  var group = DB.classes.filter(function (c) { return c.id === id; })[0];
  var students = DB.students.filter(function (s) { return s.classId === id; });
  var studentIds = students.map(function (s) { return s.id; });
  var papers = DB.papers.filter(function (p) { return (p.classIds || []).indexOf(id) > -1; });
  var paperIds = papers.map(function (p) { return p.id; });
  var attempts = DB.attempts.filter(function (a) {
    return paperIds.indexOf(a.paperId) > -1 || studentIds.indexOf(a.studentId) > -1;
  });
  return { group: group, students: students, papers: papers, attempts: attempts };
}

function paperDeleteSummary(id) {
  var paper = DB.papers.filter(function (p) { return p.id === id; })[0];
  var attempts = DB.attempts.filter(function (a) { return a.paperId === id; });
  return { paper: paper, attempts: attempts };
}

function showEntityDeleteModal(o) {
  showModal(modalHead(o.title, o.subtitle) +
    '<div class="modal-body">' +
    '<div class="alert danger">' + icon('alert') + '<div><b>此操作不可恢复。</b>' + o.warning + '</div></div>' +
    '<div class="report-text mt16">' + o.info + '</div>' +
    '<div class="row mt16" style="gap:28px;flex-wrap:wrap">' + o.metrics + '</div>' +
    '<div class="form-note mt12">' + o.note + '</div>' +
    '</div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
    '<button class="btn btn-danger" data-act="confirmDeleteEntity" data-kind="' + o.kind +
    '" data-id="' + esc(o.id) + '">确认彻底删除</button></div>', 'wide');
}

function openEntityDelete(kind, id) {
  if (!id) { toast('缺少删除对象编号，请刷新页面重试', 'err'); return; }
  if (kind === 'course') {
    var cs = courseDeleteSummary(id);
    if (!cs.course) { toast('课程不存在或已被删除', 'err'); return; }
    if (cs.course.id === user.courseId) {
      toast('当前账号所属课程不能删除，请先切换课程', 'err');
      return;
    }
    showEntityDeleteModal({
      kind: kind, id: id, title: '删除课程', subtitle: '彻底删除课程及全部关联数据',
      warning: '课程下的知识点、题目、教师账号、教学班、学生账号、关联试卷和全部作答记录将被永久删除。',
      info: '课程：<b>' + esc(cs.course.name) + '</b>（' + esc(cs.course.code) + '）<br>负责人：' + esc(cs.course.owner),
      metrics: deleteMetric('知识点', cs.kps.length) + deleteMetric('题目', cs.questions.length) +
        deleteMetric('教师', cs.teachers.length) + deleteMetric('教学班', cs.classes.length) +
        deleteMetric('学生', cs.students.length) + deleteMetric('试卷', cs.papers.length) +
        deleteMetric('作答记录', cs.attempts.length),
      note: '删除后，该课程将不再出现在课程列表、题库、教学班、统计、报告和导出数据中。当前账号所属课程不可删除。'
    });
    return;
  }
  if (kind === 'kp') {
    var ks = kpDeleteSummary(id);
    if (!ks.kp) { toast('知识点不存在或已被删除', 'err'); return; }
    var course = DB.courses.filter(function (c) { return c.id === ks.kp.courseId; })[0];
    showEntityDeleteModal({
      kind: kind, id: id, title: '删除知识点', subtitle: '彻底删除知识点及其关联题目',
      warning: '知识点下的题目将一并删除；若题目已被试卷引用，相关试卷和作答记录也会被永久删除。',
      info: '知识点：<b>' + esc(ks.kp.code) + ' ' + esc(ks.kp.name) + '</b><br>所属课程：' + esc(course ? course.name : '—'),
      metrics: deleteMetric('题目', ks.questions.length) + deleteMetric('试卷', ks.papers.length) +
        deleteMetric('作答记录', ks.attempts.length),
      note: '删除后，该知识点及关联题目将不再出现在题库、组卷、统计和导出数据中。'
    });
    return;
  }
  if (kind === 'question') {
    var qs = questionDeleteSummary(id);
    if (!qs.question) { toast('题目不存在或已被删除', 'err'); return; }
    var stem = qs.question.stem.length > 60 ? qs.question.stem.slice(0, 60) + '…' : qs.question.stem;
    showEntityDeleteModal({
      kind: kind, id: id, title: '删除题目', subtitle: '彻底删除题目及引用它的试卷',
      warning: '引用该题目的试卷和全部作答记录将被永久删除，其他题目不受影响。',
      info: '题目：<b>' + esc(qs.question.id) + '</b><br>' + esc(stem),
      metrics: deleteMetric('引用试卷', qs.papers.length) + deleteMetric('作答记录', qs.attempts.length),
      note: '删除后，该题目将不再出现在题库、组卷、试卷详情、统计和导出数据中。'
    });
    return;
  }
  if (kind === 'class') {
    var cls = classDeleteSummary(id);
    if (!cls.group) { toast('教学班不存在或已被删除', 'err'); return; }
    showEntityDeleteModal({
      kind: kind, id: id, title: '删除教学班', subtitle: '彻底删除教学班及班内数据',
      warning: '班内学生账号、该班关联试卷和全部作答记录将被永久删除；若试卷同时发布给其他教学班，也会一并删除。',
      info: '教学班：<b>' + esc(cls.group.name) + '</b><br>任课教师：' + esc(cls.group.teacherName) +
        '<br>课程：' + esc((DB.courses.filter(function (c) { return c.id === cls.group.courseId; })[0] || {}).name || '—'),
      metrics: deleteMetric('学生', cls.students.length) + deleteMetric('试卷', cls.papers.length) +
        deleteMetric('作答记录', cls.attempts.length),
      note: '删除后，教师教学班文本、课程班级数和相关统计会同步更新。'
    });
    return;
  }
  if (kind === 'paper') {
    var ps = paperDeleteSummary(id);
    if (!ps.paper) { toast('试卷不存在或已被删除', 'err'); return; }
    showEntityDeleteModal({
      kind: kind, id: id, title: '删除试卷', subtitle: '彻底删除试卷及全部作答记录',
      warning: '试卷本身和全部作答记录将被永久删除，学生的成绩、报告和统计会同步消失。',
      info: '试卷：<b>' + esc(ps.paper.name) + '</b><br>教师 / 班级：' + esc(ps.paper.teacherName) + ' · ' + esc(ps.paper.className),
      metrics: deleteMetric('题目', ps.paper.items.length) + deleteMetric('作答记录', ps.attempts.length),
      note: '删除后，该试卷将不再出现在试卷中心、学生测试、统计、报告和导出数据中。'
    });
  }
}

var ENTITY_DELETE_API = {
  course: function (id) { return API.deleteCourse(id); },
  kp: function (id) { return API.deleteKp(id); },
  question: function (id) { return API.deleteQuestion(id); },
  'class': function (id) { return API.deleteClass(id); },
  paper: function (id) { return API.deletePaper(id); }
};

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
  deleteTeacher: function (el) {
    var id = el.dataset.id;
    if (!id) { toast('缺少教师编号，请刷新页面重试', 'err'); return; }
    var summary = teacherDeleteSummary(id);
    if (!summary.teacher) { toast('教师不存在或已被删除', 'err'); return; }
    var t = summary.teacher;
    var classNames = summary.classes.map(function (c) { return esc(c.name); }).join('、') || '无';
    showModal(modalHead('删除教师', '彻底删除教师账号及关联数据') +
      '<div class="modal-body">' +
      '<div class="alert danger">' + icon('alert') + '<div><b>此操作不可恢复。</b>教师账号、教学班、班内学生账号、关联试卷和全部作答记录将被永久删除。</div></div>' +
      '<div class="report-text mt16">教师：<b>' + esc(t.name) + '</b>（' + esc(t.no) + '）<br>教学班：' + classNames + '</div>' +
      '<div class="row mt16" style="gap:28px;flex-wrap:wrap">' +
      deleteMetric('教学班', summary.classes.length) +
      deleteMetric('学生', summary.students.length) +
      deleteMetric('试卷', summary.papers.length) +
      deleteMetric('作答记录', summary.attempts.length) + '</div>' +
      '<div class="form-note mt12">删除后，这些教师、学生和试卷将不再出现在任何列表、统计、报告和导出数据中。</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmDeleteTeacher" data-id="' + esc(id) + '">确认彻底删除</button></div>', 'wide');
  },
  confirmDeleteTeacher: async function (el) {
    var id = el.dataset.id;
    if (!id) { toast('缺少教师编号，请刷新页面重试', 'err'); return; }
    var teacher = DB.teachers.filter(function (t) { return t.id === id; })[0];
    var name = teacher ? teacher.name : '该教师';
    el.disabled = true;
    try {
      await API.deleteTeacher(id);
      await reloadDB();
      closeModal();
      render();
      toast('已彻底删除教师「' + name + '」及关联数据');
    } catch (e) {
      el.disabled = false;
      toast(e.message, 'err');
    }
  },
  deleteStudent: function (el) {
    var id = el.dataset.id;
    if (!id) { toast('缺少学生编号，请刷新页面重试', 'err'); return; }
    var summary = studentDeleteSummary(id);
    if (!summary.student) { toast('学生不存在或已被删除', 'err'); return; }
    var s = summary.student;
    var groupName = summary.group ? summary.group.name : '未绑定教学班';
    showModal(modalHead('删除学生', '彻底删除学生账号及作答数据') +
      '<div class="modal-body">' +
      '<div class="alert danger">' + icon('alert') + '<div><b>此操作不可恢复。</b>学生将无法继续登录，历史作答、成绩和报告将一并删除。</div></div>' +
      '<div class="report-text mt16">学生：<b>' + esc(s.name) + '</b>（' + esc(s.no) + '）<br>' +
      '教学班：' + esc(groupName) + '<br>专业：' + esc(s.major || '—') + '</div>' +
      '<div class="row mt16" style="gap:28px;flex-wrap:wrap">' +
      deleteMetric('作答记录', summary.attempts.length) + '</div>' +
      '<div class="form-note mt12">删除后，该学生将从教学班人数、学生列表、统计、报告和导出数据中移除。</div>' +
      '</div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmDeleteStudent" data-id="' + esc(id) + '">确认彻底删除</button></div>', 'wide');
  },
  confirmDeleteStudent: async function (el) {
    var id = el.dataset.id;
    if (!id) { toast('缺少学生编号，请刷新页面重试', 'err'); return; }
    var student = STUDENT(id);
    var name = student ? student.name : '该学生';
    el.disabled = true;
    try {
      await API.deleteStudent(id);
      await reloadDB();
      closeModal();
      render();
      toast('已彻底删除学生「' + name + '」及关联数据');
    } catch (e) {
      el.disabled = false;
      toast(e.message, 'err');
    }
  },
  deleteEntity: function (el) {
    openEntityDelete(el.dataset.kind, el.dataset.id);
  },
  confirmDeleteEntity: async function (el) {
    var kind = el.dataset.kind;
    var id = el.dataset.id;
    var api = ENTITY_DELETE_API[kind];
    if (!api || !id) { toast('缺少删除对象信息，请刷新页面重试', 'err'); return; }
    var name = '';
    var extra = '';
    if (kind === 'course') {
      var cs = courseDeleteSummary(id);
      if (!cs.course) { toast('课程不存在或已被删除', 'err'); return; }
      name = cs.course.name;
      extra = '及全部关联数据';
    } else if (kind === 'kp') {
      var ks = kpDeleteSummary(id);
      if (!ks.kp) { toast('知识点不存在或已被删除', 'err'); return; }
      name = ks.kp.name;
      extra = '，同时删除 ' + ks.questions.length + ' 道题目' +
        (ks.papers.length ? '、' + ks.papers.length + ' 份试卷' : '');
    } else if (kind === 'question') {
      var qs = questionDeleteSummary(id);
      if (!qs.question) { toast('题目不存在或已被删除', 'err'); return; }
      name = qs.question.id;
      extra = qs.papers.length ? '，同时删除 ' + qs.papers.length + ' 份引用试卷' : '';
    } else if (kind === 'class') {
      var cls = classDeleteSummary(id);
      if (!cls.group) { toast('教学班不存在或已被删除', 'err'); return; }
      name = cls.group.name;
      extra = '，同时删除 ' + cls.students.length + ' 名学生' +
        (cls.papers.length ? '、' + cls.papers.length + ' 份试卷' : '');
    } else if (kind === 'paper') {
      var ps = paperDeleteSummary(id);
      if (!ps.paper) { toast('试卷不存在或已被删除', 'err'); return; }
      name = ps.paper.name;
      extra = '及 ' + ps.attempts.length + ' 条作答记录';
    }
    el.disabled = true;
    try {
      await api(id);
      await reloadDB();
      closeModal();
      render();
      toast('已彻底删除「' + name + '」' + extra);
    } catch (e) {
      el.disabled = false;
      toast(e.message, 'err');
    }
  },
  wrongSelectAll: function () {
    wrongFilteredEntries().forEach(function (e) { S.wrong.sel[e.qid] = true; });
    refreshWrongSelectionUI();
  },
  wrongClear: function () {
    S.wrong.sel = {};
    refreshWrongSelectionUI();
  },
  wrongCreate: function () {
    var picked = wrongSelectedEntries();
    if (!picked.length) { toast('请至少选择 1 道错题', 'err'); return; }
    var now = new Date();
    var defaultName = '错题重练 · ' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate()) + ' ' +
      pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    var defaultDuration = clamp(picked.length * 2, 10, 120);
    showModal(modalHead('生成个人错题测试', '仅本人可见 · 从错题本中抽取题目') +
      '<div class="modal-body"><div class="report-text">已选择 <b>' + picked.length + '</b> 道错题，每题 5 分，满分 <b>' +
      (picked.length * 5) + '</b> 分。生成后可立即作答，提交后自动判分。</div>' +
      '<div class="form-grid mt16">' +
      '<div class="field full"><label>测试名称</label><input class="input" id="wrongTestName" value="' + esc(defaultName) + '"></div>' +
      '<div class="field"><label>限时（分钟）</label><input class="input" id="wrongTestDuration" type="number" min="5" max="180" value="' + defaultDuration + '"></div>' +
      '<div class="field"><label>题目数量</label><input class="input" value="' + picked.length + ' 题" readonly></div>' +
      '</div><div class="alert info mt16">' + icon('info') + '<div>错题测试不会出现在教师端，也不会占用教师发布试卷的作答次数。</div></div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-primary" data-act="confirmWrongCreate">生成并保存</button></div>', 'wide');
  },
  confirmWrongCreate: async function (el) {
    var picked = wrongSelectedEntries();
    if (!picked.length) { toast('请至少选择 1 道错题', 'err'); return; }
    var name = (($('#wrongTestName') || {}).value || '').trim();
    var duration = parseInt((($('#wrongTestDuration') || {}).value || ''), 10) || 0;
    if (!name) { toast('请填写测试名称', 'err'); return; }
    if (duration < 5 || duration > 180) { toast('限时需在 5~180 分钟之间', 'err'); return; }
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '生成中…';
    try {
      var res = await API.createWrongTest({
        qids: picked.map(function (e) { return e.qid; }),
        name: name,
        duration: duration
      });
      await reloadDB();
      closeModal();
      render();
      toast(res && res.message ? res.message : '个人错题测试已生成');
    } catch (e) {
      el.disabled = false; el.innerHTML = label;
      toast(e.message, 'err');
    }
  },
  deleteWrongTest: function (el) {
    var p = PAPER(el.dataset.id);
    if (!p) { toast('错题测试不存在或已被删除', 'err'); return; }
    showModal(modalHead('删除错题测试', '仅删除这份个人测试') +
      '<div class="modal-body"><div class="alert danger">' + icon('alert') + '<div><b>此操作不可恢复。</b>该错题测试及对应作答记录将被删除，错题本中的原始错题不会受影响。</div></div>' +
      '<div class="report-text mt16">测试：<b>' + esc(p.name) + '</b><br>题量：' + p.items.length + ' 题 · 满分 ' + paperTotal(p) + ' 分</div></div>' +
      '<div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmDeleteWrongTest" data-id="' + esc(p.id) + '">确认删除</button></div>', 'wide');
  },
  confirmDeleteWrongTest: async function (el) {
    var id = el.dataset.id;
    if (!id) return;
    var p = PAPER(id);
    var name = p ? p.name : '该错题测试';
    el.disabled = true; el.textContent = '删除中…';
    try {
      await API.deleteWrongTest(id);
      await reloadDB();
      closeModal();
      render();
      toast('已删除「' + name + '」');
    } catch (e) {
      el.disabled = false; el.textContent = '确认删除';
      toast(e.message, 'err');
    }
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
  viewKpQuestions: function (el) {
    S.q.kp = el.dataset.id || '';
    S.q.type = '';
    S.q.kw = '';
    S.q.page = 1;
    go('cl/questions');
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
  openAddTeacherClasses: function (el) { openAddTeacherClasses(el && el.dataset ? el.dataset.id : ''); },
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
  saveTeacherClasses: async function (el) {
    var teacherId = (el && el.dataset && el.dataset.id) || ($('#ftcTeacher') ? $('#ftcTeacher').value : '');
    var names = ($('#ftcNames') ? $('#ftcNames').value : '').trim();
    if (!teacherId) { toast('请选择任课教师', 'err'); return; }
    if (!names) { toast('请填写至少一个教学班名称', 'err'); return; }
    var teacher = DB.teachers.filter(function (t) { return t.id === teacherId; })[0];
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '保存中…';
    try {
      var res = await API.addTeacherClasses(teacherId, {
        names: names,
        major: ($('#ftcMajor') ? $('#ftcMajor').value : '').trim(),
        term: ($('#ftcTerm') ? $('#ftcTerm').value : '').trim()
      });
      await reloadDB();
      closeModal();
      render();
      toast('已为「' + (teacher ? teacher.name : '教师') + '」添加 ' + ((res && res.count) || 1) + ' 个教学班');
    } catch (e) {
      el.disabled = false; el.innerHTML = label;
      toast(e.message, 'err');
    }
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
  openAiProvider: function (el) { openAiProviderModal(el.dataset.id || ''); },
  saveAiProvider: async function (el) {
    var id = el.dataset.id || '';
    var name = ($('#aiName').value || '').trim();
    var baseUrl = ($('#aiBaseUrl').value || '').trim();
    var model = ($('#aiModel').value || '').trim();
    var apiKey = ($('#aiApiKey').value || '').trim();
    if (!name || !baseUrl || !model) { toast('供应商名称、接口地址和模型 ID 不能为空', 'err'); return; }
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '保存中…';
    try {
      var payload = { name: name, baseUrl: baseUrl, model: model, apiKey: apiKey };
      if (id) await API.updateAiProvider(id, payload);
      else await API.createAiProvider(payload);
      await reloadDB();
      closeModal();
      render();
      toast(id ? '供应商配置已更新' : '供应商已创建，可在列表中启用');
    } catch (e) {
      el.disabled = false; el.innerHTML = label;
      toast(e.message, 'err');
    }
  },
  activateAiProvider: async function (el) {
    var id = el.dataset.id;
    var p = (DB.aiProviders || []).filter(function (x) { return x.id === id; })[0];
    if (!p) { toast('供应商不存在，请刷新页面重试', 'err'); return; }
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '切换中…';
    try {
      await API.activateAiProvider(id);
      await reloadDB();
      render();
      toast('已切换模型：' + p.name + ' · ' + p.model);
    } catch (e) {
      el.disabled = false; el.innerHTML = label;
      toast(e.message, 'err');
    }
  },
  testAiProvider: async function (el) {
    var id = el.dataset.id;
    var p = (DB.aiProviders || []).filter(function (x) { return x.id === id; })[0];
    if (!p) { toast('供应商不存在，请刷新页面重试', 'err'); return; }
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '测试中…';
    try {
      var res = await API.testAiProvider(id);
      toast('连接成功：' + (res.model || p.model) + ' · ' + res.latencyMs + 'ms');
    } catch (e) {
      toast(e.message, 'err');
    } finally {
      el.disabled = false; el.innerHTML = label;
    }
  },
  deleteAiProvider: function (el) {
    var id = el.dataset.id;
    var p = (DB.aiProviders || []).filter(function (x) { return x.id === id; })[0];
    if (!p) { toast('供应商不存在，请刷新页面重试', 'err'); return; }
    showModal(modalHead('删除供应商', '删除后该模型配置将不可恢复') +
      '<div class="modal-body">' +
      '<div class="alert danger">' + icon('alert') + '<div><b>此操作不可恢复。</b>删除当前使用中的供应商时，系统会自动切换到其他供应商。</div></div>' +
      '<div class="report-text mt16">供应商：<b>' + esc(p.name) + '</b><br>模型：' + esc(p.model) + '<br>接口：' + esc(p.baseUrl) + '</div>' +
      '<div class="form-note mt12">如果这是最后一个供应商，系统会阻止删除，以保证模型设置页面始终有可用配置。</div>' +
      '</div><div class="modal-foot"><button class="btn" data-act="closeModal">取消</button>' +
      '<button class="btn btn-danger" data-act="confirmDeleteAiProvider" data-id="' + esc(id) + '">确认删除</button></div>', 'wide');
  },
  confirmDeleteAiProvider: async function (el) {
    var id = el.dataset.id;
    var p = (DB.aiProviders || []).filter(function (x) { return x.id === id; })[0];
    var name = p ? p.name : '该供应商';
    var label = el.innerHTML;
    el.disabled = true; el.textContent = '删除中…';
    try {
      var res = await API.deleteAiProvider(id);
      await reloadDB();
      closeModal();
      render();
      toast('已删除「' + name + '」' + (res.activeName ? '，当前模型切换为「' + res.activeName + '」' : ''));
    } catch (e) {
      el.disabled = false; el.innerHTML = label;
      toast(e.message, 'err');
    }
  },
  viewPaper: function (el) { openPaper(el.dataset.id); },
  exportPaper: function (el) { exportPaper(el.dataset.id); },
  export: function (el) { handleExport(el.dataset.kind, el.dataset.paper || el.dataset.id); },
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
  if (el.hasAttribute && el.hasAttribute('data-wrongq')) {
    if (el.checked) S.wrong.sel[el.getAttribute('data-wrongq')] = true;
    else delete S.wrong.sel[el.getAttribute('data-wrongq')];
    refreshWrongSelectionUI();
    return;
  }
  if (el.dataset.select === 'wrongSource') {
    S.wrong.source = el.value; refreshWrongList(); return;
  }
  if (el.dataset.select === 'wrongKp') {
    S.wrong.kp = el.value; refreshWrongList(); return;
  }
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
  if (el.dataset.select === 'aiPreset') {
    applyAiPreset(el.value); return;
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
  if (el.dataset.select === 'teacherClass') {
    setTeacherClass(el.value); render(); return;
  }
  if (el.dataset.select === 'statPaper') {
    S.statPaper = el.value; render(); return;
  }
  if (el.dataset.select === 'progressPaper') {
    S.progressPaper = el.value; render(); return;
  }
  if (el.dataset.select === 'reportPaper') {
    S.reportPaper = el.value; render(); return;
  }
  if (el.id === 'fqType') { toggleQuestionTypeFields(); return; }
  if (el.dataset.wiz) {
    updateWizardField(el);
  }
});

document.addEventListener('input', function (e) {
  var el = e.target;
  if (el.dataset.input === 'wrongSearch') {
    S.wrong.kw = el.value; refreshWrongList(); return;
  }
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
