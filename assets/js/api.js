/* 服务端 API 客户端：所有业务数据以 PostgreSQL 为准 */
(function () {
  async function request(method, path, body, opts) {
    opts = opts || {};
    var headers = { 'Accept': 'application/json' };
    if (body !== undefined && body !== null) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(path, {
        method: method,
        headers: headers,
        credentials: 'same-origin',
        body: body === undefined || body === null ? undefined : JSON.stringify(body)
      });
    } catch (e) {
      throw new Error('无法连接服务器，请确认服务已启动');
    }
    var data = null;
    var text = await res.text();
    if (text) {
      try { data = JSON.parse(text); } catch (e) { data = { message: text }; }
    }
    if (res.status === 401 && !opts.allow401) {
      location.replace('index.html');
      throw new Error('登录已失效');
    }
    if (!res.ok) {
      var err = new Error((data && data.message) || ('请求失败（' + res.status + '）'));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  var clockOffset = 0;
  function syncClock(value) {
    if (!value) return;
    var t = new Date(value).getTime();
    if (isFinite(t)) clockOffset = t - Date.now();
  }
  window.serverNowMs = function () { return Date.now() + clockOffset; };
  window.syncServerClock = syncClock;

  function withClock(resp) {
    if (resp && resp.serverTime) syncClock(resp.serverTime);
    if (resp && resp.serverNow) syncClock(resp.serverNow);
    return resp;
  }

  window.API = {
    login: function (username, password) {
      return request('POST', 'api/auth/login', { username: username, password: password }, { allow401: true }).then(withClock);
    },
    me: function () { return request('GET', 'api/auth/me', null, { allow401: true }).then(withClock); },
    logout: function () { return request('POST', 'api/auth/logout', {}); },
    bootstrap: function () { return request('GET', 'api/bootstrap').then(withClock); },

    addKp: function (kp) { return request('POST', 'api/kps', kp); },
    addQuestion: function (q) { return request('POST', 'api/questions', q); },
    addTeacher: function (t) { return request('POST', 'api/teachers', t); },
    addStudent: function (s) { return request('POST', 'api/students', s); },
    addCourse: function (c) { return request('POST', 'api/courses', c); },
    publishPaper: function (p) { return request('POST', 'api/papers', p); },
    endPaper: function (id) { return request('POST', 'api/papers/' + encodeURIComponent(id) + '/end', {}); },
    resetTeacherPassword: function (id) { return request('POST', 'api/teachers/' + encodeURIComponent(id) + '/reset-password', {}); },
    audit: function (action, detail) { return request('POST', 'api/audit', { action: action, detail: detail }); },

    startAttempt: function (paperId) { return request('POST', 'api/attempts/start', { paperId: paperId }).then(withClock); },
    saveAttempt: function (id, answers) { return request('PUT', 'api/attempts/' + encodeURIComponent(id) + '/answers', { answers: answers || {} }).then(withClock); },
    submitAttempt: function (id, answers) { return request('POST', 'api/attempts/' + encodeURIComponent(id) + '/submit', { answers: answers || {} }).then(withClock); },
    aiStatus: function () { return request('GET', 'api/ai/status'); },
    aiDiagnose: function (attemptId) { return request('POST', 'api/ai/diagnose', { attemptId: attemptId }); },
    importRows: function (kind, rows, commit) {
      return request('POST', 'api/import/' + encodeURIComponent(kind), { rows: rows, commit: !!commit });
    }
  };

  window.reloadDB = async function () {
    var data = await API.bootstrap();
    window.DB = data;
    window.user = data.user;
    return data;
  };
})();
