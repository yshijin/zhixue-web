/* =========================================================
   学生端页面：测试列表 / 在线作答 / 结果 / AI 报告
   ========================================================= */

function myClassPapers() {
  var cid = user.classId || 'c1';
  return DB.papers.filter(function (p) {
    if (p.ownerStudentId) return false;
    return p.classIds.indexOf(cid) > -1 && p.status !== 'draft';
  });
}

function viewSTests() {
  var papers = myClassPapers();
  var ongoing = papers.filter(function (p) { return paperStatus(p).key === 'ongoing'; });
  var upcoming = papers.filter(function (p) { return paperStatus(p).key === 'upcoming'; });
  var ended = papers.filter(function (p) { return paperStatus(p).key === 'ended' || paperStatus(p).key === 'archived'; });
  var myAttempts = attemptsOf();
  var avg = myAttempts.length ? Math.round(myAttempts.reduce(function (a, x) { return a + pct(x.score, x.total); }, 0) / myAttempts.length) : 0;
  if (isStudentMobile()) return viewSTestsMobile(ongoing, upcoming, ended, myAttempts, avg);

  var html = pageHead('我的测试', '软件24201 · 完成教师发布的课程测评');

  html += '<div class="welcome"><h2>嗨，' + esc(user.name) + '</h2>' +
    '<p>当前有 ' + ongoing.filter(function (p) { return !attemptOf(p.id); }).length + ' 场测评可以进行。完成测评后，系统会基于真实作答数据生成知识点诊断与学习建议。</p>' +
    '<div class="welcome-actions"><button class="btn solid" data-act="go" data-to="s/history">查看历史成绩</button></div></div>';

  html += '<div class="stats">' +
    statCard('待完成', ongoing.filter(function (p) { return !attemptOf(p.id); }).length + '<small>场</small>', 'clock', 'amber') +
    statCard('已完成', myAttempts.length + '<small>场</small>', 'check', 'green') +
    statCard('平均正确率', avg + '%', 'target', '') +
    statCard('AI 学习报告', myAttempts.length + '<small>份</small>', 'spark', 'purple', '均可回看') +
    '</div>';

  if (ongoing.length) {
    html += '<div class="card mb16"><div class="card-head"><h3>进行中的测评</h3></div><div class="card-body">';
    ongoing.forEach(function (p) {
      var att = attemptOf(p.id);
      html += '<div class="test-hero" style="box-shadow:none;border-color:' + (att ? 'var(--line)' : '#c9d9ff') + '">' +
        '<div class="th-main"><div class="th-tags">' + statusTag(p) + tag(p.items.length + ' 题', 'gray') + tag(p.duration + ' 分钟', 'gray') + '</div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div class="th-meta"><span>' + icon('users') + esc(p.teacherName) + ' · ' + esc(p.className) + '</span>' +
        '<span>' + icon('clock') + fmtDT(p.startAt) + ' — ' + fmtDT(p.endAt) + '</span>' +
        '<span>' + icon('target') + '满分 ' + paperTotal(p) + ' 分</span></div></div>' +
        '<div class="th-side">' + (att
          ? '<div class="big">' + att.score + '</div><small>我的得分</small><button class="btn btn-sm btn-soft" data-act="go" data-to="s/result/' + att.id + '">查看结果</button>'
          : '<div class="big">' + paperTotal(p) + '</div><small>满分</small><button class="btn btn-primary" data-act="startExam" data-id="' + p.id + '">' + icon('play') + '开始作答</button>') +
        '</div></div>';
    });
    html += '</div></div>';
  }

  if (upcoming.length) {
    html += '<div class="card mb16"><div class="card-head"><h3>即将开始</h3></div><div class="card-body"><div class="test-list">' +
      upcoming.map(function (p) {
        return '<div class="test-line"><div class="tl-ico">' + icon('calendar') + '</div><div class="grow"><b>' + esc(p.name) + '</b>' +
          '<small>' + esc(p.teacherName) + ' · ' + p.items.length + ' 题 · ' + p.duration + ' 分钟 · ' + fmtDT(p.startAt) + ' 开放</small></div>' +
          '<span class="tag blue">未开始</span></div>';
      }).join('') + '</div></div></div>';
  }

  html += '<div class="card"><div class="card-head"><h3>已结束的测评</h3><span class="sub">可查看结果与诊断报告</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>测评名称</th><th>题量</th><th>结束时间</th><th>得分</th><th>结果</th><th>操作</th></tr></thead><tbody>' +
    (ended.length ? ended.map(function (p) {
      var att = attemptOf(p.id);
      return '<tr><td class="cell-main">' + esc(p.name) + '<div class="cell-sub">' + esc(p.teacherName) + '</div></td>' +
        '<td class="num">' + p.items.length + '</td><td class="small muted">' + fmtDT(p.endAt) + '</td>' +
        '<td class="num">' + (att ? '<b>' + att.score + '</b> / ' + att.total : '<span class="muted">未参加</span>') + '</td>' +
        '<td>' + (att ? tag(levelOf(pct(att.score, att.total)).label, levelOf(pct(att.score, att.total)).cls) : '—') + '</td>' +
        '<td>' + (att ? '<button class="btn btn-sm btn-ghost" data-act="go" data-to="s/result/' + att.id + '">' + icon('eye') + '查看结果</button>' : '<span class="muted small">—</span>') + '</td></tr>';
    }).join('') : '<tr><td colspan="6">' + emptyHTML('暂无已结束的测评', '', 'file') + '</td></tr>') +
    '</tbody></table></div></div>';
  return html;
}

/* ---------------- 学生移动端：测试列表 ---------------- */
function mobileSectionHead(title, sub) {
  return '<div class="m-sec-head"><h2>' + title + '</h2>' + (sub ? '<span>' + sub + '</span>' : '') + '</div>';
}

