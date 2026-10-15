#!/usr/bin/env node
/*
 * 外国人材募集企業バンク（求人サイト）― ページを書き出す
 *
 *   node build.js
 *
 * 読むもの
 *   data/settings.json        … 連絡先・検索エンジンの設定
 *   data/companies/*.json     … 企業（1社＝1ファイル）
 *   lang/ja.json・en.json     … 画面の文言（やさしい日本語・英語）
 *   src/style.css・main.js    … 見た目と動き
 *   assets/                   … ロゴ・シェア画像・企業の写真
 *
 * 書き出すもの（docs/。毎回すべて作り直します）
 *   docs/index.html           … 求人の一覧（やさしい日本語）
 *   docs/c/<企業ID>.html      … 企業ごとのページ
 *   docs/flow.html            … 日本で転職するときの流れ
 *   docs/apply.html           … 応募・相談フォーム
 *   docs/en/…                 … 英語のページ（同じ構成）
 *
 * 募集の期限（deadline）を過ぎた求人は、データを変えなくても「募集終了」として扱います。
 * GitHub Actions で毎朝作り直すので、期限の翌朝には一覧から外れます。
 *
 * Node.js の標準機能だけで動きます。追加のインストールは不要です。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA = path.join(ROOT, 'data');
const COMP_DIR = path.join(DATA, 'companies');
const LANG_DIR = path.join(ROOT, 'lang');
const SRC = path.join(ROOT, 'src');
const ASSETS = path.join(ROOT, 'assets');
const DOCS = path.join(ROOT, 'docs');

/* 言語。先頭が基本の言語で、サイトのいちばん上に置きます。
   ベトナム語などを足すときは、lang/vi.json を作ってここに 'vi' を足します */
const LANGS = ['ja', 'en'];
const BASE_LANG = LANGS[0];

/* 状態（data の status に書く言葉） */
const ST_OPEN = '募集中', ST_SELECTING = '選考中', ST_CLOSED = '募集終了';

/* 特定技能の分野。絞り込みの並び順にも使います */
const FIELDS = ['介護', 'ビルクリーニング', '工業製品製造業', '建設', '造船・舶用工業', '自動車整備', '航空',
  '宿泊', '自動車運送業', '鉄道', '農業', '漁業', '飲食料品製造業', '外食業', '林業', '木材産業'];
const VISAS = ['技能実習', '育成就労', '特定技能1号', '特定技能2号', '技人国'];
/* 在留資格の大きな区分。一覧のいちばん上で、この4つに分けて探せます */
const CATS = ['jinou', 'ikusei', 'tokutei', 'gijinkoku'];
const VISA_CAT = { '技能実習': 'jinou', '育成就労': 'ikusei', '特定技能1号': 'tokutei', '特定技能2号': 'tokutei', '技人国': 'gijinkoku' };
/* 以前の書き方（育成就労・技能実習）は、2つに分けて読みます */
const VISA_OLD = { '育成就労・技能実習': ['技能実習', '育成就労'] };
const catsOf = c => Array.from(new Set((c.visas || []).map(v => VISA_CAT[v]).filter(Boolean)));
const STATUSES = ['特定技能1号', '特定技能2号', '技能実習2号修了', '技能実習3号修了', '技能実習中',
  '留学', '技人国', '特定活動', '家族滞在', 'その他'];
/* 日本語のレベル。数字が大きいほど高い。JFT-Basic は N4 と同じ扱い */
const JP_RANK = { none: 0, N5: 1, JFT: 2, N4: 2, N3: 3, N2: 4, N1: 5 };
const JP_ORDER = ['none', 'N5', 'JFT', 'N4', 'N3', 'N2', 'N1'];

/* 都道府県 → [英語, 地域] */
const PREFS = [
  ['北海道', 'Hokkaido', 'hokkaido'], ['青森県', 'Aomori', 'tohoku'], ['岩手県', 'Iwate', 'tohoku'],
  ['宮城県', 'Miyagi', 'tohoku'], ['秋田県', 'Akita', 'tohoku'], ['山形県', 'Yamagata', 'tohoku'],
  ['福島県', 'Fukushima', 'tohoku'], ['茨城県', 'Ibaraki', 'kanto'], ['栃木県', 'Tochigi', 'kanto'],
  ['群馬県', 'Gunma', 'kanto'], ['埼玉県', 'Saitama', 'kanto'], ['千葉県', 'Chiba', 'kanto'],
  ['東京都', 'Tokyo', 'kanto'], ['神奈川県', 'Kanagawa', 'kanto'], ['新潟県', 'Niigata', 'chubu'],
  ['富山県', 'Toyama', 'chubu'], ['石川県', 'Ishikawa', 'chubu'], ['福井県', 'Fukui', 'chubu'],
  ['山梨県', 'Yamanashi', 'chubu'], ['長野県', 'Nagano', 'chubu'], ['岐阜県', 'Gifu', 'chubu'],
  ['静岡県', 'Shizuoka', 'chubu'], ['愛知県', 'Aichi', 'chubu'], ['三重県', 'Mie', 'kinki'],
  ['滋賀県', 'Shiga', 'kinki'], ['京都府', 'Kyoto', 'kinki'], ['大阪府', 'Osaka', 'kinki'],
  ['兵庫県', 'Hyogo', 'kinki'], ['奈良県', 'Nara', 'kinki'], ['和歌山県', 'Wakayama', 'kinki'],
  ['鳥取県', 'Tottori', 'chugoku'], ['島根県', 'Shimane', 'chugoku'], ['岡山県', 'Okayama', 'chugoku'],
  ['広島県', 'Hiroshima', 'chugoku'], ['山口県', 'Yamaguchi', 'chugoku'], ['徳島県', 'Tokushima', 'shikoku'],
  ['香川県', 'Kagawa', 'shikoku'], ['愛媛県', 'Ehime', 'shikoku'], ['高知県', 'Kochi', 'shikoku'],
  ['福岡県', 'Fukuoka', 'kyushu'], ['佐賀県', 'Saga', 'kyushu'], ['長崎県', 'Nagasaki', 'kyushu'],
  ['熊本県', 'Kumamoto', 'kyushu'], ['大分県', 'Oita', 'kyushu'], ['宮崎県', 'Miyazaki', 'kyushu'],
  ['鹿児島県', 'Kagoshima', 'kyushu'], ['沖縄県', 'Okinawa', 'kyushu']
];
const PREF = {};
PREFS.forEach(([ja, en, region]) => { PREF[ja] = { ja, en, region }; });
const REGIONS = ['hokkaido', 'tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushu'];

const warnings = [];
const warn = m => warnings.push(m);

/* ================================================================== *
 * 1. 道具
 * ================================================================== */
function readJSON(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  try { return JSON.parse(text); }
  catch (e) {
    /* 書き間違いの場所を、行と文字の位置で知らせます */
    const m = /position (\d+)/.exec(e.message);
    if (m) {
      const pos = Number(m[1]);
      const before = text.slice(0, pos);
      const line = before.split('\n').length;
      const col = pos - before.lastIndexOf('\n');
      console.error(`エラー: ${path.relative(ROOT, file)} の ${line}行目 ${col}文字目あたりの書き方がおかしいです。`);
      console.error('        カンマ（,）の付け忘れ・付けすぎ、" の閉じ忘れがないか確かめてください。');
    } else {
      console.error(`エラー: ${path.relative(ROOT, file)} が読めません → ${e.message}`);
    }
    process.exit(1);
  }
}

