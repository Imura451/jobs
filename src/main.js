/* =====================================================================
   外国人材募集企業バンク ― 画面の動き

   1. ふりがなの表示・非表示
   2. 求人の絞り込み（一覧ページ）
   3. 募集の期限が過ぎていないかの確認（企業ページ）
   4. シェア（URLコピー・Zalo）
   5. 動画（押したときだけ読み込む）
   6. 応募・相談フォーム

   文言はこのファイルに書きません。ページから受け取った window.JOBS を使います。
   ===================================================================== */
(function () {
  'use strict';
  var J = window.JOBS || { t: {} };
  var T = J.t || {};
  var each = function (sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); };
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* 日本時間の今日（YYYY-MM-DD） */
  function todayJST() { return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }

  /* ------------------------------------------------------------------
     1. ふりがな
     ------------------------------------------------------------------ */
  var furi = document.querySelector('[data-furi]');
  if (furi) {
    var setFuri = function (on) {
      document.documentElement.classList.toggle('no-ruby', !on);
      furi.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    setFuri(store('jobs-furi') !== 'off');
    furi.addEventListener('click', function () {
      var on = furi.getAttribute('aria-pressed') !== 'true';
      setFuri(on);
      store('jobs-furi', on ? 'on' : 'off');
    });
  }

  /* ------------------------------------------------------------------
     2. 絞り込み
     ------------------------------------------------------------------ */
  var box = document.getElementById('cards');
  if (box) {
    var cards = Array.prototype.slice.call(box.querySelectorAll('[data-card]'));
    /* 掲載順に優劣をつけないため、開くたびに順番を入れ替えます */
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    cards.forEach(function (c) { box.appendChild(c); });

    var sel = { who: '', region: '', field: '', visa: '', pref: '', status: '', myfield: '', jp: '' };
    var REG = window.PREF_REGION || {};
    var hits = document.getElementById('hits');
    var empty = document.getElementById('empty');
    var details = document.getElementById('filters');

    var match = function (c) {
      var d = c.dataset;
      if (sel.who === 'japan' && d.injapan !== '1') return false;
      if (sel.who === 'overseas' && d.overseas !== '1') return false;
      if (sel.region && d.region !== sel.region) return false;
      if (sel.field && d.field !== sel.field) return false;
      if (sel.visa && (',' + d.visas + ',').indexOf(',' + sel.visa + ',') < 0) return false;
      if (sel.pref === 'abroad') { if (d.overseas !== '1') return false; }
      else if (sel.pref) { if (d.injapan !== '1' || REG[sel.pref] !== d.region) return false; }
      if (sel.jp && Number(sel.jp) < Number(d.jp || 0)) return false;
      if (sel.status || sel.myfield) {
        var from = (d.from || '').split(';').filter(Boolean).map(function (x) { var p = x.split('|'); return { s: p[0], f: p[1] }; });
        if (sel.status) {
          var ok = from.some(function (e) { return e.s === sel.status && (!sel.myfield || !e.f || e.f === sel.myfield); });
          if (!ok) return false;
        } else if (d.field !== sel.myfield && !from.some(function (e) { return e.f === sel.myfield; })) {
          return false;
        }
      }
      return true;
    };
    var apply = function () {
      var n = 0;
      cards.forEach(function (c) { var ok = match(c); c.hidden = !ok; if (ok) n++; });
      if (hits) hits.textContent = n;
      if (empty) empty.hidden = n !== 0;
    };

    each('.frow', function (row) {
      var g = row.getAttribute('data-group');
      row.addEventListener('click', function (e) {
        var b = e.target.closest ? e.target.closest('.pill') : null;
        if (!b) return;
        each('.pill', function (x) { x.classList.remove('is-on'); }, row);
        b.classList.add('is-on');
        sel[g] = b.getAttribute('data-v') || '';
        apply();
      });
    });
    each('[data-sel]', function (s) {
      s.addEventListener('change', function () { sel[s.getAttribute('data-sel')] = s.value; apply(); });
    });

    /* 入口の2つのボタン */
    var setWho = function (w, scroll) {
      sel.who = w;
      each('.whobtn', function (b) { b.classList.toggle('is-on', b.getAttribute('data-who') === w); });
      /* 日本に住んでいる人には、今の在留資格から探す欄を開いて見せます */
      if (details && w === 'japan') details.open = true;
      apply();
      try { history.replaceState(null, '', w ? '?who=' + w + '#list' : location.pathname); } catch (e) { /* 何もしません */ }
      if (scroll) document.getElementById('list').scrollIntoView({ behavior: 'smooth' });
    };
    each('[data-who]', function (b) { b.addEventListener('click', function () { setWho(b.getAttribute('data-who'), true); }); });

    var reset = document.querySelector('[data-reset]');
    if (reset) reset.addEventListener('click', function () {
      Object.keys(sel).forEach(function (k) { if (k !== 'who') sel[k] = ''; });
      each('.frow', function (row) { each('.pill', function (x, i) { x.classList.toggle('is-on', x.getAttribute('data-v') === ''); }, row); });
      each('[data-sel]', function (s) { s.value = ''; });
      apply();
    });

    var w0 = (location.search.match(/[?&]who=(japan|overseas)/) || [])[1];
    if (w0) setWho(w0, false); else apply();
  }

  /* ------------------------------------------------------------------
     3. 募集の期限
        毎朝ページを作り直していますが、その前に開かれたときのための確認です
     ------------------------------------------------------------------ */
  var jobEl = document.querySelector('[data-deadline]');
  if (jobEl && jobEl.getAttribute('data-deadline') < todayJST()) {
    var banner = document.querySelector('[data-deadline-banner]');
    if (banner) banner.hidden = false;
    each('[data-apply], .bb__apply', function (a) {
      a.removeAttribute('href');
      a.classList.add('is-off');
      a.setAttribute('aria-disabled', 'true');
    });
  }

  /* ------------------------------------------------------------------
     4. シェア
     ------------------------------------------------------------------ */
  var msg = document.querySelector('.share__msg');
  var say = function (text) { if (!msg) return; msg.textContent = text; msg.hidden = false; };
  var copy = function (text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { window.prompt('URL', text); });
    } else {
      window.prompt('URL', text);
    }
  };
  each('[data-copy]', function (b) {
    b.addEventListener('click', function () { copy(b.getAttribute('data-copy'), function () { say(T.copied); }); });
  });
  /* Zalo は、スマートフォンの「共有」から選べます。使えない画面ではURLをコピーします */
  each('[data-share-zalo]', function (b) {
    b.addEventListener('click', function () {
      var url = b.getAttribute('data-url');
      if (navigator.share) {
        navigator.share({ title: b.getAttribute('data-title'), url: url }).catch(function () { /* 閉じただけ */ });
      } else {
        copy(url, function () { say(T.zaloHint); });
      }
    });
  });

  /* ------------------------------------------------------------------
     5. 動画
     ------------------------------------------------------------------ */
  each('.vid[data-video]', function (v) {
    v.addEventListener('click', function () {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(v.getAttribute('data-video')) + '?autoplay=1&rel=0';
      f.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture';
      f.allowFullscreen = true;
      f.title = 'video';
      var box2 = document.createElement('div');
      box2.className = 'vid-frame';
      box2.appendChild(f);
      v.parentNode.replaceChild(box2, v);
    });
  });

  /* ------------------------------------------------------------------
     6. 応募・相談フォーム
        会社サイト・人材バンクと同じ受け口に送ります。Gmail と Lark に届きます
     ------------------------------------------------------------------ */
  var form = document.getElementById('aform');
  if (form) {
    var A = T.apply || {};
    var send = document.getElementById('f-send');
    var out = document.getElementById('f-msgbox');
    var show = function (text, ok) { out.textContent = text; out.className = 'fmsg ' + (ok ? 'ok' : 'ng'); out.hidden = false; };

    /* 企業ページの「応募する」から来たときは、その求人を選んでおきます */
    var cid = (location.search.match(/[?&]c=([a-z0-9-]+)/) || [])[1];
    if (cid) {
      var opt = form.querySelector('#f-job option[data-id="' + cid + '"]');
      if (opt) opt.selected = true;
    }

    /* 送り出し機関・企業の方には、在留資格などの欄を出しません */
    var role = function () {
      var k = (form.querySelector('input[name="kind"]:checked') || {}).value;
      form.classList.toggle('is-agency', k === '送り出し機関');
      form.classList.toggle('is-company', k === '企業');
    };
    each('input[name="kind"]', function (r) { r.addEventListener('change', role); }, form);
    role();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = {};
      var fd = new FormData(form);
      fd.forEach(function (v, k) {
        v = String(v).trim();
        if (!v) return;
        data[k] = data[k] ? data[k] + '、' + v : v;
      });
      if (!data.name || !data.email || !data.message) { show(A.missing, false); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) { show(A.badEmail, false); return; }

      send.disabled = true;
      send.textContent = A.sending;
      out.hidden = true;
      fetch(J.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
        .then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
        .then(function (d) { if (d && d.ok) { form.reset(); role(); show(A.ok, true); } else { show(A.ng, false); } })
        .catch(function () { show(A.ng, false); })
        .then(function () { send.disabled = false; send.textContent = A.send; });
    });
  }
})();
