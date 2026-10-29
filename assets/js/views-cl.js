/* =========================================================
   课程负责人端页面
   ========================================================= */

function greeting() {
  var h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '上午好';
  if (h < 18) return '下午好';
  return '晚上好';
}

function viewCLDashboard() {
  var qCount = DB.questions.length;
  var kpCount = DB.kps.length;
  var teacherCount = DB.teachers.length;
  var courseCount = DB.courses.length;
  var firstCourse = (DB.courses[0] && DB.courses[0].name) || '课程';
  var ongoing = DB.papers.filter(function (p) { return paperStatus(p).key === 'ongoing'; }).length;
  var weak = DB.kpAvg.slice().sort(function (a, b) { return a.avg - b.avg; }).slice(0, 5);
  var recent = DB.papers.slice().sort(function (a, b) {
    return new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0);
  }).slice(0, 4);

  var html = pageHead('工作台', '课程级测评数据与教学资源概览', 
    '<button class="btn" data-act="openAddCourse">' + icon('plus') + '新建课程</button>' +
    '<button class="btn btn-primary" data-act="go" data-to="cl/stats">' + icon('chart') + '课程统计</button>');

  html += '<div class="welcome"><h2>' + greeting() + '，' + esc(user.name) + '老师</h2>' +
    '<p>当前负责《' + esc(firstCourse) + '》等 ' + courseCount + ' 门课程。今日有 ' + ongoing + ' 场测评进行中，建议关注各教学班的完成情况与薄弱知识点分布。</p>' +
    '<div class="welcome-actions"><button class="btn solid" data-act="go" data-to="cl/kps">查看知识点覆盖</button>' +
    '<button class="btn" data-act="go" data-to="cl/papers">试卷中心</button></div></div>';

  html += '<div class="stats">' +
    statCard('课程数量', courseCount + '<small>门</small>', 'book', '') +
    statCard('知识点', kpCount + '<small>个</small>', 'layers', 'purple', '全部为平级知识点') +
    statCard('题库总量', qCount + '<small>题</small>', 'database', 'green', '单选 / 多选 / 判断') +
    statCard('任课教师', teacherCount + '<small>人</small>', 'users', 'amber', '覆盖 ' + DB.classes.length + ' 个教学班') +
    '</div>';

  html += '<div class="grid-2-1">' +
    '<div class="card"><div class="card-head"><h3>最近测评</h3><span class="sub">按发布时间排序</span>' +
    '<div class="right"><button class="btn btn-sm btn-ghost" data-act="go" data-to="cl/papers">全部' + icon('arrow') + '</button></div></div>' +
    '<div class="card-body flush"><div class="table-wrap"><table class="tb"><thead><tr><th>测评名称</th><th>教师 / 班级</th><th>题量</th><th>状态</th><th>发布时间</th></tr></thead><tbody>' +
    recent.map(function (p) {
      return '<tr><td class="cell-main">' + esc(p.name) + '<div class="cell-sub">' + esc(p.teacherName) + ' · ' + esc(p.className) + '</div></td>' +
        '<td>' + esc(p.teacherName) + '<div class="cell-sub">' + esc(p.className) + '</div></td>' +
        '<td class="num">' + p.items.length + '</td><td>' + statusTag(p) + '</td><td class="muted small">' + fmtDT(p.publishedAt) + '</td></tr>';
    }).join('') + '</tbody></table></div></div></div>' +

    '<div class="card"><div class="card-head"><h3>课程薄弱知识点</h3><span class="sub">按平均得分率</span></div><div class="card-body">' +
    barsHTML(weak.map(function (k) { return { name: k.name, rate: k.avg }; })) +
    '<div class="mt16"><button class="btn btn-sm btn-soft" data-act="go" data-to="cl/stats">查看完整统计' + icon('arrow') + '</button></div>' +
    '</div></div></div>';

  html += '<div class="grid-1-2 mt16">' +
    '<div class="card"><div class="card-head"><h3>教学班概览</h3><button class="btn btn-sm btn-ghost" data-act="go" data-to="cl/classes">全部' + icon('arrow') + '</button></div>' +
    '<div class="card-body"><div class="bar-list">' +
    DB.classSummaries.map(function (c) {
      return '<div class="bar-item"><div class="bar-top"><b>' + c.className + '</b><span>' + c.teacher + ' · ' + c.completed + '/' + c.expected + '</span></div>' +
        '<div class="progress"><i style="width:' + pct(c.completed, c.expected) + '%"></i></div></div>';
    }).join('') + '</div></div></div>' +
    '<div class="card"><div class="card-head"><h3>题库题型分布</h3><span class="sub">共 ' + qCount + ' 题</span></div><div class="card-body">' +
    questionTypeBars() + '</div></div></div>';

  return html;
}