function esc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 「漢字{かんじ}」→ ふりがな付きの HTML。直前に続く漢字だけに付きます */
const RUBY = /([\u3005\u3006\u30F6\u4E00-\u9FFF]+)\{([^{}]+)\}/g;
function ruby(s) { return esc(s).replace(RUBY, '<ruby>$1<rt>$2</rt></ruby>'); }
/* ふりがなを外した、ただの文字（タイトル・説明文・検索エンジン向け） */
function plain(s) { return String(s === undefined || s === null ? '' : s).replace(RUBY, '$1'); }
/* 改行を <br> に */
function multi(s) { return ruby(s).replace(/\r?\n/g, '<br>'); }

/* {ja, en} の形から、その言語の文を取り出します。無ければ日本語で代わりに出します */
function tr(v, lang) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return (v[lang] !== undefined && String(v[lang]).trim() !== '') ? String(v[lang]) : (v[BASE_LANG] || '');
  return '';
}
const has = v => v !== undefined && v !== null && String(v).trim() !== '';

/* 日本時間の今日（YYYY-MM-DD） */
function todayJST() {
  const d = new Date(Date.now() + 9 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso, lang) {
  if (!has(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (lang === 'en') {
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
    return `${mon} ${d}, ${y}`;
  }
  return `${y}年{ねん}${m}月{がつ}${d}日{にち}`;
}
const yen = n => Number(n).toLocaleString('en-US');

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copyDir(a, b);
    else fs.copyFileSync(a, b);
  }
}

function youtubeId(v) {
  if (!has(v)) return '';
  v = String(v).trim();
  if (/^[\w-]{8,20}$/.test(v)) return v;
  const m = /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{8,20})/.exec(v);
  return m ? m[1] : '';
}

/* ================================================================== *
 * 2. 読み込み
 * ================================================================== */
const S = readJSON(path.join(DATA, 'settings.json'));
const SITE = (S.siteUrl || '').replace(/\/?$/, '/');
const T = {};
for (const l of LANGS) T[l] = readJSON(path.join(LANG_DIR, l + '.json'));
const TODAY = todayJST();

function loadCompanies() {
  const out = [];
  const seen = new Set();
  const files = fs.readdirSync(COMP_DIR).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort();
  for (const f of files) {
    const c = readJSON(path.join(COMP_DIR, f));
    const id = String(c.id || '').trim();
    if (!/^[a-z0-9-]+$/.test(id)) { console.error(`エラー: ${f} の id は半角の小文字・数字・ハイフンだけにしてください（いまは「${id}」）`); process.exit(1); }
    if (seen.has(id)) { console.error(`エラー: id「${id}」が2つあります。ファイルをコピーしたときは id を変えてください`); process.exit(1); }
    if (f !== id + '.json') warn(`${f}: ファイル名と id（${id}）がちがいます。そろえておくと探しやすくなります`);
    seen.add(id);

    const status = c.status || ST_OPEN;
    if (![ST_OPEN, ST_SELECTING, ST_CLOSED].includes(status)) {
      console.error(`エラー: ${f} の status は「${ST_OPEN}」「${ST_SELECTING}」「${ST_CLOSED}」のどれかにしてください（いまは「${status}」）`);
      process.exit(1);
    }
    const job = c.job || {};
    if (job.field && !FIELDS.includes(job.field)) warn(`${id}: job.field「${job.field}」は16分野の名前にありません`);
    c.visas = [].concat(...(c.visas || []).map(v => {
      if (VISA_OLD[v]) { warn(`${id}: visas の「${v}」は「${VISA_OLD[v].join('」「')}」に分けて書いてください（いまは両方として扱っています）`); return VISA_OLD[v]; }
      if (!VISAS.includes(v)) warn(`${id}: visas の「${v}」は書ける言葉にありません（${VISAS.join('・')}）`);
      return [v];
    }));
    if (!c.visas.length) warn(`${id}: visas（募集する在留資格）が空です`);
    (c.fromStatus || []).forEach(s => { if (!STATUSES.includes(s.status)) warn(`${id}: fromStatus の「${s.status}」は書ける言葉にありません`); });
    const pref = (c.location || {}).prefecture;
    if (!PREF[pref]) warn(`${id}: location.prefecture「${pref}」は都道府県の名前になっていません（例：愛知県）`);
    const jp = (c.terms || {}).japanese || 'none';
    if (!(jp in JP_RANK)) warn(`${id}: terms.japanese「${jp}」は none・N5・JFT・N4・N3・N2・N1 のどれかにしてください`);

    /* 期限を過ぎたら、データが「募集中」のままでも募集終了として扱います */
    const expired = has(c.deadline) && c.deadline < TODAY;
    const closed = status === ST_CLOSED || expired;
    const photos = (((c.company || {}).photos) || []).filter(p => {
      const ok = fs.existsSync(path.join(ASSETS, 'companies', id, p));
      if (!ok) warn(`${id}: 写真 assets/companies/${id}/${p} が見つかりません`);
      return ok;
    });
    out.push(Object.assign({}, c, {
      id, status, closed, expired, selecting: !closed && status === ST_SELECTING,
      photosOk: photos, published: c.published !== false, sample: c.sample === true
    }));
  }
  return out;
}
const COMPANIES = loadCompanies();
const PUBLISHED = COMPANIES.filter(c => c.published && (S.showSamples || !c.sample));
const OPEN = PUBLISHED.filter(c => !c.closed);

/* ================================================================== *
 * 3. ページの部品
 * ================================================================== */
/* ページの置き場所から、サイトのいちばん上までの相対パス */
const upTo = rel => '../'.repeat(rel.split('/').length - 1);
/* 言語ごとのフォルダ（基本の言語は一番上、ほかは en/ など） */
const langDir = l => (l === BASE_LANG ? '' : l + '/');

function robotsMeta(c) {
  if (!S.searchEngines || (c && c.sample)) return '<meta name="robots" content="noindex,nofollow">';
  return '';
}

function contactButtons(t, cls) {
  const m = S.messengers || {};
  const items = [];
  if (has(m.line)) items.push(`<a class="mbtn mbtn--line" href="${esc(m.line)}" target="_blank" rel="noopener">${esc(t.contactBtns.line)}</a>`);
  if (has(m.messenger)) items.push(`<a class="mbtn mbtn--fb" href="${esc(m.messenger)}" target="_blank" rel="noopener">${esc(t.contactBtns.messenger)}</a>`);
  if (has(m.zalo)) items.push(`<a class="mbtn mbtn--zalo" href="${esc(m.zalo)}" target="_blank" rel="noopener">${esc(t.contactBtns.zalo)}</a>`);
  if (has(m.whatsapp)) items.push(`<a class="mbtn mbtn--wa" href="${esc(m.whatsapp)}" target="_blank" rel="noopener">${esc(t.contactBtns.whatsapp)}</a>`);
  return items.length ? `<div class="mbtns ${cls || ''}">${items.join('')}</div>` : '';
}

function freeBox(t) {
  return `<div class="free">
  <p class="free__item"><b>${ruby(t.free.title)}</b><span>${ruby(t.free.body)}</span></p>
  <p class="free__item"><b>${ruby(t.free.secretTitle)}</b><span>${ruby(t.free.secretBody)}</span></p>
</div>`;
}

