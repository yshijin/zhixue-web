/* =========================================================
   教师端页面
   ========================================================= */

function latestAttemptForStudent(sid) {
  return DB.attempts.filter(function (a) {
    return a.studentId === sid && a.status !== 'in_progress';
  }).sort(function (a, b) {
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  })[0];
}

function viewTDashboard() {
  var cls = DB.classSummaries[0];
  if (!cls) {
    return pageHead('工作台', '教师工作台') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('尚未绑定教学班', '教师账号已创建，但还没有关联教学班。请联系课程负责人在“教师管理”或“教学班总览”中绑定后再使用。', 'school') +
      '</div></div>';
  }
  var className = cls.className || ((DB.classes[0] || {}).name) || '我的教学班';
  var courseName = (DB.courses[0] && DB.courses[0].name) || '课程';
  var my = myPapers();
  var ongoing = my.filter(function (p) { return paperStatus(p).key === 'ongoing'; });
  var recent = my.slice().sort(function (a, b) {
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  }).slice(0, 4);
  var focus = ongoing[0] || my[0] || null;
  var perf = focus ? perfFor(focus) : null;
  var expected = perf ? perf.expected : cls.expected;
  var completed = perf ? perf.completed : cls.completed;
  var avg = perf ? perf.avg : cls.avg;
  var max = perf ? perf.max : cls.max;
  var min = perf ? perf.min : cls.min;
  var pending = Math.max(0, expected - completed);
  var hasData = completed > 0;
  var weak = hasData ? DB.kpAvg.slice().sort(function (a, b) { return a.avg - b.avg; }).slice(0, 5) : [];

  var html = pageHead('工作台', className + ' · ' + courseName,
    '<button class="btn" data-act="openImport" data-kind="student">' + icon('upload') + '导入学生</button>' +
    '<button class="btn btn-primary" data-act="newWizard">' + icon('plus') + '创建测试</button>');

  var welcomeText;
  if (focus) {
    welcomeText = '「' + esc(focus.name) + '」' + paperStatus(focus).label + '，当前完成 ' + completed + ' / ' + expected + ' 人。';
    if (!expected) welcomeText = '「' + esc(focus.name) + '」已发布，当前教学班还没有学生，导入学生后即可开始测评。';
  } else {
    welcomeText = '当前教学班还没有测评记录。创建第一份测试，系统会按知识点自动组卷并生成学习诊断。';
  }
  html += '<div class="welcome"><h2>' + greeting() + '，' + esc(user.name) + '老师</h2>' +
    '<p>' + welcomeText + '</p>' +
    '<div class="welcome-actions"><button class="btn solid" data-act="go" data-to="t/progress">查看测试进度</button>' +
    '<button class="btn" data-act="newWizard">' + icon('plus') + '新建测评</button></div></div>';

  html += '<div class="stats">' +
    statCard('我的教学班', DB.classes.length + '<small>个</small>', 'school', '') +
    statCard('班级学生', expected + '<small>人</small>', 'users', 'purple') +
    statCard('进行中测评', ongoing.length + '<small>场</small>', 'clock', 'green') +
    statCard('本次平均分', hasData ? avg : '—', 'target', 'amber', hasData ? ('满分 100 · ' + completed + ' 人提交') : '暂无作答数据') +
    '</div>';

  var todo = [];
  if (ongoing[0]) {
    todo.push('<div class="todo-item"><div class="todo-ico amber">' + icon('clock') + '</div><div><b>「' + esc(ongoing[0].name) + '」进行中</b><small>' + completed + ' / ' + expected + ' 人已提交，' + pending + ' 人未完成</small></div></div>');
  }
  var upcoming = my.filter(function (p) { return paperStatus(p).key === 'upcoming'; })[0];
  if (upcoming) {
    todo.push('<div class="todo-item"><div class="todo-ico">' + icon('calendar') + '</div><div><b>「' + esc(upcoming.name) + '」即将开始</b><small>' + fmtDT(upcoming.startAt) + ' · ' + esc(upcoming.className) + '</small></div></div>');
  }
  if (hasData) {
    todo.push('<div class="todo-item"><div class="todo-ico green">' + icon('spark') + '</div><div><b>学习报告可查看</b><small>当前已有 ' + completed + ' 名学生产生作答记录</small></div></div>');
  }
  if (!todo.length) {
    todo.push('<div class="todo-item"><div class="todo-ico green">' + icon('plus') + '</div><div><b>创建第一份测试</b><small>按知识点自动组卷，发布后即可收集学习数据</small></div></div>');
  }

  html += '<div class="grid-2-1">' +
    '<div class="card"><div class="card-head"><h3>最近测评</h3><button class="btn btn-sm btn-ghost right" data-act="go" data-to="t/papers">全部' + icon('arrow') + '</button></div>' +
    '<div class="card-body">' + (recent.length ? recent.map(function (p) {
      return '<div class="paper-row"><div class="paper-ico ' + (paperStatus(p).key === 'ongoing' ? 'blue' : '') + '">' + icon('file') + '</div>' +
        '<div class="pr-main"><b>' + esc(p.name) + '</b><small>' + p.items.length + ' 题 · ' + p.duration + ' 分钟 · ' + esc(p.className) + '</small></div>' +
        '<div class="pr-meta">' + statusTag(p) + '<div style="margin-top:2px">' + fmtDT(p.startAt) + '</div></div>' +
        '<button class="btn btn-sm btn-ghost" data-act="viewPaper" data-id="' + p.id + '">' + icon('eye') + '</button></div>';
    }).join('') : emptyHTML('暂无测评', '点击右上角“创建测试”开始。', 'file')) + '</div></div>' +

    '<div class="card"><div class="card-head"><h3>待办提醒</h3></div><div class="card-body"><div class="todo">' +
    todo.join('') + '</div></div></div></div>';

  html += '<div class="grid-2-1 mt16"><div class="card"><div class="card-head"><h3>本次测评完成情况</h3><span class="sub">' + esc(focus ? focus.name : '暂无测评') + '</span>' +
    '<button class="btn btn-sm btn-ghost right" data-act="go" data-to="t/progress">详情' + icon('arrow') + '</button></div>' +
    (expected > 0 ? '<div class="card-body row" style="gap:24px">' + donutHTML(pct(completed, expected), '完成率', 'green') +
      '<div class="grow"><div class="row" style="justify-content:space-between;margin-bottom:9px"><span class="small muted">已提交</span><b>' + completed + ' / ' + expected + '</b></div>' +
      '<div class="progress green"><i style="width:' + pct(completed, expected) + '%"></i></div>' +
      '<div class="row mt16" style="gap:24px"><div><div class="small muted">平均分</div><b style="font-size:19px">' + avg + '</b></div>' +
      '<div><div class="small muted">最高分</div><b style="font-size:19px">' + max + '</b></div>' +
      '<div><div class="small muted">最低分</div><b style="font-size:19px">' + min + '</b></div></div></div></div>' :
      '<div class="card-body">' + emptyHTML('暂无学生', '导入学生后，这里会显示完成率与成绩统计。', 'users') + '</div>') + '</div>' +
    '<div class="card"><div class="card-head"><h3>班级薄弱知识点</h3></div><div class="card-body">' +
    (hasData && weak.length ? barsHTML(weak.map(function (k) { return { name: k.name, rate: k.avg }; })) : emptyHTML('暂无知识点数据', '完成一次测评后，这里会按得分率展示薄弱知识点。', 'chart')) + '</div></div></div>';

  return html;
}