function questionTypeBars() {
  var types = [
    { key: 'single', label: '单选题' },
    { key: 'multi', label: '多选题' },
    { key: 'judge', label: '判断题' }
  ];
  var total = DB.questions.length || 1;
  return '<div class="bar-list">' + types.map(function (t) {
    var c = DB.questions.filter(function (q) { return q.type === t.key; }).length;
    return '<div class="bar-item"><div class="bar-top"><b>' + t.label + '</b><span>' + c + ' 题 · ' + pct(c, total) + '%</span></div>' +
      '<div class="progress"><i style="width:' + pct(c, total) + '%"></i></div></div>';
  }).join('') + '</div>';
}

function viewCLCourses() {
  var html = pageHead('课程管理', '维护课程基本信息、学期与负责人',
    '<button class="btn btn-primary" data-act="openAddCourse">' + icon('plus') + '新建课程</button>');

  html += '<div class="alert info mb16">' + icon('info') + '<div>同一课程可关联多个教师与多个教学班；课程停用后不允许新建测评，但历史试卷、作答与统计数据仍可查询。</div></div>';

  html += '<div class="course-cards">' + DB.courses.map(function (c, i) {
    var kpCount = c.id === 'c1' ? DB.kps.length : 16;
    return '<div class="course-card"><div class="cc-top"><div class="course-ico ' + (i ? 'green' : '') + '">' + icon('book') + '</div>' +
      '<div class="grow"><h3>' + esc(c.name) + '</h3><div class="code">' + esc(c.code) + '</div></div>' +
      tag(c.status === 'active' ? '进行中' : '已停用', c.status === 'active' ? 'green' : 'gray') + '</div>' +
      '<div class="cc-meta"><div><b>' + kpCount + '</b>知识点</div><div><b>' + (c.id === 'c1' ? DB.teachers.length : 2) + '</b>教师</div>' +
      '<div><b>' + (c.id === 'c1' ? 3 : 2) + '</b>教学班</div></div>' +
      '<div class="cc-foot"><span class="small muted">' + esc(c.term) + ' · 负责人 ' + esc(c.owner) + '</span>' +
      '<button class="btn btn-sm btn-soft" data-act="go" data-to="cl/kps">查看知识点</button></div></div>';
  }).join('') + '</div>';

  html += '<div class="card mt16"><div class="card-head"><h3>课程列表</h3><span class="sub">共 ' + DB.courses.length + ' 门</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>课程名称</th><th>课程编码</th><th>学期</th><th>负责人</th><th>知识点</th><th>状态</th></tr></thead><tbody>' +
    DB.courses.map(function (c) {
      return '<tr><td class="cell-main">' + esc(c.name) + '</td><td class="muted">' + esc(c.code) + '</td><td class="small">' + esc(c.term) + '</td>' +
        '<td>' + esc(c.owner) + '</td><td class="num">' + (c.id === 'c1' ? DB.kps.length : 16) + '</td>' +
        '<td>' + tag(c.status === 'active' ? '启用' : '停用', c.status === 'active' ? 'green' : 'gray') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';

  return html;
}

function viewCLKps() {
  var html = pageHead('知识点管理', '单层平级知识点模型 · 不设置父子层级',
    '<button class="btn" data-act="openImport" data-kind="kp">' + icon('upload') + '批量导入</button>' +
    '<button class="btn btn-primary" data-act="openAddKp">' + icon('plus') + '新增知识点</button>');

  html += '<div class="alert info mb16">' + icon('info') +
    '<div><b>关键约束：</b>一门课程的知识点全部为同一级别。例如本课程包含 28 个知识点，系统直接维护 28 条平级记录，不设置“一级 / 二级 / 三级”父子关系；顺序号仅用于展示排序。</div></div>';

  html += '<div class="stats">' +
    statCard('知识点总数', DB.kps.length + '<small>个</small>', 'layers', '') +
    statCard('启用中', DB.kps.filter(function (k) { return k.status === 'enabled'; }).length + '<small>个</small>', 'check', 'green') +
    statCard('关联题目', DB.questions.length + '<small>题</small>', 'database', 'purple') +
    statCard('题量不足', '0<small>个</small>', 'alert', 'amber', '每个知识点均 ≥ 3 题') +
    '</div>';

  html += '<div class="card"><div class="card-head"><h3>知识点列表</h3><span class="sub">28 个平级知识点</span></div><div class="table-wrap">' +
    '<table class="tb"><thead><tr><th>编号</th><th>知识点名称</th><th>说明</th><th>单选</th><th>多选</th><th>判断</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
    DB.kps.map(function (k) {
      var c = { single: 0, multi: 0, judge: 0 };
      DB.questions.forEach(function (q) { if (q.kpId === k.id) c[q.type]++; });
      return '<tr><td class="muted num">' + k.code + '</td><td class="cell-main">' + esc(k.name) + '</td>' +
        '<td class="muted small" style="max-width:300px">' + esc(k.desc) + '</td>' +
        '<td class="num">' + c.single + '</td><td class="num">' + c.multi + '</td><td class="num">' + c.judge + '</td>' +
        '<td>' + tag('启用', 'green') + '</td><td><button class="btn btn-sm btn-ghost" data-act="go" data-to="cl/questions">查看题目</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  return html;
}

/* ---------------- 题库 ---------------- */
function filterQuestions() {
  var f = S.q;
  return DB.questions.filter(function (q) {
    if (f.kp && q.kpId !== f.kp) return false;
    if (f.type && q.type !== f.type) return false;
    if (f.kw) {
      var kp = KPBY(q.kpId);
      var text = q.stem + ' ' + kp.name + ' ' + q.id;
      if (text.toLowerCase().indexOf(f.kw.toLowerCase()) < 0) return false;
    }
    return true;
  });
}
var TYPE_LABEL = { single: '单选题', multi: '多选题', judge: '判断题' };
var TYPE_CLS = { single: 'blue', multi: 'purple', judge: 'amber' };

function questionTableHTML() {
  var list = filterQuestions();
  var pageSize = 10;
  var pages = Math.max(1, Math.ceil(list.length / pageSize));
  var page = clamp(S.q.page, 1, pages);
  var slice = list.slice((page - 1) * pageSize, page * pageSize);
  if (!list.length) return emptyHTML('没有找到题目', '调整筛选条件，或新增一道题目。', 'search');
  var html = '<div class="table-wrap"><table class="tb"><thead><tr><th>题目编号</th><th>题型</th><th>题干</th><th>知识点</th><th>难度</th><th>状态</th><th>操作</th></tr></thead><tbody>';
  html += slice.map(function (q) {
    var kp = KPBY(q.kpId);
    return '<tr><td class="muted num">' + q.id + '</td><td>' + tag(TYPE_LABEL[q.type], TYPE_CLS[q.type]) + '</td>' +
      '<td class="cell-main" style="max-width:420px">' + esc(q.stem.length > 46 ? q.stem.slice(0, 46) + '…' : q.stem) + '</td>' +
      '<td><span class="muted small">' + kp.code + '</span> ' + esc(kp.name) + '</td>' +
      '<td>' + tag(q.difficulty, q.difficulty === '易' ? 'green' : q.difficulty === '难' ? 'red' : 'gray') + '</td>' +
      '<td>' + tag('启用', 'green') + '</td>' +
      '<td><button class="btn btn-sm btn-ghost" data-act="viewQuestion" data-id="' + q.id + '">' + icon('eye') + '查看</button></td></tr>';
  }).join('');
  html += '</tbody></table></div><div class="table-foot"><span>共 ' + list.length + ' 题 · 第 ' + page + ' / ' + pages + ' 页</span>' +
    '<span class="right row"><button class="btn btn-sm" data-act="qPage" data-page="' + (page - 1) + '" ' + (page <= 1 ? 'disabled' : '') + '>上一页</button>' +
    '<button class="btn btn-sm" data-act="qPage" data-page="' + (page + 1) + '" ' + (page >= pages ? 'disabled' : '') + '>下一页</button></span></div>';
  return html;
}

function viewCLQuestions() {
  var counts = { single: 0, multi: 0, judge: 0 };
  DB.questions.forEach(function (q) { counts[q.type]++; });
  var html = pageHead('题库管理', '单选 / 多选 / 判断题 · 每题关联知识点',
    '<button class="btn" data-act="openImport" data-kind="question">' + icon('upload') + '批量导入</button>' +
    '<button class="btn btn-primary" data-act="openAddQuestion">' + icon('plus') + '新增题目</button>');

  html += '<div class="stats">' +
    statCard('题库总量', DB.questions.length + '<small>题</small>', 'database', '') +
    statCard('单选题', counts.single + '<small>题</small>', 'check', 'green') +
    statCard('多选题', counts.multi + '<small>题</small>', 'layers', 'purple') +
    statCard('判断题', counts.judge + '<small>题</small>', 'check2', 'amber') +
    '</div>';

  html += '<div class="card"><div class="card-body tight"><div class="filters">' +
    '<select class="select" style="width:200px" data-filter="qkp"><option value="">全部知识点</option>' +
    DB.kps.map(function (k) { return '<option value="' + k.id + '" ' + (S.q.kp === k.id ? 'selected' : '') + '>' + k.code + ' ' + esc(k.name) + '</option>'; }).join('') +
    '</select><select class="select" style="width:140px" data-filter="qtype"><option value="">全部题型</option>' +
    '<option value="single" ' + (S.q.type === 'single' ? 'selected' : '') + '>单选题</option>' +
    '<option value="multi" ' + (S.q.type === 'multi' ? 'selected' : '') + '>多选题</option>' +
    '<option value="judge" ' + (S.q.type === 'judge' ? 'selected' : '') + '>判断题</option></select>' +
    '<input class="input search" style="width:260px" placeholder="搜索题干 / 知识点" value="' + esc(S.q.kw) + '" data-input="qsearch">' +
    '<span class="small muted right">共 ' + DB.questions.length + ' 题 · 演示题库含自动生成示例题</span>' +
    '</div></div><div id="qTableWrap">' + questionTableHTML() + '</div></div>';

  return html;
}

/* ---------------- 教师管理 ---------------- */
function viewCLTeachers() {
  var html = pageHead('教师管理', '课程负责人统一创建教师账号并绑定教学班',
    '<button class="btn" data-act="openImport" data-kind="teacher">' + icon('upload') + '批量导入</button>' +
    '<button class="btn btn-primary" data-act="openAddTeacher">' + icon('plus') + '新增教师</button>');

  html += '<div class="alert info mb16">' + icon('info') +
    '<div>教师账号由课程负责人统一创建或批量导入，仅管理本课程范围内的教师绑定关系；如学校已有统一身份系统，可通过账号映射接入。</div></div>';

  html += '<div class="card"><div class="card-head"><h3>教师列表</h3><span class="sub">共 ' + DB.teachers.length + ' 人</span></div><div class="table-wrap">' +
    '<table class="tb"><thead><tr><th>工号</th><th>姓名</th><th>教学班</th><th>手机号</th><th>状态</th><th>操作</th></tr></thead><tbody>' +
    DB.teachers.map(function (t) {
      return '<tr><td class="muted num">' + t.no + '</td><td class="cell-main">' + esc(t.name) + '</td><td>' + esc(t.classes) + '</td>' +
        '<td class="muted">' + t.phone + '</td><td>' + tag('启用', 'green') + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="resetPwd" data-name="' + esc(t.name) + '" data-id="' + esc(t.id) + '">重置密码</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  return html;
}

/* ---------------- 教学班 ---------------- */
function viewCLClasses() {
  var html = pageHead('教学班总览', '查看课程下各教学班的规模与测评表现',
    '<button class="btn" data-act="go" data-to="cl/stats">' + icon('chart') + '课程统计</button>');

  html += '<div class="grid-3">' + DB.classes.map(function (c) {
    var sum = DB.classSummaries.filter(function (s) { return s.classId === c.id; })[0] || { expected: c.count, completed: c.count, avg: 76 };
    return '<div class="class-card"><div class="row"><h3>' + esc(c.name) + '</h3><span class="right tag blue">' + esc(c.term) + '</span></div>' +
      '<div class="cc-teacher">' + esc(c.teacherName) + '</div>' +
      '<div class="kpis"><div><b>' + c.count + '</b><span>学生</span></div><div><b>' + sum.completed + '</b><span>已提交</span></div>' +
      '<div><b>' + sum.avg + '</b><span>平均分</span></div></div>' +
      '<div class="mt12 progress-row"><span class="small muted">完成率</span><div class="progress"><i style="width:' + pct(sum.completed, sum.expected) + '%"></i></div><b>' + pct(sum.completed, sum.expected) + '%</b></div>' +
      '<div class="mt12"><button class="btn btn-sm btn-soft" data-act="viewClass" data-id="' + c.id + '">查看统计</button></div></div>';
  }).join('') + '</div>';

  html += '<div class="card mt16"><div class="card-head"><h3>教师与教学班对应关系</h3></div><div class="table-wrap">' +
    '<table class="tb"><thead><tr><th>教学班</th><th>任课教师</th><th>专业</th><th>学生人数</th><th>课程</th><th>状态</th></tr></thead><tbody>' +
    DB.classes.map(function (c) {
      return '<tr><td class="cell-main">' + esc(c.name) + '</td><td>' + esc(c.teacherName) + '</td><td class="muted">' + esc(c.major) + '</td>' +
        '<td class="num">' + c.count + '</td><td class="muted">Java程序设计</td><td>' + tag('进行中', 'green') + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';

  return html;
}

/* ---------------- 试卷中心 ---------------- */
function viewCLPapers() {
  var papers = DB.papers.filter(function (p) {
    return S.paperFilter === 'all' || p.status === S.paperFilter || paperStatus(p).key === S.paperFilter;
  });
  var html = pageHead('试卷中心', '查看全课程试卷、发布状态与归档情况',
    '<button class="btn" data-act="go" data-to="cl/export">' + icon('download') + '导出试卷</button>');

  html += '<div class="card"><div class="card-head"><h3>全部试卷</h3>' +
    '<select class="select right" style="width:130px" data-select="paperFilter">' +
    '<option value="all" ' + (S.paperFilter === 'all' ? 'selected' : '') + '>全部状态</option>' +
    '<option value="ongoing" ' + (S.paperFilter === 'ongoing' ? 'selected' : '') + '>进行中</option>' +
    '<option value="upcoming" ' + (S.paperFilter === 'upcoming' ? 'selected' : '') + '>未开始</option>' +
    '<option value="ended" ' + (S.paperFilter === 'ended' ? 'selected' : '') + '>已结束</option>' +
    '<option value="draft" ' + (S.paperFilter === 'draft' ? 'selected' : '') + '>草稿</option></select></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>试卷名称</th><th>教师</th><th>教学班</th><th>题量</th><th>满分</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead><tbody>' +
    (papers.length ? papers.map(function (p) {
      return '<tr><td class="cell-main">' + esc(p.name) + '</td><td>' + esc(p.teacherName) + '</td><td class="muted">' + esc(p.className) + '</td>' +
        '<td class="num">' + p.items.length + '</td><td class="num">' + paperTotal(p) + '</td><td>' + statusTag(p) + '</td>' +
        '<td class="muted small">' + fmtDT(p.publishedAt) + '</td>' +
        '<td><div class="actions"><button class="btn btn-sm btn-ghost" data-act="viewPaper" data-id="' + p.id + '">' + icon('eye') + '查看</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="exportPaper" data-id="' + p.id + '">' + icon('download') + '导出</button></div></td></tr>';
    }).join('') : '<tr><td colspan="8">' + emptyHTML('暂无符合条件的试卷', '切换筛选条件后再试。', 'file') + '</td></tr>') +
    '</tbody></table></div></div>';

  return html;
}

/* ---------------- 课程统计 ---------------- */
function viewCLStats() {
  var totalExpected = DB.classSummaries.reduce(function (a, c) { return a + c.expected; }, 0);
  var totalCompleted = DB.classSummaries.reduce(function (a, c) { return a + c.completed; }, 0);
  var avg = Math.round(DB.classSummaries.reduce(function (a, c) { return a + c.avg; }, 0) / DB.classSummaries.length * 10) / 10;
  var weak = DB.kpAvg.slice().sort(function (a, b) { return a.avg - b.avg; });
  var html = pageHead('课程统计', '课程整体与跨教学班横向分析',
    '<button class="btn" data-act="export" data-kind="classSummary">' + icon('download') + '导出统计</button>');

  html += '<div class="stats">' +
    statCard('整体完成率', pct(totalCompleted, totalExpected) + '%', 'chart', 'green', totalCompleted + ' / ' + totalExpected + ' 人次') +
    statCard('课程平均分', avg, 'target', '') +
    statCard('教学班', DB.classSummaries.length + '<small>个</small>', 'school', 'purple') +
    statCard('测评总人次', totalCompleted + '<small>人次</small>', 'users', 'amber') +
    '</div>';

  html += '<div class="card"><div class="card-head"><h3>教学班横向对比</h3><span class="sub">不进行教师“好 / 坏”排名</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>教学班</th><th>任课教师</th><th>应测人数</th><th>完成人数</th><th>完成率</th><th>平均分</th><th>最高分</th><th>最低分</th><th>操作</th></tr></thead><tbody>' +
    DB.classSummaries.map(function (c) {
      return '<tr><td class="cell-main">' + c.className + '</td><td>' + c.teacher + '</td><td class="num">' + c.expected + '</td>' +
        '<td class="num">' + c.completed + '</td><td><div class="progress-row" style="min-width:120px"><div class="progress"><i style="width:' + pct(c.completed, c.expected) + '%"></i></div><b>' + pct(c.completed, c.expected) + '%</b></div></td>' +
        '<td class="num cell-main">' + c.avg + '</td><td class="num">' + c.max + '</td><td class="num">' + c.min + '</td>' +
        '<td><button class="btn btn-sm btn-ghost" data-act="viewClass" data-id="' + c.classId + '">查看详情</button></td></tr>';
    }).join('') + '</tbody></table></div></div>';

  html += '<div class="grid-2 mt16"><div class="card"><div class="card-head"><h3>课程知识点薄弱分布</h3><span class="sub">按平均得分率升序</span></div><div class="card-body">' +
    barsHTML(weak.map(function (k) { return { name: k.name, rate: k.avg }; })) + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>各教学班平均分</h3></div><div class="card-body"><div class="hbars">' +
    DB.classSummaries.map(function (c) {
      return '<div class="hbar-col"><div class="hb" style="height:' + Math.round(clamp(c.avg, 10, 100) * 1.2) + 'px"><span>' + c.avg + '</span></div><div class="cap">' + c.className + '</div></div>';
    }).join('') + '</div></div></div></div>';

  return html;
}

function classDetailModal(cid) {
  var c = DB.classes.filter(function (x) { return x.id === cid; })[0];
  if (!c) return;
  var sum = DB.classSummaries.filter(function (x) { return x.classId === cid; })[0];
  if (!sum) return;
  var rate = pct(sum.completed, sum.expected);
  var body = '<div class="report-head" style="box-shadow:none;margin-bottom:16px"><div class="rh-ico">' + icon('school') + '</div>' +
    '<div><h2>' + esc(c.name) + '</h2><div class="rh-meta"><span>' + esc(c.teacherName) + '</span><span>' + esc(c.major) + '</span><span>' + esc(c.term) + '</span></div></div>' +
    '<div class="rh-level"><span class="small muted">本次完成率</span><div class="lv" style="color:var(--primary)">' + rate + '%</div></div></div>' +
    '<div class="row mb16" style="gap:28px;flex-wrap:wrap"><div><div class="small muted">应测人数</div><b style="font-size:23px">' + sum.expected + '</b></div>' +
    '<div><div class="small muted">完成人数</div><b style="font-size:23px">' + sum.completed + '</b></div>' +
    '<div><div class="small muted">平均分</div><b style="font-size:23px">' + sum.avg + '</b></div>' +
    '<div><div class="small muted">最高 / 最低</div><b style="font-size:23px">' + sum.max + ' / ' + sum.min + '</b></div></div>' +
    '<div class="progress-row"><span class="small muted" style="min-width:52px">完成情况</span><div class="progress green"><i style="width:' + rate + '%"></i></div><b>' + sum.completed + ' / ' + sum.expected + '</b></div>' +
    '<div class="alert info mt16">' + icon('info') + '<div>教学班详情用于教学改进与资源支持，不用于教师个人排名。历史数据保留原教学班快照。</div></div>';
  showModal(modalHead('教学班详情', '课程负责人视角 · ' + esc(c.term)) + '<div class="modal-body">' + body + '</div>' +
    '<div class="modal-foot"><button class="btn" data-act="closeModal">关闭</button>' +
    '<button class="btn btn-soft" data-act="export" data-kind="classSummary">' + icon('download') + '导出班级汇总</button></div>', 'wide');
}

/* ---------------- 导出中心 ---------------- */
function exportCard(title, desc, kind, iconName, meta) {
  return '<div class="card"><div class="card-body"><div class="row"><div class="stat-ico" style="position:static;background:#f3f6fd;color:#6b82ad;width:36px;height:36px;border-radius:9px">' + icon(iconName) + '</div>' +
    '<div class="grow"><b style="font-size:13.5px">' + title + '</b><div class="small muted">' + desc + '</div></div></div>' +
    '<div class="row mt12"><span class="tiny muted">' + meta + '</span><button class="btn btn-sm btn-soft right" data-act="export" data-kind="' + kind + '">' + icon('download') + '导出</button></div></div></div>';
}
function viewCLExport() {
  var html = pageHead('导出中心', '关键业务数据均可导出，满足教学归档与二次分析');
  html += '<div class="alert info mb16">' + icon('info') + '<div>导出文件带有课程、教学班、导出时间等元信息；涉及学生个人信息的导出会记录审计日志。</div></div>';
  html += '<div class="grid-3">' +
    exportCard('学生测试明细', '学号、姓名、提交时间、得分与知识点表现', 'students', 'users', 'XLSX / CSV') +
    exportCard('课程知识点统计', '各知识点平均得分率、参与人数与题量', 'kps', 'chart', 'XLSX') +
    exportCard('教学班汇总', '各教学班参与率与成绩概况', 'classSummary', 'school', 'XLSX / PDF') +
    exportCard('试卷（含答案）', '按试卷导出题目快照、答案与解析', 'papers', 'file', 'Word / PDF') +
    exportCard('题库全量', '题型、题干、选项、答案与知识点映射', 'questions', 'database', 'XLSX') +
    exportCard('审计日志', '关键管理操作与敏感导出记录', 'logs', 'shield', 'CSV') +
    '</div>';

  html += '<div class="card mt16"><div class="card-head"><h3>最近导出</h3></div><div class="table-wrap"><table class="tb">' +
    '<thead><tr><th>操作人</th><th>内容</th><th>时间</th></tr></thead><tbody>' +
    DB.logs.filter(function (l) { return l.action === '导出'; }).sort(function (a, b) { return new Date(b.time) - new Date(a.time); }).slice(0, 5).map(function (l) {
      return '<tr><td class="cell-main">' + esc(l.operator) + '</td><td class="muted">' + esc(l.detail) + '</td><td class="small muted">' + fmtDT(l.time) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
  return html;
}

/* ---------------- 审计日志 ---------------- */
function viewCLLogs() {
  var html = pageHead('审计日志', '账号、导入、题库、试卷与敏感导出操作留痕',
    '<button class="btn" data-act="export" data-kind="logs">' + icon('download') + '导出日志</button>');
  var colors = { '导入': 'blue', '题库': 'purple', '组卷': 'green', '导出': 'amber', '账号': 'red' };
  html += '<div class="card"><div class="card-head"><h3>操作记录</h3><span class="sub">共 ' + DB.logs.length + ' 条</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>时间</th><th>操作人</th><th>角色</th><th>操作</th><th>详情</th></tr></thead><tbody>' +
    DB.logs.slice().sort(function (a, b) { return new Date(b.time) - new Date(a.time); }).map(function (l) {
      return '<tr><td class="small muted nowrap">' + fmtFull(l.time) + '</td><td class="cell-main">' + esc(l.operator) + '</td>' +
        '<td class="muted small">' + esc(l.role) + '</td><td>' + tag(l.action, colors[l.action] || 'gray') + '</td>' +
        '<td class="muted small">' + esc(l.detail) + '</td></tr>';
    }).join('') + '</tbody></table></div></div>';
  return html;
}