function shareBox(t, url, title) {
  const u = encodeURIComponent(url), tt = encodeURIComponent(plain(title));
  return `<section class="sec share" aria-labelledby="share-h">
  <div class="wrap">
    <h2 class="h2" id="share-h">${ruby(t.job.sec.share)}</h2>
    <p class="share__free">${ruby(t.share.free)}</p>
    <div class="share__btns">
      <a class="sbtn sbtn--fb" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener">Facebook</a>
      <a class="sbtn sbtn--line" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener">LINE</a>
      <a class="sbtn sbtn--wa" href="https://wa.me/?text=${tt}%20${u}" target="_blank" rel="noopener">WhatsApp</a>
      <button type="button" class="sbtn sbtn--zalo" data-share-zalo data-url="${esc(url)}" data-title="${esc(plain(title))}">Zalo</button>
      <button type="button" class="sbtn sbtn--copy" data-copy="${esc(url)}">${esc(t.share.copy)}</button>
    </div>
    <p class="share__msg" role="status" aria-live="polite" hidden></p>
  </div>
</section>`;
}

/* ページ全体の枠 */
function layout({ lang, rel, title, desc, body, ogImage, ogType, jsonld, robots, altRel, bottomBar, pageKey }) {
  const t = T[lang];
  const up = upTo(rel);
  const canonical = SITE + rel.replace(/index\.html$/, '');
  const langLinks = LANGS.map(l => {
    const href = upTo(rel) + langDir(l) + altRel;
    return l === lang
      ? `<span class="lang__on" aria-current="true">${esc(T[l].short)}</span>`
      : `<a href="${esc(href)}" hreflang="${esc(T[l].htmlLang)}" data-lang="${esc(l)}">${esc(T[l].short)}</a>`;
  }).join('');
  const hreflang = LANGS.map(l => `<link rel="alternate" hreflang="${esc(T[l].htmlLang)}" href="${esc(SITE + langDir(l) + altRel.replace(/index\.html$/, ''))}">`).join('\n');
  const home = up + langDir(lang);
  const o = S.operator;
  const navCls = k => (k === pageKey ? ' aria-current="page"' : '');
  return `<!DOCTYPE html>
<html lang="${esc(t.htmlLang)}"${lang === 'ja' ? ' class="has-ruby"' : ''}>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(plain(title))}</title>
<meta name="description" content="${esc(plain(desc))}">
${robots || robotsMeta()}
<link rel="canonical" href="${esc(canonical)}">
${hreflang}
<meta property="og:type" content="${esc(ogType || 'website')}">
<meta property="og:site_name" content="${esc(plain(t.siteNamePlain))}">
<meta property="og:title" content="${esc(plain(title))}">
<meta property="og:description" content="${esc(plain(desc))}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage || SITE + 'ogp.png')}">
<meta property="og:locale" content="${lang === 'ja' ? 'ja_JP' : 'en_US'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(plain(title))}">
<meta name="twitter:description" content="${esc(plain(desc))}">
<meta name="twitter:image" content="${esc(ogImage || SITE + 'ogp.png')}">
<link rel="icon" href="${up}logo.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap">
<link rel="stylesheet" href="${up}style.css">
${jsonld ? `<script type="application/ld+json">${jsonld}</script>` : ''}
</head>
<body>
<a class="skip" href="#main">${lang === 'ja' ? '本文へ' : 'Skip to content'}</a>
<header class="hd">
  <div class="wrap hd__in">
    <a class="hd__brand" href="${home}">
      <img src="${up}logo.png" width="400" height="425" alt="">
      <span><b>${esc(o.brand)}</b><small>${ruby(t.brandSub)}</small></span>
    </a>
    <div class="hd__tools">
      ${lang === 'ja' ? `<button type="button" class="furi" data-furi aria-pressed="true">${ruby(t.furigana)}</button>` : ''}
      <nav class="lang" aria-label="Language">${langLinks}</nav>
    </div>
  </div>
  <nav class="gnav" aria-label="Menu">
    <div class="wrap gnav__in">
      <a href="${home}"${navCls('index')}>${ruby(t.nav.jobs)}</a>
      <a href="${home}flow.html"${navCls('flow')}>${ruby(t.nav.flow)}</a>
      <a href="${home}apply.html" class="gnav__cta"${navCls('apply')}>${ruby(t.nav.apply)}</a>
    </div>
  </nav>
</header>

<main id="main">
${body}
</main>

<footer class="ft">
  <div class="wrap">
    <p class="ft__nofee">${ruby(t.foot.noFee)}</p>
    <p class="ft__links">
      <a href="${home}">${ruby(t.nav.jobs)}</a>
      <a href="${home}flow.html">${ruby(t.nav.flow)}</a>
      <a href="${home}apply.html">${ruby(t.nav.apply)}</a>
      <a href="${esc(S.candidatesUrl)}">${ruby(t.foot.bank)}</a>
      <a href="${esc(o.site)}">${ruby(t.foot.site)}</a>
    </p>
    <p class="ft__op">${ruby(t.foot.operator)}：${esc(o.corp)}／${esc(o.brand)}　${lang === 'ja' ? '代表取締役' : 'President'} ${esc(lang === 'ja' ? o.ceo : o.ceoEn)}<br>
      ${esc(lang === 'ja' ? o.zip + ' ' + o.address : o.addressEn)}<br>
      TEL <a href="tel:${esc(o.tel.replace(/-/g, ''))}">${esc(lang === 'ja' ? o.tel : o.telIntl)}</a>／Mail <a href="mailto:${esc(o.mail)}">${esc(o.mail)}</a>
      ${has((S.license || {}).text) ? `<br>${esc(S.license.text)}` : ''}</p>
  </div>
</footer>
${bottomBar || ''}
<script>window.JOBS=${JSON.stringify({ lang, endpoint: (S.form || {}).endpoint || '', t: { copied: plain(t.share.copied), zaloHint: plain(t.share.zaloHint), apply: { sending: plain(t.apply.sending), send: plain(t.apply.send), ok: plain(t.apply.ok), ng: plain(t.apply.ng), missing: plain(t.apply.missing), badEmail: plain(t.apply.badEmail) }, filter: { open: plain(t.filter.open), close: plain(t.filter.close) } } }).replace(/</g, '\\u003c')};</script>
<script src="${up}main.js" defer></script>
</body>
</html>
`;
}

function bottomBarHtml(t, applyHref, disabled) {
  const m = S.messengers || {};
  const line = has(m.line) ? `<a class="bb__line" href="${esc(m.line)}" target="_blank" rel="noopener">LINE</a>` : '';
  const btn = disabled
    ? `<span class="bb__apply is-off" aria-disabled="true">${ruby(t.job.applyClosed)}</span>`
    : `<a class="bb__apply" href="${esc(applyHref)}">${ruby(t.job.apply)}</a>`;
  return `<div class="bb" data-bb>${btn}${line}</div>`;
}

/* ================================================================== *
 * 4. 企業の表示用データ
 * ================================================================== */