function viewSTestsMobile(ongoing, upcoming, ended, myAttempts, avg) {
  var pending = ongoing.filter(function (p) { return !attemptOf(p.id); }).length;
  var html = '<div class="welcome m-welcome"><h2>嗨，' + esc(user.name) + '</h2>' +
    '<p>当前有 <b>' + pending + '</b> 场测评待完成。完成后系统会自动生成知识点诊断与学习建议。</p></div>';

  html += '<div class="stats">' +
    statCard('待完成', pending + '<small>场</small>', 'clock', 'amber') +
    statCard('已完成', myAttempts.length + '<small>场</small>', 'check', 'green') +
    statCard('平均正确率', avg + '%', 'target', '') +
    statCard('学习报告', myAttempts.length + '<small>份</small>', 'spark', 'purple') +
    '</div>';

  if (ongoing.length) {
    html += mobileSectionHead('进行中的测评', ongoing.length + ' 场');
    ongoing.forEach(function (p) {
      var att = attemptOf(p.id);
      html += '<div class="m-test-card"><div class="m-test-tags">' + statusTag(p) +
        tag(p.items.length + ' 题', 'gray') + tag(p.duration + ' 分钟', 'gray') + '</div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<div class="m-test-meta">' + icon('users') + '<span>' + esc(p.teacherName) + ' · ' + esc(p.className) + '</span></div>' +
        '<div class="m-test-meta">' + icon('clock') + '<span>截止 ' + fmtDT(p.endAt) + '</span></div>' +
        '<div class="m-test-foot">' +
        (att
          ? '<div class="m-test-score"><b>' + att.score + '</b><small>我的得分 / ' + att.total + '</small></div>' +
            '<button class="btn btn-soft" data-act="go" data-to="s/result/' + att.id + '">查看结果</button>'
          : '<div class="m-test-score"><b>' + paperTotal(p) + '</b><small>满分</small></div>' +
            '<button class="btn btn-primary" data-act="startExam" data-id="' + p.id + '">' + icon('play') + '开始作答</button>') +
        '</div></div>';
    });
  }

  if (upcoming.length) {
    html += mobileSectionHead('即将开始', upcoming.length + ' 场') + '<div class="m-list">' +
      upcoming.map(function (p) {
        return '<div class="m-list-item"><div class="m-list-ico">' + icon('calendar') + '</div>' +
          '<div class="grow"><b>' + esc(p.name) + '</b><small>' + esc(p.teacherName) + ' · ' +
          fmtDT(p.startAt) + ' 开放</small></div><span class="tag blue">未开始</span></div>';
      }).join('') + '</div>';
  }

  html += mobileSectionHead('已结束的测评', ended.length + ' 场');
  if (ended.length) {
    html += '<div class="m-record-list">' + ended.map(function (p) {
      var att = attemptOf(p.id);
      var lv = att ? levelOf(pct(att.score, att.total)) : null;
      return '<div class="m-record-card"><div class="m-record-top"><b>' + esc(p.name) + '</b>' +
        (att ? '<span class="m-record-score">' + att.score + '<small>/' + att.total + '</small></span>' : '<span class="tag gray">未参加</span>') +
        '</div><div class="m-record-sub">' + esc(p.teacherName) + ' · 截止 ' + fmtDT(p.endAt) + '</div>' +
        (att ? '<div class="m-record-foot">' + tag(lv.label, lv.cls) +
          '<button class="btn btn-sm btn-ghost" data-act="go" data-to="s/result/' + att.id + '">' + icon('eye') + '查看结果</button></div>' : '') +
        '</div>';
    }).join('') + '</div>';
  } else {
    html += '<div class="card"><div class="card-body">' + emptyHTML('暂无已结束的测评', '教师结束测评后会显示在这里。', 'file') + '</div></div>';
  }
  return html;
}

/* ---------------- 在线作答 ---------------- */
function fmtClock(sec) {
  sec = Math.max(0, sec);
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? pad2(h) + ':' : '') + pad2(m) + ':' + pad2(s);
}

function examShellHTML(p) {
  return '<div class="exam-top"><div><h2>' + esc(p.name) + '</h2><div class="exam-sub">' + esc(p.teacherName) + ' · ' + p.items.length + ' 题 · 满分 ' + paperTotal(p) + ' 分 · ' + p.duration + ' 分钟</div></div>' +
    '<div class="exam-timer" id="examTimer">' + icon('clock') + '--:--</div>' +
    '<button class="btn" data-act="exitExam">退出</button>' +
    '<button class="btn btn-primary" data-act="submitExam">交卷</button></div>' +
    '<div class="exam-wrap"><div><div class="q-card" id="qCard"></div>' +
    '<div class="exam-actions"><button class="btn" data-act="prevQ">' + icon('arrowLeft') + '上一题</button>' +
    '<span class="small muted" id="examCounter"></span>' +
    '<button class="btn" data-act="nextQ">下一题' + icon('arrowRight') + '</button></div></div>' +
    '<div class="q-nav-card"><h4>答题卡</h4><div class="q-grid" id="qGrid"></div>' +
    '<div class="exam-legend"><span><i style="background:var(--primary)"></i>当前</span><span><i style="background:var(--primary-soft);border:1px solid #c9d9ff"></i>已答</span><span><i style="background:#fff;border:1px solid var(--line)"></i>未答</span></div>' +
    '<div class="save-tip" id="saveTip">' + icon('check2') + '<span>答案已保存到服务器</span></div>' +
    '<button class="btn btn-primary mt16" style="width:100%" data-act="submitExam">交卷</button></div></div>';
}

function viewExam(pid) {
  var p = PAPER(pid);
  if (!p) return pageHead('测评', '', '') + '<div class="card"><div class="card-body">' + emptyHTML('未找到试卷', '请返回测试列表。', 'file') + '</div></div>';
  var submitted = DB.attempts.filter(function (a) {
    return a.paperId === pid && a.studentId === user.id && a.status === 'submitted';
  })[0];
  if (submitted) {
    setTimeout(function () { go('s/result/' + submitted.id); }, 10);
    return '<div class="empty">正在打开结果…</div>';
  }
  var st = paperStatus(p);
  if (st.key !== 'ongoing') {
    return pageHead('测评未开放', '', '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回</button>') +
      '<div class="card"><div class="card-body">' + emptyHTML(st.key === 'upcoming' ? '测评尚未开始' : '测评已结束', st.key === 'upcoming' ? '开放时间：' + fmtDT(p.startAt) : '本次测评已于 ' + fmtDT(p.endAt) + ' 结束。', 'clock') + '</div></div>';
  }
  if (S.pendingExam && S.pendingExam.paperId === pid) {
    S.exam = S.pendingExam.exam;
    S.pendingExam = null;
    return examShellHTML(p);
  }
  if (S.exam && S.exam.paper.id === pid) return examShellHTML(p);
  if (S.examLoading !== pid) {
    S.examLoading = pid;
    API.startAttempt(pid).then(function (res) {
      S.examLoading = null;
      if (!res || !res.attempt) throw new Error('无法创建作答记录');
      if (res.attempt.status === 'submitted') {
        return reloadDB().then(function () { go('s/result/' + res.attempt.id); });
      }
      var started = res.attempt.startedAt || new Date().toISOString();
      S.pendingExam = {
        paperId: pid,
        exam: {
          attemptId: res.attempt.id,
          paper: p,
          draft: {
            startedAt: started,
            answers: res.attempt.answers || {},
            savedAt: res.attempt.updatedAt || started
          },
          idx: 0, done: false, remaining: p.duration * 60,
          saving: false, pendingSave: false, saveTimer: null
        }
      };
      if (res.message) toast(res.message, 'err');
      render();
    }).catch(function (e) {
      S.examLoading = null;
      toast(e.message || '无法开始作答', 'err');
      go('s/tests');
    });
  }
  return '<div class="empty" style="margin-top:12vh"><div class="e-ico">' + icon('refresh') + '</div><b>正在同步考试状态…</b><p>计时与答案由服务器统一管理</p></div>';
}