/* ---------------- 学生管理 ---------------- */
function filteredStudents() {
  var kw = S.stu.kw.toLowerCase();
  return DB.students.filter(function (s) {
    if (!kw) return true;
    return (s.name + s.no + s.major).toLowerCase().indexOf(kw) > -1;
  });
}
function studentTableHTML() {
  var list = filteredStudents();
  var pageSize = 10;
  var pages = Math.max(1, Math.ceil(list.length / pageSize));
  var page = clamp(S.stu.page, 1, pages);
  var slice = list.slice((page - 1) * pageSize, page * pageSize);
  if (!list.length) return emptyHTML('没有找到学生', DB.students.length ? '调整搜索条件后再试。' : '点击右上角“添加学生”或“批量导入”开始。', DB.students.length ? 'search' : 'users');
  var html = '<div class="table-wrap"><table class="tb"><thead><tr><th>学号</th><th>姓名</th><th>专业</th><th>最近测评</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  html += slice.map(function (s) {
    var att = latestAttemptForStudent(s.id);
    var score = att ? att.score : null;
    var paperId = att ? att.paperId : (myPapers()[0] ? myPapers()[0].id : '');
    return '<tr><td class="muted num">' + s.no + '</td><td class="cell-main">' + esc(s.name) + '</td>' +
      '<td class="muted">' + esc(s.major) + ' · ' + esc(s.adminClass) + '</td>' +
      '<td>' + (score == null ? '<span class="muted">—</span>' : '<b>' + score + '</b> <span class="muted small">分</span>') + '</td>' +
      '<td>' + (score == null ? tag('未提交', 'amber') : tag('已完成', 'green')) + '</td>' +
      '<td><div class="actions"><button class="btn btn-sm btn-ghost" data-act="viewStudentReport" data-sid="' + s.id + '" data-paper="' + esc(paperId) + '" ' + (paperId ? '' : 'disabled') + '>' + icon('spark') + '查看报告</button>' +
      '<button class="btn btn-sm btn-danger" data-act="deleteStudent" data-id="' + esc(s.id) + '" data-name="' + esc(s.name) + '">' + icon('trash') + '删除</button></div></td></tr>';
  }).join('');
  html += '</tbody></table></div><div class="table-foot"><span>共 ' + list.length + ' 人 · 第 ' + page + ' / ' + pages + ' 页</span>' +
    '<span class="right row"><button class="btn btn-sm" data-act="stuPage" data-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>' +
    '<button class="btn btn-sm" data-act="stuPage" data-page="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>下一页</button></span></div>';
  return html;
}
function viewTStudents() {
  var className = DB.classes.map(function (c) { return c.name; }).join('、');
  if (!DB.classes.length) {
    return pageHead('学生管理', '仅可维护本人教学班学生') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('尚未绑定教学班', '教师账号已创建，但还没有关联教学班。请联系课程负责人绑定后再导入学生。', 'school') +
      '</div></div>';
  }
  var done = DB.students.filter(function (s) { return latestAttemptForStudent(s.id) != null; }).length;
  var html = pageHead('学生管理', className + ' · 仅可维护本人教学班学生',
    '<button class="btn" data-act="openImport" data-kind="student">' + icon('upload') + '批量导入</button>' +
    '<button class="btn btn-primary" data-act="openAddStudent">' + icon('plus') + '添加学生</button>');

  html += '<div class="alert info mb16">' + icon('info') +
    '<div>学生转班后历史测试记录会保留原教学班快照，避免历史统计被改写。当前教学班共 ' + DB.students.length + ' 人，已有 ' + done + ' 人产生作答记录。</div></div>';

  html += '<div class="card"><div class="card-body tight"><div class="filters">' +
    '<input class="input search" style="width:280px" placeholder="搜索学号 / 姓名 / 专业" value="' + esc(S.stu.kw) + '" data-input="ssearch">' +
    '<span class="small muted right">共 ' + DB.students.length + ' 名学生</span></div></div>' +
    '<div id="stuTableWrap">' + studentTableHTML() + '</div></div>';
  return html;
}