function view(c, lang) {
  const t = T[lang];
  const comp = c.company || {}, loc = c.location || {}, job = c.job || {}, tm = c.terms || {};
  const pref = PREF[loc.prefecture] || { ja: loc.prefecture || '', en: loc.prefecture || '', region: '' };
  const prefName = lang === 'ja' ? pref.ja : pref.en;
  const place = lang === 'ja' ? `${prefName} ${tr(loc.city, lang)}` : `${tr(loc.city, lang)}, ${prefName}`;
  const unit = tm.salaryType === '時給' ? t.terms.hourly : t.terms.monthly;
  let salary = '';
  if (has(tm.salaryMin)) {
    salary = lang === 'ja'
      ? `${unit} ${yen(tm.salaryMin)}${has(tm.salaryMax) && tm.salaryMax !== tm.salaryMin ? '〜' + yen(tm.salaryMax) : ''}円{えん}`
      : `${unit} ${yen(tm.salaryMin)}${has(tm.salaryMax) && tm.salaryMax !== tm.salaryMin ? ' - ' + yen(tm.salaryMax) : ''} yen`;
  }
  /* 書いていない項目は「問いません」「なし」と出さず、空のままにします */
  const jp = tm.japanese || '';
  const jpLabel = !jp ? '' : jp === 'none' ? t.jpLevels.none : `${t.jpLevels[jp] || jp} ${t.jpNeed}`;
  const housing = !!(tm.housing && tm.housing.available);
  const housingKnown = !!(tm.housing && typeof tm.housing.available === 'boolean');
  const accept = c.accept || {};
  return {
    t, comp, loc, job, tm, pref, place, salary, jp, jpLabel, housing, housingKnown, accept,
    name: tr(comp.name, lang),
    title: tr(job.title, lang),
    fieldLabel: job.field ? (t.fields[job.field] || job.field) : '',
    visasLabel: (c.visas || []).map(v => t.visas[v] || v),
    catsLabel: catsOf(c).map(k => t.cats[k]),
    videoId: youtubeId(c.video),
    href: `c/${c.id}.html`
  };
}

function card(c, lang) {
  const v = view(c, lang), t = v.t;
  const from = (c.fromStatus || []).map(s => `${s.status}|${s.field || ''}|${s.noExam ? 1 : 0}`).join(';');
  const tags = [];
  if (v.accept.inJapan) tags.push(`<span class="tag tag--jp">${ruby(t.card.inJapan)}</span>`);
  if (v.accept.overseas) tags.push(`<span class="tag">${ruby(t.card.overseas)}</span>`);
  if (v.videoId) tags.push(`<span class="tag tag--video">${ruby(t.card.video)}</span>`);
  return `<a class="card" href="${esc(v.href)}" data-card
   data-region="${esc(v.pref.region)}" data-pref="${esc(v.loc.prefecture || '')}" data-field="${esc(v.job.field || '')}"
   data-visas="${esc((c.visas || []).join(','))}" data-cats="${esc(catsOf(c).join(','))}" data-jp="${JP_RANK[v.jp] || 0}"
   data-injapan="${v.accept.inJapan ? 1 : 0}" data-overseas="${v.accept.overseas ? 1 : 0}" data-from="${esc(from)}">
  <div class="card__top">
    ${c.sample ? `<span class="badge badge--sample">${ruby(t.card.sample)}</span>` : ''}
    ${c.selecting ? `<span class="badge">${ruby(t.card.selecting)}</span>` : ''}
    <span class="card__field">${ruby(v.fieldLabel)}</span>
  </div>
  <h3 class="card__name">${ruby(v.name)}</h3>
  <p class="card__job">${ruby(v.title)}</p>
  <p class="card__place">${ruby(v.place)}</p>
  <dl class="card__dl">
    ${v.salary ? `<div><dt>${ruby(t.card.salary)}</dt><dd class="hl">${ruby(v.salary)}</dd></div>` : ''}
    ${v.housingKnown ? `<div><dt>${ruby(t.card.housing)}</dt><dd>${ruby(v.housing ? t.card.housingYes : t.card.housingNo)}</dd></div>` : ''}
    ${v.jpLabel ? `<div><dt>${ruby(t.card.jp)}</dt><dd>${ruby(v.jpLabel)}</dd></div>` : ''}
    <div><dt>${ruby(t.terms.visas)}</dt><dd>${v.visasLabel.map(ruby).join('<br>')}</dd></div>
  </dl>
  <p class="card__tags">${v.catsLabel.map(x => `<span class="tag tag--cat">${ruby(x)}</span>`).join('')}${tags.join('')}</p>
  <span class="card__more">${ruby(t.card.more)}</span>
</a>`;
}

/* ================================================================== *
 * 5. 一覧ページ
 * ================================================================== */
function pills(group, opts, t) {
  return `<div class="frow" data-group="${group}">
  <div class="pills"><button type="button" class="pill is-on" data-v="">${ruby(t.filter.all)}</button>${opts.map(o => `<button type="button" class="pill" data-v="${esc(o.v)}">${ruby(o.t)}</button>`).join('')}</div>
</div>`;
}

function pageIndex(lang) {
  const t = T[lang];
  const rel = langDir(lang) + 'index.html';
  const list = OPEN;
  const regions = REGIONS.filter(r => list.some(c => (PREF[(c.location || {}).prefecture] || {}).region === r));
  const fields = FIELDS.filter(f => list.some(c => (c.job || {}).field === f));
  const catCount = k => list.filter(c => catsOf(c).includes(k)).length;
  const lastUpdated = list.map(c => c.updatedAt || c.postedAt || '').sort().pop() || TODAY;
  const prefOpts = PREFS.map(([ja, en]) => `<option value="${esc(ja)}">${esc(lang === 'ja' ? ja : en)}</option>`).join('');

  const filters = list.length ? `
<details class="filters" id="filters">
  <summary><span>${ruby(t.filter.title)}</span><b class="hits"><span id="hits">${list.length}</span> ${ruby(t.filter.hits)}</b></summary>
  <div class="filters__in">
    <div class="fbox fbox--me" data-me>
      <label class="fl"><span>${ruby(t.filter.myPref)}</span>
        <select data-sel="pref"><option value="">—</option>${prefOpts}<option value="abroad">${ruby(t.abroad)}</option></select>
        <small>${ruby(t.filter.myPrefNote)}</small></label>
      <label class="fl"><span>${ruby(t.filter.myStatus)}</span>
        <select data-sel="status"><option value="">—</option>${STATUSES.map(s => `<option value="${esc(s)}">${esc(plain(t.statuses[s] || s))}</option>`).join('')}</select></label>
      <label class="fl"><span>${ruby(t.filter.myField)}</span>
        <select data-sel="myfield"><option value="">—</option>${FIELDS.map(f => `<option value="${esc(f)}">${esc(plain(t.fields[f] || f))}</option>`).join('')}</select>
        <small>${ruby(t.filter.myStatusNote)}</small></label>
      <label class="fl"><span>${ruby(t.filter.jp)}</span>
        <select data-sel="jp"><option value="">—</option>${JP_ORDER.filter(k => k !== 'none').map(k => `<option value="${JP_RANK[k]}">${esc(plain(t.jpLevels[k]))}</option>`).join('')}</select>
        <small>${ruby(t.filter.jpNote)}</small></label>
    </div>
    ${regions.length > 1 ? `<p class="flabel">${ruby(t.filter.region)}</p>` + pills('region', regions.map(r => ({ v: r, t: t.regions[r] })), t) : ''}
    ${fields.length > 1 ? `<p class="flabel">${ruby(t.filter.field)}</p>` + pills('field', fields.map(f => ({ v: f, t: t.fields[f] || f })), t) : ''}
    <p class="freset"><button type="button" class="link" data-reset>${ruby(t.filter.reset)}</button></p>
  </div>
</details>` : '';

  const body = `
<section class="hero">
  <div class="wrap">
    <h1 class="hero__h1">${ruby(t.home.title)}</h1>
    <p class="hero__lead">${ruby(t.home.lead)}</p>
    <p class="count"><b>${ruby(t.home.openCount)} <span class="count__n">${list.length}</span>${ruby(t.home.openUnit)}</b><span>${ruby(t.home.updated)} ${ruby(fmtDate(lastUpdated, lang))}</span></p>
    ${freeBox(t)}
  </div>
</section>

<section class="who" aria-labelledby="who-h">
  <div class="wrap">
    <h2 class="who__h" id="who-h">${ruby(t.home.whoTitle)}</h2>
    <div class="who__btns">
      <button type="button" class="whobtn" data-who="japan"><b>${ruby(t.home.whoJapan)}</b><span>${ruby(t.home.whoJapanSub)}</span></button>
      <button type="button" class="whobtn" data-who="overseas"><b>${ruby(t.home.whoOverseas)}</b><span>${ruby(t.home.whoOverseasSub)}</span></button>
    </div>
    <p class="who__all"><button type="button" class="link" data-who="">${ruby(t.home.whoAll)}</button></p>
  </div>
</section>

<section class="cats" aria-labelledby="cats-h">
  <div class="wrap">
    <h2 class="who__h" id="cats-h">${ruby(t.cats.title)}</h2>
    <div class="cats__btns">
      ${CATS.map(k => { const n = catCount(k); return `<button type="button" class="catbtn" data-cat="${k}"${n ? '' : ' disabled'}><b>${ruby(t.cats[k])}</b>${t.cats[k + 'Sub'] ? `<small>${ruby(t.cats[k + 'Sub'])}</small>` : ''}<span class="catbtn__n">${n}${ruby(t.filter.hits)}</span></button>`; }).join('')}
    </div>
    <p class="who__all"><button type="button" class="link" data-cat="">${ruby(t.cats.all)}</button></p>
  </div>
</section>

<section class="sec" id="list" aria-labelledby="list-h">
  <div class="wrap">
    <h2 class="h2" id="list-h">${ruby(t.home.listTitle)}</h2>
    ${filters}
    ${list.length ? `<div class="cards" id="cards">${list.map(c => card(c, lang)).join('\n')}</div>
    <p class="empty" id="empty" hidden>${ruby(t.home.noMatch)}</p>
    <p class="note">${ruby(t.home.orderNote)}</p>` : `<p class="empty">${ruby(t.home.noJobs)}</p>`}
  </div>
</section>

<section class="sec sec--gray">
  <div class="wrap two">
    <div class="box">
      <h2 class="h3">${ruby(t.home.flowTitle)}</h2>
      <p>${ruby(t.home.flowBody)}</p>
      <p><a class="btn btn--ghost" href="flow.html">${ruby(t.home.flowBtn)}</a></p>
    </div>
    <div class="box">
      <h2 class="h3">${ruby(t.home.noMatchTitle)}</h2>
      <p>${ruby(t.home.noMatchBody)}</p>
      <p><a class="btn btn--ghost" href="${esc(S.candidatesContactUrl)}">${ruby(t.home.noMatchBtn)}</a></p>
    </div>
  </div>
</section>
<script>window.PREF_REGION=${JSON.stringify(Object.fromEntries(PREFS.map(([ja, , r]) => [ja, r])))};</script>`;

  return layout({
    lang, rel, altRel: 'index.html', pageKey: 'index',
    title: t.siteName, desc: t.metaDesc, body,
    bottomBar: bottomBarHtml(t, 'apply.html', false)
  });
}