function saveExamProgress() {
  if (!S.exam || S.exam.done) return;
  var e = S.exam;
  if (e.saveTimer) { clearTimeout(e.saveTimer); e.saveTimer = null; }
  if (e.saving) { e.pendingSave = true; return; }
  e.saving = true;
  API.saveAttempt(e.attemptId, e.draft.answers).then(function (res) {
    e.saving = false;
    if (res && res.attempt && res.attempt.status === 'submitted') {
      stopExamTimer();
      S.exam = null;
      reloadDB().then(function () { toast(res.message || '考试已结束，系统已自动交卷', 'err'); go('s/result/' + res.attempt.id); });
      return;
    }
    e.draft.savedAt = new Date().toISOString();
    var tip = $('#saveTip');
    if (tip) tip.innerHTML = icon('check2') + '<span>已保存到服务器 · ' + fmtDT(e.draft.savedAt).split(' ')[1] + '</span>';
    if (e.pendingSave) { e.pendingSave = false; saveExamProgress(); }
  }).catch(function (err) {
    e.saving = false;
    var tip = $('#saveTip');
    if (tip) tip.innerHTML = icon('alert') + '<span>保存失败：' + esc(err.message || '网络异常') + '</span>';
  });
}

function paintExam() {
  if (!S.exam) return;
  var p = S.exam.paper;
  var draft = S.exam.draft;
  var idx = clamp(S.exam.idx, 0, p.items.length - 1);
  S.exam.idx = idx;
  var it = p.items[idx];
  var q = QBY(it.qid);
  var ans = draft.answers[q.id] || '';
  var card = $('#qCard');
  if (!card) return;
  var typeLabel = q.type === 'multi' ? '多选题 · 少选 / 多选均不得分' : q.type === 'single' ? '单选题' : '判断题';
  var opts = (q.options || []).map(function (o) {
    var on = ans.indexOf(o.key) > -1;
    return '<button class="q-opt ' + (on ? 'on' : '') + '" data-act="answer" data-key="' + o.key + '">' +
      '<span class="key">' + (q.type === 'judge' ? (o.key === 'T' ? '✓' : '✕') : o.key) + '</span>' +
      '<span class="txt">' + esc(o.text) + '</span></button>';
  }).join('');
  card.innerHTML = '<div class="q-head"><span class="q-index">第 ' + (idx + 1) + ' / ' + p.items.length + ' 题</span>' +
    tag(typeLabel, q.type === 'multi' ? 'purple' : q.type === 'judge' ? 'amber' : 'blue') +
    '<span class="right small muted">' + it.score + ' 分 · ' + esc(KPBY(q.kpId).name) + '</span></div>' +
    '<div class="q-stem">' + esc(q.stem) + '</div>' +
    '<div class="q-options">' + opts + '</div>' +
    (q.type === 'multi' ? '<div class="small muted mt12">可多选，选全且不选错才能得分</div>' : '');
  var grid = $('#qGrid');
  if (grid) {
    grid.innerHTML = p.items.map(function (x, i) {
      var qq = QBY(x.qid);
      var done = !!draft.answers[qq.id];
      var cls = i === idx ? 'cur' : done ? 'done' : '';
      return '<button class="q-num ' + cls + '" data-act="navQ" data-i="' + i + '">' + (i + 1) + '</button>';
    }).join('');
  }
  var counter = $('#examCounter');
  if (counter) counter.textContent = (idx + 1) + ' / ' + p.items.length;
  var prev = $('[data-act="prevQ"]'), next = $('[data-act="nextQ"]');
  if (prev) prev.disabled = idx === 0;
  if (next) next.disabled = idx === p.items.length - 1;
  var tip = $('#saveTip');
  if (tip) tip.innerHTML = icon('check2') + '<span>已自动保存 · ' + fmtDT(draft.savedAt || new Date().toISOString()).split(' ')[1] + '</span>';
}

function startExamTimer() {
  stopExamTimer();
  if (!S.exam) return;
  function tick() {
    if (!S.exam) return;
    var p = S.exam.paper;
    var now = window.serverNowMs ? window.serverNowMs() : Date.now();
    var elapsed = (now - new Date(S.exam.draft.startedAt).getTime()) / 1000;
    var remain = Math.max(0, Math.floor(p.duration * 60 - elapsed));
    S.exam.remaining = remain;
    var el = $('#examTimer');
    if (el) {
      el.innerHTML = icon('clock') + fmtClock(remain);
      el.classList.toggle('warn', remain <= 300);
    }
    if (remain <= 0) {
      stopExamTimer();
      if (S.exam && !S.exam.done) {
        toast('作答时间已到，系统自动交卷', 'err');
        finishExam(true);
      }
    }
  }
  tick();
  S.timer = setInterval(tick, 1000);
}
function stopExamTimer() {
  if (S.timer) { clearInterval(S.timer); S.timer = null; }
}
async function finishExam(auto) {
  if (!S.exam || S.exam.done) return;
  var e = S.exam;
  e.done = true;
  stopExamTimer();
  if (e.saveTimer) { clearTimeout(e.saveTimer); e.saveTimer = null; }
  try {
    var res = await API.submitAttempt(e.attemptId, e.draft.answers);
    await reloadDB();
    S.exam = null;
    toast(auto ? '时间到，已自动交卷' : '交卷成功，成绩已生成');
    go('s/result/' + res.attempt.id);
  } catch (err) {
    e.done = false;
    toast(err.message || '交卷失败，请重试', 'err');
    try {
      await reloadDB();
      var att = DB.attempts.filter(function (a) { return a.paperId === e.paper.id && a.studentId === user.id && a.status === 'submitted'; })[0];
      if (att) { S.exam = null; go('s/result/' + att.id); return; }
    } catch (ignore) {}
    startExamTimer();
  }
}