/* ---------------- 创建测试 ---------------- */
function weekNoOf(d) {
  // 教学周：以 9 月 1 日为第 1 周起点（春季学期可改为 2 月 20 日）
  var start = new Date(d.getFullYear(), 8, 1);
  if (d < start) start = new Date(d.getFullYear() - 1, 8, 1);
  return Math.max(1, Math.floor((d - start) / 86400000 / 7) + 1);
}
function initWizard() {
  var now = new Date();
  var start = new Date(now.getTime() + 10 * 60000);
  start.setSeconds(0, 0);
  var end = new Date(start.getTime() + 24 * 3600000);
  var ownClasses = DB.classes.filter(function (c) { return c.teacherId === user.id; });
  var availableKps = DB.kps.filter(function (k) {
    return DB.questions.some(function (q) { return q.kpId === k.id; });
  });
  if (!availableKps.length) availableKps = DB.kps;
  S.wizard = {
    step: 1,
    name: '第' + weekNoOf(now) + '周知识点测验',
    classIds: ownClasses.length ? [ownClasses[0].id] : [],
    kpIds: availableKps.slice(0, 4).map(function (k) { return k.id; }),
    counts: { single: 4, multi: 3, judge: 3 },
    scores: { single: 10, multi: 10, judge: 10 },
    duration: 30,
    start: localInput(start),
    end: localInput(end),
    attempts: 1,
    policy: 'afterSubmit',
    shuffle: true,
    paper: null,
    error: ''
  };
}
function viewTCreate() {
  var ownClasses = DB.classes.filter(function (c) { return c.teacherId === user.id; });
  if (!ownClasses.length) {
    return pageHead('创建测试', '按知识点自动组卷，发布至本人教学班') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('尚未绑定教学班', '教师账号已创建，但还没有关联教学班。请联系课程负责人绑定教学班后再创建测试。', 'school') +
      '</div></div>';
  }
  if (!DB.kps.length) {
    return pageHead('创建测试', '按知识点自动组卷，发布至本人教学班') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('暂无可用知识点', '当前课程还没有配置知识点，请联系课程负责人。', 'book') +
      '</div></div>';
  }
  if (!S.wizard) initWizard();
  var w = S.wizard;
  var steps = [
    { n: 1, label: '选择知识点' },
    { n: 2, label: '设置组卷参数' },
    { n: 3, label: '预览与发布' }
  ];
  var html = pageHead('创建测试', '按知识点自动组卷，发布至本人教学班');
  html += '<div class="steps">' + steps.map(function (s, i) {
    return (i ? '<div class="step-line"></div>' : '') + '<div class="step ' + (w.step === s.n ? 'on' : w.step > s.n ? 'done' : '') + '">' +
      '<div class="n">' + (w.step > s.n ? '✓' : s.n) + '</div><span>' + s.label + '</span></div>';
  }).join('') + '</div>';
  if (w.step === 1) html += wizStep1();
  else if (w.step === 2) html += wizStep2();
  else html += wizStep3();
  return html;
}
function wizStep1() {
  var w = S.wizard;
  var ownClasses = DB.classes.filter(function (c) { return c.teacherId === user.id; });
  return '<div class="card"><div class="card-head"><h3>基本信息与知识点</h3><span class="sub">至少选择 1 个知识点</span></div><div class="card-body">' +
    '<div class="form-grid"><div class="field full"><label>测试名称<i>*</i></label>' +
    '<input class="input" id="wizName" data-wiz="name" value="' + esc(w.name) + '" placeholder="如：第3周知识点测验"></div>' +
    '<div class="field full"><label>目标教学班<i>*</i></label><div class="row wrap">' +
    ownClasses.map(function (c) {
      return '<label class="check"><input type="checkbox" data-wiz="class" value="' + c.id + '" ' + (w.classIds.indexOf(c.id) > -1 ? 'checked' : '') + '>' + esc(c.name) + '（' + c.count + ' 人）</label>';
    }).join('') + '</div><div class="form-note">仅显示您负责的教学班。</div></div>' +
    '<div class="field full"><label>知识点<i>*</i></label><div class="form-note mb8">编号为展示顺序；每个知识点下方显示可用题量。已选 <b id="wizKpCount">' + w.kpIds.length + '</b> 个。</div>' +
    '<div class="kp-grid">' + DB.kps.map(function (k) {
      var total = DB.questions.filter(function (q) { return q.kpId === k.id; }).length;
      var on = w.kpIds.indexOf(k.id) > -1;
      return '<button class="kp-chip ' + (on ? 'on' : '') + '" data-act="toggleKp" data-id="' + k.id + '">' +
        '<span class="box">' + (on ? icon('check2') : '') + '</span><span class="grow"><b>' + esc(k.name) + '</b><small>' + k.code + '</small></span>' +
        '<span class="cnt">' + total + ' 题</span></button>';
    }).join('') + '</div></div></div></div>' +
    '<div class="modal-foot" style="border-radius:0 0 12px 12px">' +
    '<span class="small muted" style="margin-right:auto">' + icon('info') + ' 组卷范围：当前课程 + 选中知识点 + 启用题库</span>' +
    '<button class="btn btn-primary" data-act="wizNext">下一步' + icon('arrow') + '</button></div></div>';
}
function wizStep2() {
  var w = S.wizard;
  var types = [
    { key: 'single', label: '单选题' },
    { key: 'multi', label: '多选题' },
    { key: 'judge', label: '判断题' }
  ];
  var totalQ = w.counts.single + w.counts.multi + w.counts.judge;
  var totalScore = w.counts.single * w.scores.single + w.counts.multi * w.scores.multi + w.counts.judge * w.scores.judge;
  return '<div class="card"><div class="card-head"><h3>组卷参数</h3><span class="sub">当前共 ' + totalQ + ' 题 · 满分 ' + totalScore + ' 分</span></div><div class="card-body">' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>题型</th><th style="width:160px">题量</th><th style="width:160px">每题分值</th><th>小计</th></tr></thead><tbody>' +
    types.map(function (t) {
      return '<tr><td class="cell-main">' + t.label + '</td>' +
        '<td><input class="input" type="number" min="0" max="50" style="width:100px" data-wiz="count" data-type="' + t.key + '" value="' + w.counts[t.key] + '"></td>' +
        '<td><input class="input" type="number" min="1" max="100" style="width:100px" data-wiz="score" data-type="' + t.key + '" value="' + w.scores[t.key] + '"></td>' +
        '<td class="num">' + (w.counts[t.key] * w.scores[t.key]) + ' 分</td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="form-grid mt16">' +
    '<div class="field"><label>作答时长（分钟）<i>*</i></label><input class="input" type="number" min="5" max="180" data-wiz="duration" value="' + w.duration + '"></div>' +
    '<div class="field"><label>作答次数</label><select class="select" data-wiz="attempts">' +
    '<option value="1" ' + (w.attempts === 1 ? 'selected' : '') + '>仅 1 次（默认）</option>' +
    '<option value="2" ' + (w.attempts === 2 ? 'selected' : '') + '>最多 2 次</option></select></div>' +
    '<div class="field"><label>开放时间<i>*</i></label><input class="input" type="datetime-local" data-wiz="start" value="' + w.start + '"></div>' +
    '<div class="field"><label>截止时间<i>*</i></label><input class="input" type="datetime-local" data-wiz="end" value="' + w.end + '"></div>' +
    '<div class="field"><label>答案展示策略</label><select class="select" data-wiz="policy">' +
    '<option value="afterSubmit" ' + (w.policy === 'afterSubmit' ? 'selected' : '') + '>提交后立即展示</option>' +
    '<option value="afterEnd" ' + (w.policy === 'afterEnd' ? 'selected' : '') + '>截止后展示</option>' +
    '<option value="never" ' + (w.policy === 'never' ? 'selected' : '') + '>不展示标准答案</option></select></div>' +
    '<div class="field"><label>题目顺序</label><select class="select" data-wiz="shuffle">' +
    '<option value="1" ' + (w.shuffle ? 'selected' : '') + '>随机打乱</option>' +
    '<option value="0" ' + (!w.shuffle ? 'selected' : '') + '>固定顺序</option></select></div>' +
    '</div>' +
    '<div class="alert info mt16">' + icon('info') + '<div>系统将按“当前课程 + 选中知识点 + 指定题型 + 启用状态”随机抽题，同一份试卷不重复。若题量不足会明确提示缺口，不会静默降题。</div></div>' +
    '</div><div class="modal-foot" style="border-radius:0 0 12px 12px;justify-content:space-between">' +
    '<button class="btn" data-act="wizBack">' + icon('arrowLeft') + '上一步</button>' +
    '<button class="btn btn-primary" data-act="wizGenerate">' + icon('spark') + '生成试卷</button></div></div>';
}
function wizStep3() {
  var w = S.wizard;
  var paper = w.paper || [];
  var totalScore = paper.reduce(function (a, it) { return a + it.score; }, 0);
  var html = '<div class="card"><div class="card-head"><h3>试卷预览</h3><span class="sub">' + paper.length + ' 题 · 满分 ' + totalScore + ' 分</span>' +
    '<div class="right row"><button class="btn btn-sm" data-act="wizRegenerate">' + icon('refresh') + '重新随机</button></div></div><div class="card-body">';
  if (w.error) html += '<div class="alert danger mb16">' + icon('alert') + '<div>' + w.error + '</div></div>';
  html += '<div class="alert warn mb16">' + icon('alert') + '<div>发布后将冻结题目、选项、答案和知识点映射快照；题库后续修改不会影响本试卷。</div></div>';
  html += '<div class="table-wrap"><table class="tb"><thead><tr><th style="width:46px">#</th><th>题目</th><th>知识点</th><th>题型</th><th>答案</th><th>分值</th><th></th></tr></thead><tbody>' +
    paper.map(function (it, i) {
      var q = QBY(it.qid);
      var kp = KPBY(q.kpId);
      return '<tr><td class="muted num">' + (i + 1) + '</td><td style="max-width:420px">' + esc(q.stem) + '</td>' +
        '<td class="muted small">' + esc(kp.name) + '</td><td>' + tag(TYPE_LABEL[q.type], TYPE_CLS[q.type]) + '</td>' +
        '<td><b>' + q.answer + '</b></td><td class="num">' + it.score + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="swapQ" data-id="' + q.id + '">' + icon('refresh') + '换一题</button></td></tr>';
    }).join('') + '</tbody></table></div></div>' +
    '<div class="modal-foot" style="border-radius:0 0 12px 12px;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
    '<button class="btn" data-act="wizBack">' + icon('arrowLeft') + '上一步</button>' +
    '<div class="row right"><span class="small muted">发布至：' + DB.classes.filter(function (c) { return w.classIds.indexOf(c.id) > -1; }).map(function (c) { return c.name; }).join('、') + '</span>' +
    '<button class="btn btn-primary" data-act="wizPublish" ' + (w.error || !paper.length ? 'disabled' : '') + '>' + icon('check2') + '确认发布</button></div></div></div>';
  return html;
}

/* ---------------- 我的试卷 ---------------- */
function viewTPapers() {
  var list = myPapers().filter(function (p) {
    if (S.paperFilter === 'all') return true;
    if (S.paperFilter === 'draft') return p.status === 'draft';
    return paperStatus(p).key === S.paperFilter;
  });
  var html = pageHead('我的试卷', '仅展示本人发布或参与创建的试卷',
    '<button class="btn btn-primary" data-act="newWizard">' + icon('plus') + '创建测试</button>');

  html += '<div class="card"><div class="card-head"><h3>试卷列表</h3><span class="sub">共 ' + myPapers().length + ' 份</span>' +
    '<select class="select right" style="width:130px" data-select="paperFilter">' +
    ['all,全部状态', 'ongoing,进行中', 'upcoming,未开始', 'ended,已结束', 'draft,草稿'].map(function (o) {
      var v = o.split(',')[0];
      return '<option value="' + v + '" ' + (S.paperFilter === v ? 'selected' : '') + '>' + o.split(',')[1] + '</option>';
    }).join('') + '</select></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>试卷名称</th><th>教学班</th><th>题量</th><th>满分</th><th>开放时间</th><th>完成情况</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
    (list.length ? list.map(function (p) {
      var perf = perfFor(p);
      return '<tr><td class="cell-main">' + esc(p.name) + '<div class="cell-sub">创建于 ' + fmtDate(p.publishedAt || p.startAt) + '</div></td>' +
        '<td class="muted">' + esc(p.className) + '</td><td class="num">' + p.items.length + '</td><td class="num">' + paperTotal(p) + '</td>' +
        '<td class="small muted">' + fmtDT(p.startAt) + '<div>至 ' + fmtDT(p.endAt) + '</div></td>' +
        '<td><span class="small">' + perf.completed + ' / ' + perf.expected + '</span></td><td>' + statusTag(p) + '</td>' +
        '<td><div class="actions"><button class="btn btn-sm btn-ghost" data-act="viewPaper" data-id="' + p.id + '">' + icon('eye') + '查看</button>' +
        (paperStatus(p).key === 'ongoing' ? '<button class="btn btn-sm btn-ghost" data-act="endPaper" data-id="' + p.id + '">结束</button>' : '') +
        '<button class="btn btn-sm btn-ghost" data-act="setStatsPaper" data-id="' + p.id + '">' + icon('chart') + '统计</button>' +
        '<button class="btn btn-sm btn-danger" data-act="deleteEntity" data-kind="paper" data-id="' + esc(p.id) + '">' + icon('trash') + '删除</button></div></td></tr>';
    }).join('') : '<tr><td colspan="8">' + emptyHTML('暂无试卷', '点击右上角创建测试。', 'file') + '</td></tr>') +
    '</tbody></table></div></div>';
  return html;
}

/* ---------------- 测试进度 ---------------- */
function viewTProgress() {
  var papers = myPapers();
  if (!papers.length) {
    return pageHead('测试进度', '跟踪学生提交情况与完成率') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('暂无试卷', '创建并发布测试后，这里会显示学生提交进度。', 'file') +
      '</div></div>';
  }
  var p = PAPER(S.progressPaper) || papers[0];
  if (papers.every(function (x) { return x.id !== p.id; })) p = papers[0];
  S.progressPaper = p.id;
  var perf = perfFor(p);
  var rate = pct(perf.completed, perf.expected);
  var rows = perf.rows.slice(0, 14);
  var html = pageHead('测试进度', '跟踪学生提交情况与完成率',
    '<select class="select" style="width:210px" data-select="progressPaper">' +
    papers.map(function (x) { return '<option value="' + x.id + '" ' + (p.id === x.id ? 'selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
    '</select><button class="btn btn-soft" data-act="remind" data-id="' + p.id + '">' + icon('clock') + '提醒未提交</button>');

  html += '<div class="card"><div class="card-body row" style="gap:28px;flex-wrap:wrap">' +
    donutHTML(rate, '完成率', rate >= 90 ? 'green' : '') +
    '<div class="grow" style="min-width:260px"><div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="small muted">已提交 / 应参加</span><b>' + perf.completed + ' / ' + perf.expected + '</b></div>' +
    '<div class="progress ' + (rate >= 90 ? 'green' : '') + '"><i style="width:' + rate + '%"></i></div>' +
    '<div class="row mt16" style="gap:26px;flex-wrap:wrap"><div><div class="small muted">未提交</div><b style="font-size:19px">' + (perf.expected - perf.completed) + '</b></div>' +
    '<div><div class="small muted">平均分</div><b style="font-size:19px">' + perf.avg + '</b></div>' +
    '<div><div class="small muted">最高 / 最低</div><b style="font-size:19px">' + perf.max + ' / ' + perf.min + '</b></div>' +
    '<div><div class="small muted">开放时间</div><b class="small">' + fmtDT(p.startAt) + ' — ' + fmtDT(p.endAt) + '</b></div></div></div></div></div>';

  html += '<div class="card mt16"><div class="card-head"><h3>学生提交明细</h3><span class="sub">先展示前 14 条，完整数据可导出</span>' +
    '<button class="btn btn-sm btn-ghost right" data-act="export" data-kind="students" data-paper="' + p.id + '">' + icon('download') + '导出明细</button></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>学号</th><th>姓名</th><th>状态</th><th>提交时间</th><th>得分</th><th>表现等级</th><th>操作</th></tr></thead><tbody>' +
    rows.map(function (r) {
      var lv = r.score == null ? null : levelOf(pct(r.score, perf.total));
      return '<tr><td class="muted num">' + r.student.no + '</td><td class="cell-main">' + esc(r.student.name) + '</td>' +
        '<td>' + (r.score == null ? tag('未提交', 'amber') : tag('已完成', 'green')) + '</td>' +
        '<td class="small muted">' + fmtDT(r.submittedAt) + '</td><td class="num">' + (r.score == null ? '—' : '<b>' + r.score + '</b>') + '</td>' +
        '<td>' + (lv ? tag(lv.label, lv.cls) : '—') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="viewStudentReport" data-sid="' + r.student.id + '" data-paper="' + p.id + '">' + icon('spark') + '报告</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';
  return html;
}

/* ---------------- 班级统计 ---------------- */
function viewTStats() {
  var papers = myPapers();
  if (!papers.length) {
    return pageHead('班级统计', '数据权限限定为本人教学班') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('暂无试卷', '创建并发布测试后，这里会显示成绩分布与知识点统计。', 'chart') +
      '</div></div>';
  }
  var p = PAPER(S.statPaper) || papers[0];
  if (papers.every(function (x) { return x.id !== p.id; })) p = papers[0];
  S.statPaper = p.id;
  var className = DB.classes.filter(function (c) { return p.classIds.indexOf(c.id) > -1; }).map(function (c) { return c.name; }).join('、') || '我的教学班';
  var perf = perfFor(p);
  var totalQ = perf.total;
  var kpStats = DB.kpAvg.slice(0, 10).map(function (k, i) {
    var base = p.id === 'p1' ? k.avg : clamp(k.avg + (hashStr(p.id + k.name) % 15) - 7, 40, 98);
    return { name: k.name, rate: base, count: 4 };
  });
  var questions = paperQuestions(p);
  var qStats = questions.map(function (q, i) {
    var acc = p.id === 'p1' && DB.qAccuracy[i] ? DB.qAccuracy[i].accuracy : 45 + (hashStr(p.id + q.id) % 50);
    return { q: q, acc: clamp(acc, 20, 98) };
  });
  var completedRows = perf.rows.filter(function (r) { return r.score != null; });
  var html = pageHead('班级统计', className + ' · 数据权限限定为本人教学班',
    '<select class="select" style="width:210px" data-select="statPaper">' +
    papers.map(function (x) { return '<option value="' + x.id + '" ' + (p.id === x.id ? 'selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' +
    '<button class="btn" data-act="export" data-kind="classSummary">' + icon('download') + '导出统计</button>');

  if (!perf.scores.length) {
    return html + '<div class="card"><div class="card-body">' + emptyHTML('暂无作答数据', '该试卷尚未开始或还没有学生提交。', 'chart') + '</div></div>';
  }

  html += '<div class="stats">' +
    statCard('完成率', pct(perf.completed, perf.expected) + '%', 'chart', 'green', perf.completed + ' / ' + perf.expected + ' 人') +
    statCard('平均分', perf.avg, 'target', '', '满分 ' + totalQ + ' 分') +
    statCard('最高分', perf.max, 'check', 'purple') +
    statCard('最低分', perf.min, 'alert', 'amber') +
    '</div>';

  html += '<div class="grid-2"><div class="card"><div class="card-head"><h3>成绩分布</h3><span class="sub">按分数段统计人数</span></div><div class="card-body">' +
    '<div class="hbars">' + perf.buckets.map(function (b) {
      var max = Math.max.apply(null, perf.buckets.map(function (x) { return x.count; })) || 1;
      return '<div class="hbar-col"><div class="hb" style="height:' + Math.max(4, b.count / max * 100) + '%"><span>' + b.count + '</span></div><div class="cap">' + b.label + '</div></div>';
    }).join('') + '</div></div></div>' +
    '<div class="card"><div class="card-head"><h3>知识点平均得分率</h3><span class="sub">按主知识点计分</span></div><div class="card-body">' +
    barsHTML(kpStats) + '</div></div></div>';

  html += '<div class="card mt16"><div class="card-head"><h3>学生明细</h3><span class="sub">展示前 10 条</span>' +
    '<button class="btn btn-sm btn-ghost right" data-act="export" data-kind="students" data-paper="' + p.id + '">' + icon('download') + '导出全部</button></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>学号</th><th>姓名</th><th>得分</th><th>正确题数</th><th>表现等级</th><th>提交时间</th><th>操作</th></tr></thead><tbody>' +
    completedRows.slice(0, 10).map(function (r) {
      var lv = levelOf(pct(r.score, totalQ));
      return '<tr><td class="muted num">' + r.student.no + '</td><td class="cell-main">' + esc(r.student.name) + '</td>' +
        '<td class="num"><b>' + r.score + '</b></td><td class="num">' + Math.round(r.score / (totalQ / p.items.length)) + ' / ' + p.items.length + '</td>' +
        '<td>' + tag(lv.label, lv.cls) + '</td><td class="small muted">' + fmtDT(r.submittedAt) + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="viewStudentReport" data-sid="' + r.student.id + '" data-paper="' + p.id + '">' + icon('spark') + '查看报告</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  html += '<div class="card mt16"><div class="card-head"><h3>试题分析</h3><span class="sub">每题正确率</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>#</th><th>题干</th><th>题型</th><th>知识点</th><th>正确率</th></tr></thead><tbody>' +
    qStats.map(function (s, i) {
      var color = s.acc >= 80 ? 'green' : s.acc >= 60 ? '' : 'red';
      return '<tr><td class="muted num">' + (i + 1) + '</td><td style="max-width:400px">' + esc(s.q.stem) + '</td>' +
        '<td>' + tag(TYPE_LABEL[s.q.type], TYPE_CLS[s.q.type]) + '</td><td class="muted small">' + esc(KPBY(s.q.kpId).name) + '</td>' +
        '<td><div class="progress-row" style="min-width:140px"><div class="progress ' + color + '"><i style="width:' + s.acc + '%"></i></div><b>' + s.acc + '%</b></div></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  return html;
}

/* ---------------- 学生报告 ---------------- */
function viewTReports() {
  var papers = myPapers();
  if (!papers.length) {
    return pageHead('学生报告', '基于真实作答数据的知识点诊断与学习建议') +
      '<div class="card"><div class="card-body">' +
      emptyHTML('暂无试卷', '创建并发布测试后，这里会按试卷生成学生诊断报告。', 'spark') +
      '</div></div>';
  }
  var p = PAPER(S.reportPaper) || papers[0];
  if (papers.every(function (x) { return x.id !== p.id; })) p = papers[0];
  S.reportPaper = p.id;
  var perf = perfFor(p);
  var completed = perf.rows.filter(function (r) { return r.score != null; });
  var avg = completed.length ? Math.round(completed.reduce(function (a, r) { return a + r.score; }, 0) / completed.length * 10) / 10 : 0;
  var html = pageHead('学生报告', '基于真实作答数据的知识点诊断与学习建议',
    '<select class="select" style="width:210px" data-select="reportPaper">' +
    papers.map(function (x) { return '<option value="' + x.id + '" ' + (p.id === x.id ? 'selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') +
    '</select><button class="btn" data-act="export" data-kind="students" data-paper="' + p.id + '">' + icon('download') + '导出报告清单</button>');

  html += '<div class="alert info mb16">' + icon('info') +
    '<div>AI 报告只负责组织语言、解释趋势与生成建议，分数、错题和知识点表现均来自系统计算；题量过少时会提示证据有限。</div></div>';

  html += '<div class="stats">' +
    statCard('已生成报告', completed.length + '<small>份</small>', 'spark', 'purple') +
    statCard('班级平均分', avg, 'target', '') +
    statCard('待生成', Math.max(0, perf.expected - completed.length) + '<small>份</small>', 'clock', 'amber') +
    statCard('覆盖率', pct(completed.length, perf.expected) + '%', 'chart', 'green') +
    '</div>';

  html += '<div class="card"><div class="card-head"><h3>报告列表</h3><span class="sub">' + esc(p.name) + '</span></div>';
  if (!completed.length) {
    return html + '<div class="card-body">' + emptyHTML('暂无作答数据', '该试卷尚未开始或还没有学生提交。', 'spark') + '</div></div>';
  }
  html += '<div class="table-wrap"><table class="tb"><thead><tr><th>学号</th><th>姓名</th><th>得分</th><th>整体表现</th><th>薄弱知识点</th><th>报告状态</th><th>操作</th></tr></thead><tbody>' +
    completed.slice(0, 15).map(function (r) {
      var att = attemptOf(p.id, r.student.id) || pseudoAttempt(r.student, p.id, r.score);
      var rep = buildReport(att);
      var lv = levelOf(pct(r.score, perf.total));
      var weak = rep.kps.filter(function (k) { return k.rate < 70; }).slice(0, 2).map(function (k) { return k.name; }).join('、') || '—';
      return '<tr><td class="muted num">' + r.student.no + '</td><td class="cell-main">' + esc(r.student.name) + '</td>' +
        '<td class="num"><b>' + r.score + '</b></td><td>' + tag(lv.label, lv.cls) + '</td>' +
        '<td class="muted small">' + esc(weak) + '</td><td>' + tag('已生成', 'green') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="viewStudentReport" data-sid="' + r.student.id + '" data-paper="' + p.id + '">' + icon('eye') + '查看报告</button></td></tr>';
    }).join('') + '</tbody></table></div>' +
    '<div class="table-foot"><span>展示前 15 条 · 共 ' + completed.length + ' 份</span><span class="right small muted">报告由 AI 生成，数据可追溯至作答记录</span></div></div>';
  return html;
}

function studentReportModal(sid, paperId) {
  var s = STUDENT(sid);
  if (!s) return;
  var p = PAPER(paperId || 'p1');
  if (!p) p = myPapers()[0] || null;
  if (!p) { toast('暂无可查看的试卷', 'err'); return; }
  var idx = DB.students.indexOf(s);
  var score = p.id === 'p1' && DB.p1Scores ? DB.p1Scores[idx] : null;
  if (score == null) {
    var perf = perfFor(p);
    var row = perf.rows.filter(function (r) { return r.student.id === sid; })[0];
    score = row ? row.score : null;
  }
  if (score == null) { toast('该学生暂无作答数据', 'err'); return; }
  var att = attemptOf(p.id, sid) || pseudoAttempt(s, p.id, score);
  var rep = buildReport(att);
  var body = '<div class="report-head" style="box-shadow:none;margin-bottom:16px"><div class="rh-ico">' + icon('spark') + '</div>' +
    '<div><h2>' + esc(s.name) + ' · 学习诊断报告</h2><div class="rh-meta"><span>' + s.no + '</span><span>' + esc(p.name) + '</span><span>' + fmtDT(att.submittedAt) + '</span></div></div>' +
    '<div class="rh-level"><span class="small muted">整体表现</span><div class="lv" style="color:' + (rep.overall >= 85 ? 'var(--green)' : rep.overall >= 70 ? 'var(--primary)' : rep.overall >= 60 ? 'var(--amber)' : 'var(--red)') + '">' + rep.level.label + '</div></div></div>' +
    '<div class="row mb16" style="gap:24px;flex-wrap:wrap"><div><div class="small muted">得分</div><b style="font-size:24px">' + att.score + ' / ' + att.total + '</b></div>' +
    '<div><div class="small muted">正确率</div><b style="font-size:24px">' + rep.overall + '%</b></div>' +
    '<div><div class="small muted">答对题数</div><b style="font-size:24px">' + att.correctCount + ' / ' + p.items.length + '</b></div>' +
    '<div><div class="small muted">用时</div><b style="font-size:24px">' + att.timeUsed + ' 分钟</b></div></div>' +
    '<div class="report-text mb16">' + esc(rep.summary) + '</div>' +
    (rep.lowSample ? '<div class="alert warn mb16">' + icon('alert') + '<div>部分知识点题量较少，当前结论证据有限，仅供学习参考。</div></div>' : '') +
    '<div class="mb8"><b style="font-size:13px">知识点表现</b></div>' + barsHTML(rep.kps) +
    '<div class="mt16 mb8"><b style="font-size:13px">学习建议</b></div><div class="suggest-list">' +
    rep.suggestions.map(function (sg) {
      return '<div class="suggest-item"><span class="n"></span><div><b>' + esc(sg.title) + '：</b>' + esc(sg.text) + '</div></div>';
    }).join('') + '</div>';
  showModal(modalHead('学生诊断报告', 'AI 生成 · 数据来自作答记录') + '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button>' +
    '<button class="btn btn-soft" data-act="printReport">' + icon('print') + '打印 / 导出 PDF</button></div>', 'wide');
}

/* ---------------- 教师导出 ---------------- */
function viewTExport() {
  var html = pageHead('导出中心', '本人教学班数据与试卷导出');
  html += '<div class="alert info mb16">' + icon('info') + '<div>教师仅可导出本人教学班的数据与本人发布的试卷；导出行为会记录审计日志。</div></div>';
  html += '<div class="grid-3">' +
    exportCard('学生测试明细', '本人教学班学生的作答与得分', 'students', 'users', 'XLSX / CSV') +
    exportCard('知识点统计', '本班各知识点平均得分率', 'kps', 'chart', 'XLSX') +
    exportCard('班级测试汇总', '完成率、分数段与试卷信息', 'classSummary', 'school', 'XLSX / PDF') +
    '</div>';
  html += '<div class="card mt16"><div class="card-head"><h3>最近导出</h3></div><div class="table-wrap"><table class="tb">' +
    '<thead><tr><th>内容</th><th>时间</th></tr></thead><tbody>' +
    DB.logs.filter(function (l) { return l.action === '导出' && l.operator === user.name; }).sort(function (a, b) { return new Date(b.time) - new Date(a.time); }).slice(0, 4).map(function (l) {
      return '<tr><td class="muted">' + esc(l.detail) + '</td><td class="small muted">' + fmtDT(l.time) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
  return html;
}