/* ================================================================== *
 * 6. 企業ページ
 * ================================================================== */
function row(label, value, cls) {
  if (!has(value)) return '';
  return `<tr${cls ? ` class="${cls}"` : ''}><th scope="row">${ruby(label)}</th><td>${value}</td></tr>`;
}

function jobPostingLd(c, lang, v, url) {
  if (c.sample) return '';
  const tm = v.tm, loc = v.loc;
  const validThrough = c.closed
    ? (c.expired ? c.deadline : TODAY)
    : (has(c.deadline) ? c.deadline : '');
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: plain(`${v.title}`),
    description: [tr(c.job.description, lang), tr(c.company.business, lang)].filter(has).map(s => `<p>${esc(plain(s)).replace(/\n/g, '<br>')}</p>`).join(''),
    datePosted: c.postedAt,
    employmentType: 'FULL_TIME',
    hiringOrganization: Object.assign({ '@type': 'Organization', name: plain(v.name) }, has(c.company.website) ? { sameAs: c.company.website } : {}),
    jobLocation: {
      '@type': 'Place',
      address: { '@type': 'PostalAddress', addressRegion: v.pref.ja, addressLocality: plain(tr(loc.city, 'ja')), addressCountry: 'JP' }
    },
    url
  };
  if (validThrough) ld.validThrough = validThrough + 'T23:59:59+09:00';
  if (has(tm.salaryMin)) {
    ld.baseSalary = {
      '@type': 'MonetaryAmount', currency: 'JPY',
      value: Object.assign({ '@type': 'QuantitativeValue', unitText: tm.salaryType === '時給' ? 'HOUR' : 'MONTH' },
        has(tm.salaryMax) && tm.salaryMax !== tm.salaryMin ? { minValue: tm.salaryMin, maxValue: tm.salaryMax } : { value: tm.salaryMin })
    };
  }
  if (c.accept && c.accept.overseas) ld.applicantLocationRequirements = { '@type': 'Country', name: 'Worldwide' };
  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/* 住まいの紹介。写真と「ここがいい」を並べて、住む場所を思い浮かべてもらいます。
   data の housingShowcase に書いたときだけ出ます */
function housingShowcase(c, lang, up) {
  const hs = c.housingShowcase;
  if (!hs) return '';
  const t = T[lang];
  const photos = (hs.photos || []).filter(p => fs.existsSync(path.join(ASSETS, 'companies', c.id, p.file)));
  const money = (hs.money || []).filter(m => has(tr(m.value, lang)));
  const points = (hs.points || []).map(p => tr(p, lang)).filter(has);
  return `<section class="sec house" id="house">
  <div class="wrap">
    <p class="house__eyebrow">${ruby(t.house.eyebrow)}</p>
    <h2 class="house__title">${ruby(tr(hs.title, lang))}</h2>
    ${has(tr(hs.lead, lang)) ? `<p class="house__lead">${multi(tr(hs.lead, lang))}</p>` : ''}
    ${money.length ? `<div class="house__money">${money.map(m => `<div class="hm${m.strong ? ' hm--strong' : ''}"><span>${ruby(tr(m.label, lang))}</span><b>${ruby(tr(m.value, lang))}</b>${has(tr(m.note, lang)) ? `<small>${ruby(tr(m.note, lang))}</small>` : ''}</div>`).join('')}</div>` : ''}
    ${photos.length ? `<div class="house__photos">${photos.map(p => `<figure><img src="${up}assets/companies/${esc(c.id)}/${esc(p.file)}" alt="${esc(plain(tr(p.caption, lang)))}" loading="lazy"><figcaption>${ruby(tr(p.caption, lang))}</figcaption></figure>`).join('')}</div>
    <p class="house__swipe">${ruby(t.house.swipe)}</p>` : ''}
    ${points.length ? `<ul class="house__points">${points.map(p => `<li>${ruby(p)}</li>`).join('')}</ul>` : ''}
    ${has(tr(hs.note, lang)) ? `<p class="note">${ruby(tr(hs.note, lang))}</p>` : ''}
  </div>
</section>`;
}