/* ---------------- 结果页 ---------------- */
function viewSResult(aid) {
  var att = DB.attempts.filter(function (a) { return a.id === aid && a.studentId === user.id; })[0];
  if (!att) {
    return pageHead('测评结果', '', '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回我的测试</button>') +
      '<div class="card"><div class="card-body">' + emptyHTML('未找到作答记录', '请从历史记录中重新进入。', 'file') + '</div></div>';
  }
  var p = PAPER(att.paperId);
  var rep = buildReport(att);
  var st = paperStatus(p);
  var canSee = p.answerPolicy === 'afterSubmit' || (p.answerPolicy === 'afterEnd' && (st.key === 'ended' || st.key === 'archived'));
  var lvColor = rep.overall >= 85 ? 'var(--green)' : rep.overall >= 70 ? 'var(--primary)' : rep.overall >= 60 ? 'var(--amber)' : 'var(--red)';

  var html = pageHead('测评结果', esc(p.name) + ' · ' + fmtDT(att.submittedAt),
    '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回我的测试</button>' +
    '<button class="btn btn-primary" data-act="go" data-to="s/report/' + att.id + '">' + icon('spark') + '查看学习诊断</button>');

  html += '<div class="result-hero"><div class="donut" style="--v:' + rep.overall + '"><div><b>' + att.score + '</b><small>得分 / ' + att.total + '</small></div></div>' +
    '<div class="rh-main"><h2>' + esc(p.name) + '</h2><div class="rh-sub">提交于 ' + fmtFull(att.submittedAt) + ' · 用时约 ' + att.timeUsed + ' 分钟</div>' +
    '<div class="rh-stats"><div><b>' + rep.overall + '%</b>正确率</div><div><b>' + att.correctCount + ' / ' + p.items.length + '</b>答对题数</div>' +
    '<div><b style="color:' + lvColor + '">' + rep.level.label + '</b>整体表现</div><div><b>' + (canSee ? '已开放' : '未开放') + '</b>答案查看</div></div></div></div>';

  html += '<div class="card mt16"><div class="card-head"><h3>' + icon('spark') + ' AI 诊断摘要</h3><span class="sub">基于本次真实作答数据</span>' +
    '<span class="right tag purple">AI 生成 · 仅供参考</span></div><div class="card-body"><div class="report-text">' + esc(rep.summary) + '</div>' +
    (rep.lowSample ? '<div class="alert warn mt12">' + icon('alert') + '<div>部分知识点仅由 1 道题支撑，结论证据有限，建议结合更多练习综合判断。</div></div>' : '') +
    '<div class="mt12"><button class="btn btn-sm btn-soft" data-act="go" data-to="s/report/' + att.id + '">查看完整诊断与建议' + icon('arrow') + '</button></div></div></div>';

  html += '<div class="grid-2 mt16"><div class="card"><div class="card-head"><h3>知识点表现</h3></div><div class="card-body">' + barsHTML(rep.kps) + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>表现说明</h3></div><div class="card-body"><div class="report-text">' +
    '得分率 ≥ 85% 为本次表现较好；70%~84% 为基本掌握；60%~69% 为掌握不稳定；低于 60% 需要重点加强。' +
    '<br><br>等级仅代表<strong>本次测评</strong>中的表现，不等同于长期能力判断。报告中的分数、错题与知识点数据均可回溯至作答记录。</div>' +
    '<div class="mt16 row wrap">' + tag('表现较好', 'green') + tag('基本掌握', 'blue') + tag('掌握不稳定', 'amber') + tag('重点加强', 'red') + '</div></div></div></div>';

  html += '<div class="card mt16"><div class="card-head"><h3>答题回顾</h3><span class="sub">' + (canSee ? '含标准答案与解析' : '教师未开放标准答案') + '</span></div><div class="card-body">' +
    '<div class="review-list">' + p.items.map(function (it, i) {
      var q = QBY(it.qid);
      var mine = att.answers[q.id] || '';
      var ok = attemptIsCorrect(att, q.id);
      var html2 = '<div class="review-item"><div class="ri-head"><span class="q-index">' + pad2(i + 1) + '</span>' +
        '<div class="grow"><div class="ri-stem">' + esc(q.stem) + '</div>' +
        '<div class="ri-answers"><span>' + esc(KPBY(q.kpId).name) + '</span>' +
        '<span>你的答案：' + (ok ? '<b class="ok">' + esc(answerText(q, mine)) + '</b>' : '<b class="no">' + esc(answerText(q, mine)) + '</b>') + '</span>' +
        (canSee ? '<span>标准答案：<b class="ok">' + esc(answerText(q, q.answer)) + '</b></span>' : '') +
        '<span>' + it.score + ' 分</span></div></div>' + tag(ok ? '正确' : '错误', ok ? 'green' : 'red') + '</div>' +
        (canSee ? '<div class="ri-analysis">解析：' + esc(q.analysis || '暂无解析') + '</div>' : '') + '</div>';
      return html2;
    }).join('') + '</div></div></div>';
  return html;
}

/* ---------------- AI 学习报告 ---------------- */
function mobileKpList(kps) {
  return '<div class="m-kp-list">' + kps.map(function (k) {
    var lv = levelOf(k.rate);
    return '<div class="m-kp-item"><div class="m-kp-top"><b>' + esc(k.name) + '</b>' + tag(lv.label, lv.cls) + '</div>' +
      '<div class="m-kp-rate"><div class="progress ' + (k.rate >= 85 ? 'green' : k.rate >= 70 ? '' : k.rate >= 60 ? 'amber' : 'red') + '">' +
      '<i style="width:' + k.rate + '%"></i></div><b>' + k.rate + '%</b></div>' +
      '<div class="m-kp-meta"><span>共 ' + k.count + ' 题</span><span>答对 ' + k.right + ' 题</span><span>' + esc(lv.advice) + '</span></div></div>';
  }).join('') + '</div>';
}