function pageCompany(c, lang) {
  const v = view(c, lang), t = v.t, tm = v.tm, comp = v.comp, loc = v.loc;
  const rel = langDir(lang) + v.href;
  const up = upTo(rel);
  const url = SITE + rel;
  const applyHref = `../apply.html?c=${encodeURIComponent(c.id)}`;
  const off = c.closed || c.sample;
  const h = tm.housing || {};

  const fromList = (c.fromStatus || []).map(s => {
    const st = t.statuses[s.status] || s.status;
    const fld = s.field ? (t.fields[s.field] || s.field) : t.terms.anyField;
    const ex = s.noExam ? `<span class="ex-ok">${ruby(t.terms.noExam)}</span>` : `<span class="ex-ng">${ruby(t.terms.examNeeded)}</span>`;
    return `<li>${ruby(st)}（${ruby(fld)}）${ex}${has(tr(s.note, lang)) ? `<br><small>${ruby(tr(s.note, lang))}</small>` : ''}</li>`;
  }).join('');
  const iv = c.interview || {};
  const methods = (iv.methods || []).map(m => ruby((t.interviewMethods || {})[m] || m)).join('、');
  const okng = b => (typeof b === 'boolean' ? ruby(b ? t.terms.ok : t.terms.ng) : '');

  const photos = v.comp.photos && c.photosOk.length
    ? `<div class="photos">${c.photosOk.map((p, i) => `<img src="${up}assets/companies/${esc(c.id)}/${esc(p)}" alt="${esc(plain(v.name))} ${i + 1}" loading="lazy">`).join('')}</div>` : '';

  const video = v.videoId
    ? `<button type="button" class="vid" data-video="${esc(v.videoId)}" aria-label="${esc(plain(t.job.videoPlay))}">
        <img src="https://i.ytimg.com/vi/${esc(v.videoId)}/hqdefault.jpg" alt="" loading="lazy"><span class="vid__play"></span></button>`
    : `<p class="muted">${ruby(t.job.noVideo)}</p>`;

  const mapQ = encodeURIComponent(loc.mapQuery || `${v.pref.ja}${plain(tr(loc.city, 'ja'))}`);

  const banner = c.closed
    ? `<div class="closed" role="status"><div class="wrap"><p class="closed__t">${ruby(t.job.closedTitle)}</p><p>${ruby(t.job.closedBody)}</p><p><a class="btn" href="../">${ruby(t.job.closedBtn)}</a></p></div></div>`
    : `<div class="closed" data-deadline-banner hidden role="status"><div class="wrap"><p class="closed__t">${ruby(t.job.closedTitle)}</p><p>${ruby(t.job.closedBody)}</p><p><a class="btn" href="../">${ruby(t.job.closedBtn)}</a></p></div></div>`;

  const applyBtn = off
    ? `<span class="btn is-off" aria-disabled="true">${ruby(c.closed ? t.job.applyClosed : t.job.apply)}</span>`
    : `<a class="btn" href="${esc(applyHref)}" data-apply>${ruby(t.job.apply)}</a>`;

  const body = `
${banner}
${c.sample ? `<div class="samplebar"><div class="wrap">${ruby(t.job.sampleNote)}</div></div>` : ''}
<article class="job" data-job="${esc(c.id)}"${!c.closed && has(c.deadline) ? ` data-deadline="${esc(c.deadline)}"` : ''}>
<section class="jhead">
  <div class="wrap">
    <p class="jhead__field">${ruby(v.fieldLabel)}${c.selecting ? ` <span class="badge">${ruby(t.card.selecting)}</span>` : ''}</p>
    <h1 class="jhead__name">${ruby(v.name)}</h1>
    <p class="jhead__job">${ruby(v.title)}</p>
    <p class="jhead__place">${ruby(v.place)}</p>
    <p class="card__tags">
      ${v.accept.inJapan ? `<span class="tag tag--jp">${ruby(t.card.inJapan)}</span>` : ''}
      ${v.accept.overseas ? `<span class="tag">${ruby(t.card.overseas)}</span>` : ''}
      ${v.catsLabel.map(x => `<span class="tag tag--cat">${ruby(x)}</span>`).join('')}
    </p>
    ${v.salary ? `<p class="jhead__pay">${ruby(v.salary)}</p>` : ''}
    ${c.selecting ? `<p class="note">${ruby(t.job.selectingNote)}</p>` : ''}
    <div class="jhead__act">${applyBtn}${contactButtons(t)}</div>
    ${freeBox(t)}
  </div>
</section>

<section class="sec">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.work)}</h2>
    <p>${multi(tr(c.job.description, lang))}</p>
  </div>
</section>

<section class="sec sec--gray">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.company)}</h2>
    ${photos}
    <table class="tbl"><tbody>
      ${row(t.terms.businessLabel, multi(tr(comp.business, lang)))}
      ${has(comp.employees) ? row(t.terms.employees, `${esc(comp.employees)}${ruby(t.terms.people)}`) : ''}
      ${comp.foreignStaff && has(comp.foreignStaff.count) ? row(t.terms.foreignStaff, `${esc(comp.foreignStaff.count)}${ruby(t.terms.people)}${has(tr(comp.foreignStaff.countries, lang)) ? `（${ruby(tr(comp.foreignStaff.countries, lang))}）` : ''}`) : ''}
      ${has(comp.website) ? row(t.job.website, `<a href="${esc(comp.website)}" target="_blank" rel="noopener">${esc(comp.website)}</a>`) : ''}
    </tbody></table>
  </div>
</section>

${housingShowcase(c, lang, up)}

<section class="sec">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(tr(c.videoTitle, lang) || t.job.sec.video)}</h2>
    ${video}
  </div>
</section>

${has(tr(c.imuraComment, lang)) ? `<section class="sec sec--gray">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.imura)}</h2>
    <div class="imura">
      <img src="${up}imura.jpg" alt="" width="96" height="96" loading="lazy">
      <div><p>${multi(tr(c.imuraComment, lang))}</p><p class="imura__by">${ruby(t.job.imuraBy)}</p></div>
    </div>
  </div>
</section>` : ''}

<section class="sec">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.place)}</h2>
    <p><b>${ruby(v.place)}</b>${has(tr(loc.station, lang)) ? `<br>${ruby(tr(loc.station, lang))}` : ''}</p>
    <div class="map"><iframe title="map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${mapQ}&amp;z=12&amp;output=embed"></iframe></div>
    <p><a href="https://www.google.com/maps/search/?api=1&amp;query=${mapQ}" target="_blank" rel="noopener">${ruby(t.job.mapOpen)}</a></p>
  </div>
</section>

<section class="sec sec--gray" id="terms">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.terms)}</h2>

    <h3 class="h3">${ruby(t.terms.group.basic)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.openings, has(tm.openings) ? `${esc(tm.openings)}${ruby(t.terms.people)}` : '')}
      ${row(t.terms.employment, ruby(tr(tm.employment, lang)))}
      ${row(t.terms.contract, ruby(tr(tm.contract, lang)))}
      ${row(t.terms.visas, v.visasLabel.map(ruby).join('<br>'))}
      ${row(t.terms.acceptInJapan, okng(v.accept.inJapan))}
      ${row(t.terms.acceptOverseas, okng(v.accept.overseas))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.pay)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.salary, ruby(v.salary))}
      ${row(t.terms.takeHome, ruby(tr(tm.takeHome, lang)))}
      ${row(t.terms.bonus, ruby(tr(tm.bonus, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.time)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.hours, ruby(tr(tm.hours, lang)))}
      ${row(t.terms.holidays, ruby(tr(tm.holidays, lang)))}
      ${row(t.terms.annualHolidays, has(tm.annualHolidays) ? `${esc(tm.annualHolidays)}${lang === 'ja' ? ruby(t.terms.days) : ' ' + esc(t.terms.days)}` : '')}
      ${row(t.terms.overtime, ruby(tr(tm.overtime, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.house)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.housing, typeof h.available === "boolean" ? ruby(h.available ? (tr(h.detail, lang) || t.terms.yes) : t.terms.no) : "")}
      ${row(t.terms.rent, ruby(tr(h.rent, lang)))}
      ${row(t.terms.housingAllowance, ruby(tr(h.allowance, lang)))}
      ${row(t.terms.utilities, ruby(tr(h.utilities, lang)))}
      ${row(t.terms.parking, ruby(tr(h.parking, lang)))}
      ${row(t.terms.initialCost, ruby(tr(h.initialCost, lang)))}
      ${row(t.terms.commute, ruby(tr(h.commute, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.skill)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.japanese, ruby(tr(tm.japaneseText, lang) || v.jpLabel))}
      ${row(t.terms.requirements, ruby(tr(tm.requirements, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.support)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.support, ruby(tr(tm.support, lang)))}
      ${row(t.terms.consultLanguages, ruby(tr(tm.consultLanguages, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.scope)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.changeScope, ruby(tr(tm.changeScope, lang)))}
    </tbody></table>

    <h3 class="h3">${ruby(t.terms.group.dates)}</h3>
    <table class="tbl"><tbody>
      ${row(t.terms.posted, ruby(fmtDate(c.postedAt, lang)))}
      ${row(t.terms.updated, ruby(fmtDate(c.updatedAt || c.postedAt, lang)))}
      ${row(t.terms.deadline, ruby(has(c.deadline) ? fmtDate(c.deadline, lang) : t.terms.noDeadline))}
    </tbody></table>
  </div>
</section>

${v.accept.inJapan ? `<section class="sec" id="in-japan">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.inJapan)}</h2>
    <table class="tbl"><tbody>
      ${row(t.terms.fromStatus, fromList ? `<ul class="from">${fromList}</ul>` : '')}
      ${row(t.terms.noExamNote, ruby(tr(c.noExamNote, lang)))}
      ${row(t.terms.leadInJapan, ruby(tr((c.leadTime || {}).inJapan, lang)))}
      ${row(t.terms.interview, methods)}
      ${row(t.terms.weekendNight, has(iv.weekendNight) ? ruby(iv.weekendNight ? t.terms.possible : t.terms.impossible) : '')}
      ${row(t.terms.travelCost, ruby(tr(iv.travelCost, lang)))}
      ${row(t.terms.moving, ruby(tr(tm.moving, lang)))}
      ${row(t.terms.visaSupport, ruby(tr(tm.visaSupport, lang)))}
    </tbody></table>
    <p><a href="../flow.html">${ruby(t.home.flowBtn)}</a></p>
  </div>
</section>` : ''}

${v.accept.overseas ? `<section class="sec${v.accept.inJapan ? ' sec--gray' : ''}" id="overseas">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.job.sec.overseas)}</h2>
    <table class="tbl"><tbody>
      ${row(t.terms.leadOverseas, ruby(tr((c.leadTime || {}).overseas, lang)))}
      ${row(t.terms.interview, methods)}
      ${row(t.terms.visaSupport, ruby(tr(tm.visaSupport, lang)))}
    </tbody></table>
  </div>
</section>` : ''}

<section class="sec sec--cta">
  <div class="wrap narrow">
    <div class="jhead__act">${applyBtn}${contactButtons(t)}</div>
    ${freeBox(t)}
  </div>
</section>
</article>
${shareBox(t, url, `${plain(v.name)}｜${plain(v.title)}`)}`;

  /* 中身が1行もない表は、見出しごと消します（書いていない項目を空の枠で見せないため） */
  const bodyClean = body.replace(/<h3 class="h3">(?:(?!<\/h3>)[\s\S])*<\/h3>\s*<table class="tbl"><tbody>\s*<\/tbody><\/table>/g, '');
  const hsFirst = ((c.housingShowcase || {}).photos || []).find(p => fs.existsSync(path.join(ASSETS, 'companies', c.id, p.file)));
  const photo = c.photosOk[0] || (hsFirst && hsFirst.file);
  return layout({
    lang, rel, altRel: v.href, pageKey: 'company',
    title: `${plain(v.name)}｜${plain(v.title)}｜${plain(v.place)}`,
    desc: `${plain(v.fieldLabel)}｜${plain(v.salary)}｜${plain(tr(c.job.description, lang)).replace(/\s+/g, ' ').slice(0, 90)}`,
    body: bodyClean, ogType: 'article',
    ogImage: photo ? `${SITE}assets/companies/${c.id}/${photo}` : '',
    jsonld: jobPostingLd(c, lang, v, url),
    robots: robotsMeta(c),
    bottomBar: bottomBarHtml(t, applyHref, off)
  });
}

/* ================================================================== *
 * 7. 転職の流れ
 * ================================================================== */
function pageFlow(lang) {
  const t = T[lang];
  const rel = langDir(lang) + 'flow.html';
  const body = `
${has(t.flow.draft) ? `<div class="draftbar"><div class="wrap">${ruby(t.flow.draft)}</div></div>` : ''}
<section class="sec">
  <div class="wrap narrow">
    <h1 class="h1">${ruby(t.flow.title)}</h1>
    <p class="lead">${ruby(t.flow.lead)}</p>
    <ol class="flow">
      ${t.flow.steps.map((s, i) => `<li class="flow__step"><span class="flow__n">${i + 1}</span><div><b>${ruby(s.t)}</b><p>${ruby(s.d)}</p></div></li>`).join('\n      ')}
    </ol>
    ${freeBox(t)}
  </div>
</section>
<section class="sec sec--gray">
  <div class="wrap narrow">
    <h2 class="h2">${ruby(t.flow.notesTitle)}</h2>
    <ul class="notes">${t.flow.notes.map(n => `<li>${ruby(n)}</li>`).join('')}</ul>
    <p><a class="btn" href="apply.html">${ruby(t.flow.cta)}</a></p>
    ${contactButtons(t)}
  </div>
</section>`;
  return layout({
    lang, rel, altRel: 'flow.html', pageKey: 'flow',
    title: `${plain(t.flow.title)}｜${plain(t.siteNamePlain)}`, desc: t.flow.lead, body,
    robots: '<meta name="robots" content="noindex,nofollow">',
    bottomBar: bottomBarHtml(t, 'apply.html', false)
  });
}

/* ================================================================== *
 * 8. 応募・相談フォーム
 * ================================================================== */