function viewSReport(aid) {
  var att = DB.attempts.filter(function (a) { return a.id === aid && a.studentId === user.id; })[0];
  if (!att) att = attemptsOf()[0];
  if (!att) {
    return pageHead('学习诊断', '', '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回</button>') +
      '<div class="card"><div class="card-body">' + emptyHTML('暂无诊断数据', '完成一次测评后即可生成学习诊断报告。', 'spark') + '</div></div>';
  }
  var p = PAPER(att.paperId);
  var rep = buildReport(att);
  var pst = paperStatus(p);
  var canSee = p.answerPolicy === 'afterSubmit' || (p.answerPolicy === 'afterEnd' && (pst.key === 'ended' || pst.key === 'archived'));
  var lvColor = rep.overall >= 85 ? 'var(--green)' : rep.overall >= 70 ? 'var(--primary)' : rep.overall >= 60 ? 'var(--amber)' : 'var(--red)';
  var allWrongs = p.items.map(function (it, i) {
    var q = QBY(it.qid);
    return { q: q, i: i, mine: att.answers[q.id] || '', ok: attemptIsCorrect(att, q.id) };
  }).filter(function (x) { return !x.ok; });
  var wrongs = allWrongs.slice(0, 3);
  var hiddenWrongs = allWrongs.length - wrongs.length;

  var html = pageHead('学习诊断报告', 'AI 解释 + 结构化数据 · 可打印归档',
    '<button class="btn" data-act="go" data-to="s/result/' + att.id + '">' + icon('arrowLeft') + '返回结果</button>' +
    '<button class="btn" data-act="aiDiagnose" data-id="' + att.id + '">' + icon('spark') + '云端 AI 解读</button>' +
    '<button class="btn" data-act="printReport">' + icon('print') + '打印 / 导出 PDF</button>');

  html += '<div class="report-head"><div class="rh-ico">' + icon('spark') + '</div><div><h2>' + esc(user.name) + ' · 学习诊断报告</h2>' +
    '<div class="rh-meta"><span>学号 ' + (STUDENT(user.id) ? STUDENT(user.id).no : '—') + '</span><span>' + esc(p.name) + '</span>' +
    '<span>' + fmtFull(att.submittedAt) + '</span><span class="tag purple">AI 生成</span></div></div>' +
    '<div class="rh-level"><span class="small muted">整体表现</span><div class="lv" style="color:' + lvColor + '">' + rep.level.label + '</div></div></div>';

  html += '<div class="card report-sec"><div class="card-head"><h3>一、总体表现</h3></div><div class="card-body"><div class="row report-overview" style="gap:28px;flex-wrap:wrap">' +
    donutHTML(rep.overall, '正确率', rep.overall >= 85 ? 'green' : '') +
    '<div class="grow"><div class="report-insight">' +
    '<div class="insight"><small>本次得分</small><b>' + att.score + ' / ' + att.total + '</b></div>' +
    '<div class="insight"><small>答对题数</small><b>' + att.correctCount + ' / ' + p.items.length + '</b></div>' +
    '<div class="insight"><small>完成用时</small><b>' + att.timeUsed + ' 分钟</b></div>' +
    '<div class="insight"><small>表现等级</small><b>' + rep.level.label + '</b></div></div>' +
    '<div class="report-text mt12">' + esc(rep.summary) + '</div></div></div></div></div>';

  var kpBody = isStudentMobile() ? mobileKpList(rep.kps) :
    '<div class="table-wrap"><table class="tb"><thead><tr><th>知识点</th><th>题数</th><th>答对</th><th>得分率</th><th>表现</th><th>建议</th></tr></thead><tbody>' +
    rep.kps.map(function (k) {
      var lv = levelOf(k.rate);
      return '<tr><td class="cell-main">' + esc(k.name) + '</td><td class="num">' + k.count + '</td><td class="num">' + k.right + '</td>' +
        '<td><div class="progress-row" style="min-width:130px"><div class="progress ' + (k.rate >= 85 ? 'green' : k.rate >= 70 ? '' : k.rate >= 60 ? 'amber' : 'red') + '"><i style="width:' + k.rate + '%"></i></div><b>' + k.rate + '%</b></div></td>' +
        '<td>' + tag(lv.label, lv.cls) + '</td><td class="small muted">' + lv.advice + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  html += '<div class="card report-sec"><div class="card-head"><h3>二、知识点掌握情况</h3><span class="sub">按主知识点计分</span></div><div class="card-body">' +
    kpBody +
    (rep.lowSample ? '<div class="alert warn mt12">' + icon('alert') + '<div>部分知识点仅由 1 道题支撑，学习诊断的证据有限，建议增加对应练习后再判断。</div></div>' : '') +
    '</div></div>';

  if (rep.trend) {
    html += '<div class="card report-sec"><div class="card-head"><h3>三、进步趋势</h3><span class="sub">与上一次测评对比</span></div><div class="card-body row report-trend" style="gap:28px;flex-wrap:wrap">' +
      '<div style="min-width:220px"><div class="trend-line">' +
      '<div class="tl-col"><div class="tl-bar" style="height:' + Math.max(8, Math.round(rep.trend.prevRate * 0.7)) + 'px"></div><div class="tl-cap">上次 ' + rep.trend.prevRate + '%</div></div>' +
      '<div class="tl-col"><div class="tl-bar hi" style="height:' + Math.max(8, Math.round(rep.overall * 0.7)) + 'px"></div><div class="tl-cap">本次 ' + rep.overall + '%</div></div>' +
      '</div></div><div class="grow"><div class="report-text">上一次「' + esc(rep.trend.prevName) + '」的正确率为 ' + rep.trend.prevRate + '%，本次为 ' + rep.overall + '%，' +
      (rep.trend.delta >= 0 ? '提升了 <b>' + rep.trend.delta + '</b> 个百分点，整体呈进步趋势' : '下降了 <b>' + Math.abs(rep.trend.delta) + '</b> 个百分点，建议关注近期学习状态') +
      '。趋势对比仅反映两次测评的题目表现，不等同于长期能力变化。</div></div></div></div>';
  }

  html += '<div class="card report-sec"><div class="card-head"><h3>' + (rep.trend ? '四' : '三') + '、错题分析</h3><span class="sub">建议逐题复盘错因</span></div><div class="card-body">' +
    (wrongs.length ? '<div class="review-list">' + wrongs.map(function (x) {
      return '<div class="review-item"><div class="ri-head"><span class="q-index">' + pad2(x.i + 1) + '</span><div class="grow">' +
        '<div class="ri-stem">' + esc(x.q.stem) + '</div>' +
        '<div class="ri-answers"><span>' + esc(KPBY(x.q.kpId).name) + '</span><span>你的答案：<b class="no">' + esc(answerText(x.q, x.mine)) + '</b></span>' +
        (canSee ? '<span>标准答案：<b class="ok">' + esc(answerText(x.q, x.q.answer)) + '</b></span>' : '') + '</div></div></div>' +
        '<div class="ri-analysis">解析：' + esc(x.q.analysis || '暂无解析') + '</div></div>';
    }).join('') + '</div>' + (hiddenWrongs ? '<div class="small muted mt12">仅展示前 3 道错题，完整作答记录请返回测评结果页查看。</div>' : '') : '<div class="alert ok">' + icon('check') + '<div>本次测评全部答对，暂无需复盘的错题。可以尝试更高难度的综合练习。</div></div>') +
    '</div></div>';

  html += '<div class="card report-sec"><div class="card-head"><h3>' + (rep.trend ? '五' : '四') + '、学习建议</h3><span class="sub">按优先级排列</span></div><div class="card-body"><div class="suggest-list">' +
    rep.suggestions.map(function (sg) {
      return '<div class="suggest-item"><span class="n"></span><div><b>' + esc(sg.title) + '：</b>' + esc(sg.text) + '</div></div>';
    }).join('') + '</div>' +
    '<div class="alert info mt16">' + icon('info') + '<div>建议结合课堂进度使用本报告：先处理低表现知识点，再用错题复盘确认理解，最后通过新题检验迁移能力。</div></div></div></div>';

  html += '<div class="card report-sec"><div class="card-body"><div class="small muted">报告依据：试卷快照 + 作答记录（测试 ID：' + p.id + ' / 作答 ID：' + att.id + '）。生成模型：' + esc((DB.ai && DB.ai.model) || '规则诊断模型') + ' · 提示词版本 v1.2。AI 仅负责组织语言与生成建议，分数与知识点表现均由系统规则计算。</div></div></div>';
  return html;
}

/* ---------------- 错题本 ---------------- */
function ensureWrongSelection() {
  if (!S.wrong) S.wrong = { sel: {}, source: '', kp: '', kw: '', ready: false };
  var all = wrongBookEntries();
  if (!S.wrong.ready && all.length) {
    all.forEach(function (e) { S.wrong.sel[e.qid] = true; });
    S.wrong.ready = true;
  }
  var ids = {};
  all.forEach(function (e) { ids[e.qid] = true; });
  Object.keys(S.wrong.sel).forEach(function (qid) {
    if (!ids[qid]) delete S.wrong.sel[qid];
  });
}

function wrongFilteredEntries() {
  var kw = String((S.wrong && S.wrong.kw) || '').trim().toLowerCase();
  return wrongBookEntries().filter(function (e) {
    if (S.wrong.source && e.sourcePaperId !== S.wrong.source) return false;
    if (S.wrong.kp && e.kpId !== S.wrong.kp) return false;
    if (kw) {
      var text = [e.stem, e.kpName, e.sourcePaperName, e.answer, e.myAnswer].join(' ').toLowerCase();
      if (text.indexOf(kw) < 0) return false;
    }
    return true;
  });
}

function wrongSelectedEntries() {
  return wrongBookEntries().filter(function (e) { return !!(S.wrong && S.wrong.sel[e.qid]); });
}

function wrongOptionsHTML(e) {
  var answerKeys = e.answerVisible ? String(e.answer || '').split('') : [];
  var mineKeys = String(e.myAnswer || '').split('');
  return '<div class="wrong-options">' + (e.options || []).map(function (o) {
    var right = answerKeys.indexOf(o.key) > -1;
    var picked = mineKeys.indexOf(o.key) > -1;
    var mark = right ? '<span class="wom ok">标准答案</span>' : (picked ? '<span class="wom no">你的选择</span>' : '');
    return '<div class="wrong-option ' + (right ? 'right ' : '') + (picked ? 'picked' : '') + '">' +
      '<span class="key">' + (e.type === 'judge' ? (o.key === 'T' ? '✓' : '✕') : esc(o.key)) + '</span>' +
      '<span class="txt">' + esc(o.text) + '</span>' + mark + '</div>';
  }).join('') + '</div>';
}

function wrongEntryHTML(e) {
  var picked = !!(S.wrong && S.wrong.sel[e.qid]);
  var q = QBY(e.qid) || e;
  var source = e.sourcePaperName || '历史测评';
  var answerHtml = '<div class="wrong-answer"><span>最近错答：<b class="no">' + esc(answerText(q, e.myAnswer)) + '</b></span>' +
    (e.answerVisible ? '<span>标准答案：<b class="ok">' + esc(answerText(q, e.answer)) + '</b></span>' : '') +
    '<span>本题原分值：' + e.score + ' 分</span></div>';
  var analysis = e.answerVisible
    ? '<div class="wrong-analysis"><b>解析</b>' + esc(e.analysis || '暂无解析') + '</div>'
    : '<div class="wrong-hint">' + icon('info') + '<span>原测试未开放标准答案，生成错题测试并提交后即可查看答案与解析。</span></div>';
  return '<div class="wrong-item ' + (picked ? 'selected' : '') + '" data-qid="' + esc(e.qid) + '">' +
    '<label class="wrong-check" title="选择这道错题"><input type="checkbox" data-wrongq="' + esc(e.qid) + '"' +
    (picked ? ' checked' : '') + ' aria-label="选择题目"><i>' + icon('check2') + '</i></label>' +
    '<div class="wrong-main"><div class="wrong-head"><div class="wrong-source">' + icon('bookOpen') +
    '<span>' + esc(source) + ' · ' + fmtDT(e.lastWrongAt) + '</span></div><div class="wrong-tags">' +
    tag(e.kpName, 'blue') + tag({ single: '单选题', multi: '多选题', judge: '判断题' }[e.type] || '题目', 'gray') +
    (e.wrongCount > 1 ? tag('答错 ' + e.wrongCount + ' 次', 'amber') : '') +
    tag(e.corrected ? '已订正' : '待订正', e.corrected ? 'green' : 'amber') + '</div></div>' +
    '<div class="wrong-stem">' + esc(e.stem) + '</div>' + wrongOptionsHTML(e) + answerHtml + analysis +
    '</div></div>';
}

function wrongListHTML() {
  var list = wrongFilteredEntries();
  if (!list.length) {
    return emptyHTML(wrongBookEntries().length ? '当前筛选下没有错题' : '还没有错题记录',
      wrongBookEntries().length ? '试试切换来源测试或知识点筛选。' : '完成一次教师发布的测评后，答错的题会自动收进这里。', 'bookOpen');
  }
  return '<div class="wrong-list">' + list.map(wrongEntryHTML).join('') + '</div>';
}

function wrongSourceOptions() {
  var map = {};
  wrongBookEntries().forEach(function (e) {
    if (e.sourcePaperId) map[e.sourcePaperId] = e.sourcePaperName || e.sourcePaperId;
  });
  return Object.keys(map).sort(function (a, b) {
    return String(map[a]).localeCompare(String(map[b]), 'zh-CN');
  }).map(function (id) {
    return '<option value="' + esc(id) + '"' + (S.wrong.source === id ? ' selected' : '') + '>' + esc(map[id]) + '</option>';
  }).join('');
}

function wrongKpOptions() {
  var map = {};
  wrongBookEntries().forEach(function (e) {
    if (e.kpId && !map[e.kpId]) map[e.kpId] = e.kpName || e.kpId;
  });
  return Object.keys(map).sort(function (a, b) {
    return String(map[a]).localeCompare(String(map[b]), 'zh-CN');
  }).map(function (id) {
    return '<option value="' + esc(id) + '"' + (S.wrong.kp === id ? ' selected' : '') + '>' + esc(map[id]) + '</option>';
  }).join('');
}

function wrongToolbarHTML() {
  return '<div class="wrong-toolbar"><div class="wrong-filters">' +
    '<select class="select" data-select="wrongSource"><option value="">全部来源测试</option>' + wrongSourceOptions() + '</select>' +
    '<select class="select" data-select="wrongKp"><option value="">全部知识点</option>' + wrongKpOptions() + '</select>' +
    '<input class="input wrong-search" type="search" data-input="wrongSearch" placeholder="搜索题干 / 知识点" value="' + esc(S.wrong.kw || '') + '">' +
    '</div><div class="wrong-selectbar"><span id="wrongSelCount">已选 0 题</span>' +
    '<button class="btn btn-sm" data-act="wrongSelectAll">全选当前筛选</button>' +
    '<button class="btn btn-sm btn-ghost" data-act="wrongClear">清空</button>' +
    '<button class="btn btn-primary btn-sm" id="wrongCreateBtn" data-act="wrongCreate">' + icon('plus') + '生成错题测试</button>' +
    '</div></div>';
}

function wrongTestCardHTML(p) {
  var att = DB.attempts.filter(function (a) { return a.paperId === p.id && a.studentId === user.id; })[0];
  var submitted = att && att.status === 'submitted';
  var inProgress = att && att.status === 'in_progress';
  var total = paperTotal(p);
  var action = submitted
    ? '<button class="btn btn-sm btn-soft" data-act="go" data-to="s/result/' + att.id + '">' + icon('eye') + '查看结果</button>'
    : '<button class="btn btn-sm btn-primary" data-act="startExam" data-id="' + p.id + '">' + icon('play') + (inProgress ? '继续作答' : '开始作答') + '</button>';
  return '<div class="wrong-paper"><div class="wrong-paper-ico">' + icon('bookOpen') + '</div>' +
    '<div class="grow"><div class="wrong-paper-title"><b>' + esc(p.name) + '</b>' +
    (submitted ? tag('已完成 ' + att.score + ' / ' + att.total, 'green') : tag(inProgress ? '作答中' : '待完成', inProgress ? 'amber' : 'blue')) + '</div>' +
    '<small>共 ' + p.items.length + ' 题 · 满分 ' + total + ' 分 · 限时 ' + p.duration + ' 分钟 · 生成于 ' + fmtDT(p.publishedAt) + '</small></div>' +
    '<div class="wrong-paper-actions">' + action +
    '<button class="btn btn-sm btn-ghost" data-act="deleteWrongTest" data-id="' + p.id + '">' + icon('trash') + '删除</button></div></div>';
}

function wrongPersonalTestsHTML() {
  var tests = myWrongTests();
  if (!tests.length) {
    return '<div class="wrong-empty">' + icon('bookOpen') + '<div><b>还没有个人错题测试</b><p>从下方错题清单中勾选题目，即可生成一份只属于你的重练试卷。</p></div></div>';
  }
  return '<div class="wrong-paper-list">' + tests.map(wrongTestCardHTML).join('') + '</div>';
}

function refreshWrongSelectionUI() {
  var selected = wrongSelectedEntries().map(function (e) { return e.qid; });
  var map = {};
  selected.forEach(function (qid) { map[qid] = true; });
  $$('[data-wrongq]').forEach(function (cb) {
    var on = !!map[cb.getAttribute('data-wrongq')];
    cb.checked = on;
    var item = cb.closest('.wrong-item');
    if (item) item.classList.toggle('selected', on);
  });
  var label = $('#wrongSelCount');
  if (label) label.textContent = '已选 ' + selected.length + ' 题';
  var btn = $('#wrongCreateBtn');
  if (btn) btn.disabled = selected.length === 0;
}

function refreshWrongList() {
  var wrap = $('#wrongList');
  if (wrap) wrap.innerHTML = wrongListHTML();
  var count = $('#wrongListCount');
  if (count) count.textContent = '当前显示 ' + wrongFilteredEntries().length + ' 道';
  refreshWrongSelectionUI();
}

function viewSWrongBook() {
  ensureWrongSelection();
  var all = wrongBookEntries();
  var tests = myWrongTests();
  var stats = DB.wrongBook || { total: all.length, remaining: 0, corrected: 0, paperCount: 0, kpCount: 0 };
  var html = pageHead('错题本', '汇总历次测评错题 · 生成只属于你的个人错题测试',
    '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回我的测试</button>');

  html += '<div class="stats">' +
    statCard('错题总数', (stats.total || 0) + '<small>道</small>', 'bookOpen', '') +
    statCard('待订正', (stats.remaining || 0) + '<small>道</small>', 'alert', 'amber') +
    statCard('已订正', (stats.corrected || 0) + '<small>道</small>', 'check', 'green') +
    statCard('错题测试', tests.length + '<small>份</small>', 'clipboard', 'purple') +
    '</div>';

  html += '<div class="alert info mb16">' + icon('info') + '<div>错题本只汇总当前学生自己的作答记录，教师和其他学生不可见。生成错题测试后，可在下方开始作答；提交后会自动判分并纳入学习诊断。</div></div>';

  html += '<div class="card mb16"><div class="card-head"><h3>' + icon('bookOpen') + '我的错题测试</h3>' +
    '<span class="sub">仅本人可见 · 可多次生成</span></div><div class="card-body">' + wrongPersonalTestsHTML() + '</div></div>';

  if (!all.length) {
    html += '<div class="card"><div class="card-body">' + emptyHTML('还没有错题记录', '完成一次教师发布的测评后，答错的题会自动收进错题本。', 'bookOpen') + '</div></div>';
    return html;
  }

  html += '<div class="card"><div class="card-head"><h3>错题清单</h3><span class="sub" id="wrongListCount">当前显示 ' + wrongFilteredEntries().length + ' 道</span></div>' +
    '<div class="card-body">' + wrongToolbarHTML() + '<div id="wrongList">' + wrongListHTML() + '</div></div></div>';
  refreshWrongSelectionUI();
  return html;
}

/* ---------------- 历史记录 ---------------- */
function viewSHistory() {
  var list = attemptsOf();
  var rates = list.map(function (a) { return pct(a.score, a.total); });
  var avg = rates.length ? Math.round(rates.reduce(function (a, b) { return a + b; }, 0) / rates.length) : 0;
  var best = rates.length ? Math.max.apply(null, rates) : 0;
  if (isStudentMobile()) return viewSHistoryMobile(list, avg, best);
  var html = pageHead('历史记录', '历次测评成绩与知识点变化',
    '<button class="btn" data-act="go" data-to="s/tests">' + icon('arrowLeft') + '返回我的测试</button>');

  html += '<div class="stats">' +
    statCard('参测次数', list.length + '<small>次</small>', 'clipboard', '') +
    statCard('平均正确率', avg + '%', 'target', 'green') +
    statCard('最好成绩', best + '%', 'check', 'purple') +
    statCard('学习报告', list.length + '<small>份</small>', 'spark', 'amber') +
    '</div>';

  if (list.length) {
    html += '<div class="card mb16"><div class="card-head"><h3>成绩趋势</h3><span class="sub">按测评时间排序</span></div><div class="card-body"><div class="hbars" style="height:130px">' +
      list.slice().reverse().map(function (a) {
        var r = pct(a.score, a.total);
        var p = PAPER(a.paperId);
        return '<div class="hbar-col"><div class="hb" style="height:' + Math.max(8, Math.round(r * 0.85)) + 'px"><span>' + r + '%</span></div><div class="cap">' + (p ? esc(p.name.replace('知识点测验', '')) : '') + '</div></div>';
      }).join('') + '</div></div></div>';
  }

  html += '<div class="card"><div class="card-head"><h3>测评记录</h3><span class="sub">共 ' + list.length + ' 条</span></div>' +
    '<div class="table-wrap"><table class="tb"><thead><tr><th>测评名称</th><th>提交时间</th><th>得分</th><th>正确率</th><th>表现等级</th><th>操作</th></tr></thead><tbody>' +
    (list.length ? list.map(function (a) {
      var p = PAPER(a.paperId);
      var r = pct(a.score, a.total);
      var lv = levelOf(r);
      return '<tr><td class="cell-main">' + esc(p ? p.name : '—') + '<div class="cell-sub">' + (p ? esc(p.teacherName) : '') + '</div></td>' +
        '<td class="small muted">' + fmtDT(a.submittedAt) + '</td><td class="num"><b>' + a.score + '</b> / ' + a.total + '</td>' +
        '<td class="num">' + r + '%</td><td>' + tag(lv.label, lv.cls) + '</td>' +
        '<td><div class="actions"><button class="btn btn-sm btn-ghost" data-act="go" data-to="s/result/' + a.id + '">结果</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="go" data-to="s/report/' + a.id + '">' + icon('spark') + '诊断</button></div></td></tr>';
    }).join('') : '<tr><td colspan="6">' + emptyHTML('还没有测评记录', '完成一次测评后即可查看。', 'clock') + '</td></tr>') +
    '</tbody></table></div></div>';
  return html;
}

/* ---------------- 学生移动端：历史记录 ---------------- */
function viewSHistoryMobile(list, avg, best) {
  var html = '<div class="stats">' +
    statCard('参测次数', list.length + '<small>次</small>', 'clipboard', '') +
    statCard('平均正确率', avg + '%', 'target', 'green') +
    statCard('最好成绩', best + '%', 'check', 'purple') +
    statCard('学习报告', list.length + '<small>份</small>', 'spark', 'amber') +
    '</div>';

  if (list.length) {
    html += '<div class="card m-chart-card"><div class="card-head"><h3>成绩趋势</h3><span class="sub">按测评时间排序</span></div>' +
      '<div class="card-body"><div class="hbars m-hbars" style="height:130px">' +
      list.slice().reverse().map(function (a) {
        var r = pct(a.score, a.total);
        var p = PAPER(a.paperId);
        return '<div class="hbar-col"><div class="hb" style="height:' + Math.max(8, Math.round(r * 0.85)) + 'px"><span>' + r + '%</span></div>' +
          '<div class="cap">' + (p ? esc(p.name.replace('知识点测验', '')) : '') + '</div></div>';
      }).join('') + '</div></div></div>';
  }

  html += mobileSectionHead('测评记录', '共 ' + list.length + ' 条');
  if (list.length) {
    html += '<div class="m-record-list">' + list.map(function (a) {
      var p = PAPER(a.paperId);
      var r = pct(a.score, a.total);
      var lv = levelOf(r);
      return '<div class="m-record-card"><div class="m-record-top"><b>' + esc(p ? p.name : '—') + '</b>' +
        '<span class="m-record-score">' + a.score + '<small>/' + a.total + '</small></span></div>' +
        '<div class="m-record-sub">' + (p ? esc(p.teacherName) + ' · ' : '') + fmtDT(a.submittedAt) + ' · 正确率 ' + r + '%</div>' +
        '<div class="m-record-foot">' + tag(lv.label, lv.cls) +
        '<div class="m-record-actions"><button class="btn btn-sm" data-act="go" data-to="s/result/' + a.id + '">结果</button>' +
        '<button class="btn btn-sm btn-soft" data-act="go" data-to="s/report/' + a.id + '">' + icon('spark') + '诊断</button></div></div></div>';
    }).join('') + '</div>';
  } else {
    html += '<div class="card"><div class="card-body">' + emptyHTML('还没有测评记录', '完成一次测评后即可查看。', 'clock') + '</div></div>';
  }
  return html;
}