function pageApply(lang) {
  const t = T[lang], a = t.apply;
  const rel = langDir(lang) + 'apply.html';
  const jobs = PUBLISHED.map(c => {
    const v = view(c, lang);
    return { id: c.id, label: `${plain(v.name)}｜${plain(v.title)}`, closed: c.closed || c.sample };
  });
  const req = `<span class="req">${ruby(a.req)}</span>`, opt = `<span class="opt">${ruby(a.opt)}</span>`;
  const methods = ['電話', 'メール', 'LINE', 'Facebook Messenger', 'Zalo', 'WhatsApp'];
  const methodLabel = m => (lang === 'en' ? ({ '電話': 'Phone', 'メール': 'Email' }[m] || m) : m);
  const body = `
<section class="sec">
  <div class="wrap narrow">
    <h1 class="h1">${ruby(a.title)}</h1>
    <p class="lead">${ruby(a.lead)}</p>
    ${freeBox(t)}
    <form id="aform" class="form" novalidate>
      <input type="hidden" name="page" value="求人サイト（${esc(lang)}）">
      <p hidden><label>Leave empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>

      <div class="field"><label for="f-job">${ruby(a.jobFor)} ${opt}</label>
        <select id="f-job" name="jobPost"><option value="">${esc(plain(a.noJob))}</option>
        ${jobs.filter(j => !j.closed).map(j => `<option value="${esc(j.id + '｜' + j.label)}" data-id="${esc(j.id)}">${esc(j.label)}</option>`).join('')}</select></div>

      <fieldset class="field"><legend>${ruby(a.role)} ${req}</legend>
        <label class="radio"><input type="radio" name="kind" value="求職者" checked> <span>${ruby(a.roleSeeker)}</span></label>
        <label class="radio"><input type="radio" name="kind" value="送り出し機関"> <span>${ruby(a.roleAgency)}</span></label>
        <label class="radio"><input type="radio" name="kind" value="企業"> <span>${ruby(a.roleCompany)}</span></label>
      </fieldset>

      <div class="field"><label for="f-name">${ruby(a.name)} ${req}</label><input id="f-name" name="name" required autocomplete="name"></div>
      <div class="field"><label for="f-nat">${ruby(a.nationality)} ${opt}</label><input id="f-nat" name="nationality" autocomplete="country-name"></div>
      <div class="field"><label for="f-email">${ruby(a.email)} ${req}</label><input id="f-email" name="email" type="email" required autocomplete="email" inputmode="email"></div>
      <div class="field"><label for="f-tel">${ruby(a.tel)} ${opt}</label><input id="f-tel" name="tel" type="tel" autocomplete="tel" inputmode="tel"></div>

      <fieldset class="field"><legend>${ruby(a.contactBy)} ${opt}</legend>
        <div class="checks">${methods.map(m => `<label class="radio"><input type="checkbox" name="contactBy" value="${esc(m)}"> <span>${esc(methodLabel(m))}</span></label>`).join('')}</div>
      </fieldset>
      <div class="field"><label for="f-cid">${ruby(a.contactById)} ${opt}</label><input id="f-cid" name="contactId"></div>

      <div class="field seeker"><label for="f-pref">${ruby(a.pref)} ${opt}</label><input id="f-pref" name="prefecture" list="preflist"><datalist id="preflist">${PREFS.map(([ja, en]) => `<option value="${esc(lang === 'ja' ? ja : en)}">`).join('')}</datalist></div>
      <div class="field seeker"><label for="f-visa">${ruby(a.visaNow)} ${opt}</label><input id="f-visa" name="visaNow" placeholder="${esc(plain(a.visaNowPh))}"></div>
      <div class="field seeker"><label for="f-exp">${ruby(a.visaExpiry)} ${opt}</label><input id="f-exp" name="visaExpiry" type="date"></div>
      <div class="field seeker"><label for="f-jp">${ruby(a.jpLevel)} ${opt}</label>
        <select id="f-jp" name="jpLevel"><option value="">—</option>${JP_ORDER.filter(k => k !== 'none').map(k => `<option>${esc(plain(t.jpLevels[k]))}</option>`).join('')}<option>${lang === 'ja' ? 'わからない' : "I don't know"}</option></select></div>

      <div class="field"><label for="f-msg">${ruby(a.message)} ${req}</label><textarea id="f-msg" name="message" rows="5" required></textarea></div>

      <p class="small muted">${ruby(a.privacy)}</p>
      <p><button type="submit" class="btn btn--wide" id="f-send">${ruby(a.send)}</button></p>
      <p class="fmsg" id="f-msgbox" role="status" aria-live="polite" hidden></p>
    </form>

    <h2 class="h3">${ruby(a.orMessage)}</h2>
    ${contactButtons(t)}
  </div>
</section>`;
  return layout({
    lang, rel, altRel: 'apply.html', pageKey: 'apply',
    title: `${plain(a.title)}｜${plain(t.siteNamePlain)}`, desc: a.lead, body,
    robots: '<meta name="robots" content="noindex,nofollow">'
  });
}

/* ================================================================== *
 * 9. 書き出し
 * ================================================================== */
function write(rel, html) {
  const f = path.join(DOCS, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html, 'utf8');
}

function main() {
  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.mkdirSync(DOCS, { recursive: true });

  fs.copyFileSync(path.join(SRC, 'style.css'), path.join(DOCS, 'style.css'));
  fs.copyFileSync(path.join(SRC, 'main.js'), path.join(DOCS, 'main.js'));
  for (const f of ['logo.png', 'ogp.png', 'imura.jpg']) {
    if (fs.existsSync(path.join(ASSETS, f))) fs.copyFileSync(path.join(ASSETS, f), path.join(DOCS, f));
    else warn(`assets/${f} がありません`);
  }
  copyDir(path.join(ASSETS, 'companies'), path.join(DOCS, 'assets', 'companies'));

  for (const lang of LANGS) {
    write(langDir(lang) + 'index.html', pageIndex(lang));
    write(langDir(lang) + 'flow.html', pageFlow(lang));
    write(langDir(lang) + 'apply.html', pageApply(lang));
    for (const c of PUBLISHED) write(langDir(lang) + `c/${c.id}.html`, pageCompany(c, lang));
  }

  /* 見つからないページ */
  const t = T[BASE_LANG];
  write('404.html', layout({
    lang: BASE_LANG, rel: '404.html', altRel: 'index.html', pageKey: '',
    title: t.siteName, desc: t.metaDesc,
    robots: '<meta name="robots" content="noindex">',
    body: `<section class="sec"><div class="wrap narrow"><h1 class="h1">${ruby(t.job.closedTitle)}</h1><p>${ruby(t.job.closedBody)}</p><p><a class="btn" href="${esc(SITE)}">${ruby(t.job.closedBtn)}</a></p></div></section>`
  }).replace(/(href|src)="(?!https?:|mailto:|tel:|#)([^"]*)"/g, (m, a, p) => `${a}="${SITE}${p.replace(/^(\.\.\/)+/, '')}"`));

  /* 検索エンジン向け */
  const real = OPEN.filter(c => !c.sample);
  if (S.searchEngines) {
    fs.writeFileSync(path.join(DOCS, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
    const urls = [''].concat(...LANGS.map(l => [langDir(l)].concat(real.map(c => `${langDir(l)}c/${c.id}.html`))));
    const uniq = Array.from(new Set(urls));
    fs.writeFileSync(path.join(DOCS, 'sitemap.xml'),
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      uniq.map(u => `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n') + '\n</urlset>\n');
  } else {
    fs.writeFileSync(path.join(DOCS, 'robots.txt'), 'User-agent: *\nDisallow:\n# 準備中のため、各ページの noindex で検索結果から外しています\n');
  }
  fs.writeFileSync(path.join(DOCS, '.nojekyll'), '');

  /* 結果の報告 */
  console.log(`完了（${TODAY}）`);
  console.log(`  募集中 ${OPEN.length}件 ／ ページを作った企業 ${PUBLISHED.length}社`);
  for (const c of PUBLISHED) {
    const st = c.closed ? (c.expired && c.status !== ST_CLOSED ? '募集終了（期限切れ）' : '募集終了') : c.status;
    console.log(`  ${c.sample ? '[サンプル] ' : ''}${c.id}：${st} → ${SITE}c/${c.id}.html`);
  }
  if (!S.searchEngines) console.log('  ※ 検索エンジンには載せない設定です（settings.json の searchEngines）');
  if (warnings.length) {
    console.log('\n--- 確認してください ---');
    warnings.forEach(w => console.log('  ! ' + w));
  }
}

main();
