# -*- coding: utf-8 -*-
"""產生每日詳細日程 plan.js（2026/10/26 → 2027/5/16）。

用法：python tools/gen_plan.py      → 寫出 ../plan.js 並印出各階段的排程統計
要改日期、教材或配比，改這個檔案再重跑一次，不要手改 plan.js。
"""
import datetime as dt
import json
import os
import re
import sys
from collections import OrderedDict, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import books as TOC  # noqa: E402

D = dt.date


def d(m, day):
    return D(2026 if m >= 8 else 2027, m, day)


START, END = d(10, 26), d(5, 16)
VERSION = '20261026-3'
WDN = '一二三四五六日'                     # date.weekday(): 0 = 週一

# ───────────────────────── 行事曆 ─────────────────────────
HOLIDAY = OrderedDict([
    (d(10, 26), '光復節補假'), (d(12, 25), '行憲紀念日'), (d(12, 26), '連假'), (d(12, 27), '連假'),
    (d(1, 1), '元旦'), (d(1, 2), '連假'), (d(1, 3), '連假'),
    (d(2, 27), '連假'), (d(2, 28), '和平紀念日'), (d(3, 1), '和平紀念日補假'),
    (d(4, 3), '連假'), (d(4, 4), '兒童節'), (d(4, 5), '清明節'), (d(4, 6), '兒童節補假'),
    (d(4, 30), '勞動節補假'), (d(5, 1), '勞動節'), (d(5, 2), '連假'),
])
SPRING = OrderedDict([(d(2, 4), '小年夜'), (d(2, 5), '除夕'), (d(2, 6), '初一'), (d(2, 7), '初二'),
                      (d(2, 8), '初三'), (d(2, 9), '春節'), (d(2, 10), '春節')])
REST_DAYS = {d(2, 5), d(2, 6)}            # 除夕、初一：整天休息
WINTER = (d(1, 21), d(2, 10))
HANFU = {d(1, 21), d(1, 22), d(1, 25), d(1, 26), d(1, 27), d(1, 28), d(1, 29)}   # 寒輔（暫定，佔上午）
CRAM_LAST = d(3, 7)                       # 雄科班補習上到複試前的最後一個週末
GIFTED_LAST = d(3, 3)                     # 週三資優數學上到初試前

# 考試日：(名稱, 種類, 當天考科)
EXAM = {
    d(10, 28): ('二模 第一天', 'mock', '社會、數學、國文'),
    d(10, 29): ('二模 第二天', 'mock', '自然、英文'),
    d(11, 23): ('二段 第一天', 'term', ''),
    d(11, 24): ('二段 第二天', 'term', ''),
    d(12, 23): ('三模 第一天', 'mock', '社會、數學、國文'),
    d(12, 24): ('三模 第二天', 'mock', '自然、英文'),
    d(1, 18): ('三段 第一天', 'term3', ''),
    d(1, 19): ('三段 第二天', 'term3', ''),
    d(2, 18): ('四模 第一天', 'mock', '社會、數學、國文'),     # 2026-10-26 使用者確認：舊記憶的模考日程正確
    d(2, 19): ('四模 第二天', 'mock', '自然、英文'),
    d(3, 6): ('科學班初試（推估，簡章為準）', 'kb1', ''),
    d(3, 13): ('科學班複試（推估）', 'kb2', ''),
    d(4, 15): ('五模 第一天', 'mock', '社會、數學、國文'),     # 沒有六模
    d(4, 16): ('五模 第二天', 'mock', '自然、英文'),
    d(5, 15): ('國中教育會考 第一天', 'cap', '社會、數學、國文、寫作'),
    d(5, 16): ('國中教育會考 第二天', 'cap', '自然、英文'),
}
DAY_NOTES = {
    d(11, 6): '39 週年校慶',
    d(12, 3): '自然學科競賽 校內初選（在學校考）',
    d(1, 7): '自然學科競賽 校內複賽（有晉級才考）',
    d(1, 20): '休業式',
    d(2, 11): '下學期開學',
    # 舊記憶的段考預定日（未定案；使用者決定下學期段考不準備，只標記）
    d(3, 22): '下學期第一次段考（預定，未定案）',
    d(3, 23): '下學期第一次段考（預定，未定案）',
    d(5, 3): '下學期第二次段考（預定，未定案）',
    d(5, 7): '下學期第二次段考（預定，未定案）',
}

# ───────────────────────── 教材 ─────────────────────────
BK = {
    'chi': '橘子複習講義', 'm1': '勝經複習講義', 'm2': '雙向溝通（數學）',
    'e1': '雙向溝通（英文）', 'e2': '大滿貫主題探索', 'phy': '橘子 lite 輕複習',
    'bio': '大滿貫（生物）', 'ear': '雙向溝通（地科）', 'his': '麻辣（歷史）',
    'geo': '麻辣（地理）', 'civ': '大滿貫（公民）', 'mock': '模考練習卷', 'past': '歷屆會考',
    'A': '考古題 A 本', 'B': '考古題 B 本',
}
MATH_CH = {
    1: ['整數的運算', '分數的運算', '一元一次方程式'],
    2: ['二元一次聯立方程式', '直角坐標與二元一次方程式的圖形', '比與比例式', '一元一次不等式'],
    3: ['乘法公式與多項式', '平方根與畢氏定理', '因式分解', '一元二次方程式'],
    4: ['數列與級數', '線型函數及其圖形', '三角形的基本性質', '平行與四邊形'],
    5: ['相似形', '圓形', '幾何與證明（外心、內心、重心）'],
    6: ['二次函數', '統計與機率', '立體圖形'],
}
DOUBLE_CH = {(4, 3), (4, 4), (5, 1), (5, 2), (5, 3)}       # 幾何章節排兩段
BIO_CH = {1: ['第 1–3 章（生命世界、生物體的組成、營養）', '第 4–6 章（運輸、協調、恆定）'],
          2: ['第 1–3 章（生殖、遺傳、演化）', '第 4–6 章（生物分類、生物與環境、人類與環境）']}
PASS_HOW = '先蓋住重點整理自己默寫一次 → 寫練習題 → 對答案，錯的登記錯題本'


def pg(data, lo, hi):
    """單元 lo–hi 的頁碼範圍，例如 'p.4–156'。"""
    us = [u for u in data if lo <= u[1] <= hi]
    return 'p.%d–%d' % (us[0][3], us[-1][4])


def un(data, lo, hi):
    """'單元 lo–hi p.a–b'（只有一個單元時寫『單元 n』）。"""
    return ('單元 %d' % lo if lo == hi else '單元 %d–%d' % (lo, hi)) + ' ' + pg(data, lo, hi)


def vol_units(data, v, label='單元'):
    us = [u for u in data if u[0] == v]
    if not us:
        return ''
    a, b = us[0][1], us[-1][1]
    return ('%s %d' % (label, a) if a == b else '%s %d–%d' % (label, a, b)) + ' p.%d–%d' % (us[0][3], us[-1][4])


def T(cat, title, how='', **kw):
    t = {'cat': cat, 'n': title, 'd': how}
    t.update(kw)
    return t


# 國文（橘子）依主題編，不分冊：記憶型的先做（三模前），閱讀素養區留到三月後接近會考再做
CHI_EARLY = [10, 11, 12, 13, 9, 6]
CHI_LATE = [8, 7, 1, (2, 3), 4, 5, 14, 15, 16, 17, 18, 19, 20]


def unit_task(cat, sub, book, u, how=PASS_HOW, extra=''):
    vol, no, name, a, b = u
    rng = (' p.%d–%d' % (a, b)) if a and b else ''
    return T(cat, '%s｜%s 單元 %d %s%s%s' % (sub, book, no, name, rng, extra), how, vol=vol)


def chi_tasks(units):
    by = {u[1]: u for u in TOC.CHI}
    out = []
    for key in units:
        if isinstance(key, tuple):
            us = [by[k] for k in key]
            out.append(T('chi', '國文｜%s 單元 %d–%d %s／%s p.%d–%d' % (
                BK['chi'], us[0][1], us[-1][1], us[0][2], us[-1][2], us[0][3], us[-1][4]), PASS_HOW))
            continue
        u = by[key]
        pages = u[4] - u[3] + 1
        if pages > 20:                         # 太長的單元切兩段
            mid = u[3] + pages // 2 - 1
            out.append(T('chi', '國文｜%s 單元 %d %s（上）p.%d–%d' % (BK['chi'], u[1], u[2], u[3], mid), PASS_HOW))
            out.append(T('chi', '國文｜%s 單元 %d %s（下）p.%d–%d' % (BK['chi'], u[1], u[2], mid + 1, u[4]), PASS_HOW))
        else:
            out.append(unit_task('chi', '國文', BK['chi'], u))
    if units is CHI_LATE:
        x = TOC.CHI_EXTRA[0]
        out.append(T('chi', '國文｜%s %s p.%d–%d（限時 70 分）' % (BK['chi'], x[0], x[1], x[2]), '照會考時間計時，寫完立刻對答案'))
    return out


def blocks_of(units, cat, sub, book, split_at=None, pair_upto=None, extras=(), how=PASS_HOW):
    """把單元變成讀書段：超過 split_at 頁切成上下兩段；相鄰兩單元合計不超過 pair_upto 頁就併成一段。"""
    out, i = [], 0
    units = list(units)
    while i < len(units):
        u = units[i]
        pages = u[4] - u[3] + 1
        last_of_vol = (i == len(units) - 1) or units[i + 1][0] != u[0]
        if pair_upto and not last_of_vol and (units[i + 1][4] - u[3] + 1) <= pair_upto:
            v = units[i + 1]
            last2 = (i + 1 == len(units) - 1) or units[i + 2][0] != v[0]
            ex = extra_note(extras, v[0]) if last2 else ''
            out.append(T(cat, '%s｜%s 單元 %d–%d %s／%s p.%d–%d%s' % (sub, book, u[1], v[1], u[2], v[2], u[3], v[4], ex), how, vol=u[0]))
            i += 2
            continue
        ex = extra_note(extras, u[0]) if last_of_vol else ''
        if split_at and pages >= split_at:
            mid = u[3] + pages // 2 - 1
            out.append(T(cat, '%s｜%s 單元 %d %s（上）p.%d–%d' % (sub, book, u[1], u[2], u[3], mid), how, vol=u[0]))
            out.append(T(cat, '%s｜%s 單元 %d %s（下）p.%d–%d%s' % (sub, book, u[1], u[2], mid + 1, u[4], ex), how, vol=u[0]))
        else:
            out.append(unit_task(cat, sub, book, u, how=how, extra=ex))
        i += 1
    return out


def extra_note(extras, vol):
    for e in extras:
        if e[0] == vol:
            return '＋%s p.%d–%d' % (e[1], e[2], e[3])
    return ''


def pass1(vols):
    """各科第一輪講義。社會、生物、英文依講義目錄的真實單元與頁碼；數學、理化、地科暫照課綱章節。"""
    out = OrderedDict()
    for key in ['math', 'chi', 'eng', 'sci', 'soc']:
        out[key] = []
    for v in vols:
        if v <= 4:
            out['math'] += blocks_of([x for x in TOC.MATH_SJ if x[0] == v], 'math', '數學', BK['m1'],
                                     split_at=16, extras=TOC.MATH_SJ_EXTRA)
        else:
            out['math'] += blocks_of([x for x in TOC.MATH_SX if x[0] == v], 'math', '數學', BK['m2'],
                                     split_at=16, extras=TOC.MATH_SX_EXTRA)
        for u in [x for x in TOC.ENG_SX if x[0] == v]:
            out['eng'].append(unit_task('eng', '英文', BK['e1'], u))
        for e in TOC.ENG_SX_EXTRA:
            if e[0] == v:
                out['eng'].append(T('eng', '英文｜%s %s p.%d–%d' % (BK['e1'], e[1], e[2], e[3]), '閱讀測驗限時寫，對完答案再看文法整理'))
        bio = [x for x in TOC.BIO if x[0] == v]
        for i, u in enumerate(bio):
            out['sci'].append(unit_task('sci', '生物', BK['bio'], u,
                                        extra=extra_note(TOC.BIO_EXTRA, v) if i == len(bio) - 1 else ''))
        out['sci'] += blocks_of([x for x in TOC.PHY if x[0] == v], 'sci', '理化', BK['phy'],
                                pair_upto=28, extras=TOC.PHY_EXTRA)
        out['sci'] += blocks_of([x for x in TOC.EAR if x[0] == v], 'sci', '地科', BK['ear'],
                                extras=TOC.EAR_EXTRA, how='重點整理先看一遍 → 只寫精選題；科班讀過的地科這裡會快很多')
        # 社會：同一冊內歷史、地理、公民輪流，任何時候三科都差不多走到同一冊
        lists = []
        for data, extras, sub, key in ((TOC.HIS, TOC.HIS_EXTRA, '歷史', 'his'), (TOC.GEO, TOC.GEO_EXTRA, '地理', 'geo'),
                                       (TOC.CIV, TOC.CIV_EXTRA, '公民', 'civ')):
            us = [x for x in data if x[0] == v]
            lists.append([unit_task('soc', sub, BK[key], u, extra=extra_note(extras, v) if i == len(us) - 1 else '')
                          for i, u in enumerate(us)])
        while any(lists):
            for l in lists:
                if l:
                    out['soc'].append(l.pop(0))
    out['chi'] = chi_tasks(CHI_EARLY if 1 in vols else CHI_LATE)
    return out


def interleave(groups):
    """依「剩餘比例最高者先上、同科不連續」交錯排序，讓各科差不多同時走完。"""
    groups = OrderedDict((k, list(v)) for k, v in groups.items() if v)
    total = {k: len(v) for k, v in groups.items()}
    out, last = [], None
    while any(groups.values()):
        cands = [k for k, v in groups.items() if v]
        cands.sort(key=lambda k: (-(len(groups[k]) / total[k]), k == last))
        pick = cands[0]
        if pick == last and len(cands) > 1:
            pick = cands[1]
        out.append(groups[pick].pop(0))
        last = pick
    return out


MOCK_MIN = {'國文': 70, '數學': 80, '英文': 60, '社會': 70, '自然': 70}
MOCK_CAT = {'國文': 'chi', '數學': 'math', '英文': 'eng', '社會': 'soc', '自然': 'sci'}
MOCK_RANGE = {1: '1–2 冊', 2: '1–3 冊', 3: '1–4 冊', 4: '1–5 冊', 5: '全範圍'}


def mock_paper(r, sub):
    return T(MOCK_CAT[sub], '%s 第 %d 回 %s（%s）限時 %d 分' % (BK['mock'], r, sub, MOCK_RANGE[r], MOCK_MIN[sub]),
             '照會考時間計時、手機放別的房間；寫完立刻對答案，錯的只標記，訂正留到下一段', mock=1)


def mock_fix(r, subs):
    return T('mock', '%s 第 %d 回 訂正：%s' % (BK['mock'], r, '＋'.join(subs)),
             '每題寫一行「我當時為什麼錯」，訂正後還會錯的才收進錯題本')


def mock_round(r, order=('數學', '社會', '國文', '自然', '英文')):
    a, b, c, dd, e = [mock_paper(r, s) for s in order]
    return [a, b, mock_fix(r, list(order[:2])), c, dd, e, mock_fix(r, list(order[2:]))]


def past_round(year, order=('數學', '社會', '國文', '自然', '英文')):
    tasks = []
    for i, s in enumerate(order):
        tasks.append(T(MOCK_CAT[s], '%s %d 年 %s 限時 %d 分（心測中心官網下載）' % (BK['past'], year, s, MOCK_MIN[s]),
                       '完全照正式考試計時；英文只寫閱讀；對完答案把錯題登記錯題本', mock=1))
        if i % 2 == 1:
            tasks.append(T('mock', '%s %d 年 訂正：%s＋%s' % (BK['past'], year, order[i - 1], s), '看詳解，訂正到能自己重算'))
    tasks.append(T('mock', '%s %d 年 訂正：%s' % (BK['past'], year, order[-1]), '看詳解，訂正到能自己重算'))
    return tasks


# ─── 科班考古題（兩本目錄的頁碼）───
PAPERS_A = [
    ('台南一中', '物理', 114, 1, 5), ('台南一中', '物理', 113, 6, 12), ('台南一中', '物理', 112, 13, 19),
    ('台南一中', '化學', 114, 20, 25), ('台南一中', '化學', 113, 26, 32), ('台南一中', '化學', 112, 33, 41),
    ('台南一中', '生物', 114, 42, 45), ('台南一中', '生物', 113, 46, 52),
    ('台南一中', '數學', 114, 53, 56), ('台南一中', '數學', 113, 57, 60), ('台南一中', '數學', 112, 61, 64),
    ('嘉中', '物理', 114, 65, 73), ('嘉中', '物理', 113, 74, 82), ('嘉中', '物理', 112, 83, 91),
    ('嘉中', '化學', 114, 92, 96), ('嘉中', '化學', 113, 97, 106), ('嘉中', '化學', 112, 107, 111),
    ('嘉中', '生物', 114, 112, 127), ('嘉中', '生物', 113, 128, 141), ('嘉中', '生物', 112, 142, 157),
    ('嘉中', '數學', 114, 158, 160), ('嘉中', '數學', 113, 161, 164), ('嘉中', '數學', 112, 165, 167),
    ('彰中', '物理', 114, 168, 176), ('彰中', '物理', 113, 177, 184), ('彰中', '物理', 112, 185, 193),
    ('彰中', '化學', 114, 194, 199), ('彰中', '化學', 113, 200, 206), ('彰中', '化學', 112, 207, 216),
    ('彰中', '生物', 114, 217, 231), ('彰中', '生物', 113, 232, 243), ('彰中', '生物', 112, 244, 254),
    ('彰中', '數學', 114, 255, 256), ('彰中', '數學', 113, 257, 258), ('彰中', '數學', 112, 259, 261),
]
PAPERS_B = [
    ('台中一中', '物理', 114, 1, 4), ('台中一中', '物理', 113, 5, 10), ('台中一中', '物理', 112, 11, 14),
    ('台中一中', '化學', 114, 15, 20), ('台中一中', '化學', 113, 21, 28), ('台中一中', '化學', 112, 29, 32),
    ('台中一中', '生物', 114, 33, 46), ('台中一中', '生物', 113, 47, 56), ('台中一中', '生物', 112, 57, 65),
    ('台中一中', '數學', 114, 66, 68), ('台中一中', '數學', 113, 69, 71), ('台中一中', '數學', 112, 72, 74),
    ('武陵', '物理', 114, 75, 85), ('武陵', '物理', 113, 86, 98),
    ('武陵', '化學', 114, 99, 106), ('武陵', '化學', 113, 107, 115),
    ('武陵', '生物', 114, 116, 121),
    ('武陵', '數學', 114, 122, 124), ('武陵', '數學', 113, 125, 127), ('武陵', '數學', 112, 128, 130),
    ('建中', '自然綜合', 114, 131, 147), ('建中', '自然綜合', 113, 148, 161), ('建中', '自然綜合', 112, 162, 180),
    ('建中', '數學', 114, 181, 183), ('建中', '數學', 113, 184, 186), ('建中', '數學', 112, 187, 189),
    ('北一女', '物理', 113, 190, 193), ('北一女', '物理', 112, 194, 198),
    ('北一女', '地科', 113, 199, 203), ('北一女', '地科', 112, 204, 209),
    ('北一女', '化學', 113, 210, 214), ('北一女', '化學', 112, 215, 218),
    ('北一女', '生物', 113, 219, 223), ('北一女', '生物', 112, 224, 227),
    ('北一女', '數學', 113, 228, 230), ('北一女', '數學', 112, 231, 233),
]
SUBJ_ORDER = ['數學', '物理', '化學', '生物', '自然綜合', '地科']


def kb_queue():
    """考古題：112 → 113 → 114（最新的留到最後當模擬），同年內各科交錯；作答隔一段再訂正。"""
    papers = [('A',) + p for p in PAPERS_A] + [('B',) + p for p in PAPERS_B]
    out, pending = [], []
    for year in (112, 113, 114):
        groups = OrderedDict()
        for s in SUBJ_ORDER:
            groups[s] = [p for p in papers if p[3] == year and p[2] == s]
        seq = interleave(groups)
        for bk, school, subj, yr, a, b in seq:
            pages = b - a + 1
            label = '%s %d %s' % (school, yr, subj)
            where = '%s p.%d–%d' % (BK[bk], a, b)
            how = '計時、不查資料；卡住先跳，最後回頭；寫完先對答案再休息'
            if subj != '數學' and pages >= 11:
                mid = a + pages // 2 - 1
                out.append(T('kb', '科班考古｜%s 限時作答（前半 p.%d–%d）' % (label, a, mid), how, kb=label))
                out.append(T('kb', '科班考古｜%s 限時作答（後半 p.%d–%d）' % (label, mid + 1, b), how, kb=label))
            else:
                out.append(T('kb', '科班考古｜%s 限時作答（%s）' % (label, where), how, kb=label))
            fix_how = '錯的題目不看解答先重算一次，再看詳解；還不懂的記到「要問老師」'
            if subj == '數學' or pages >= 7:
                out.append(T('kbfix', '科班考古｜%s 訂正（%s）' % (label, where), fix_how))
            else:
                pending.append('%s（%s）' % (label, where))
                if len(pending) == 2:
                    out.append(T('kbfix', '科班考古｜訂正：%s＋%s' % tuple(pending), fix_how))
                    pending = []
    if pending:
        out.append(T('kbfix', '科班考古｜訂正：%s' % pending[0], '錯的題目不看解答先重算一次，再看詳解'))
    return out


def kb_where(school, subjects, years=(112, 113, 114)):
    """某校某幾科考古題在書上的頁碼，例如 'B 本 p.66–74' 或 'A 本 物理 p.65–91、化學 p.92–111'。"""
    papers = [('A',) + p for p in PAPERS_A] + [('B',) + p for p in PAPERS_B]
    parts, book = [], ''
    for sb in subjects:
        ps = [p for p in papers if p[1] == school and p[2] == sb and p[3] in years]
        if not ps:
            continue
        book = ps[0][0]
        parts.append((sb, min(p[4] for p in ps), max(p[5] for p in ps)))
    if not parts:
        return ''
    if len(parts) == 1:
        return '%s p.%d–%d' % (BK[book], parts[0][1], parts[0][2])
    return BK[book] + ' ' + '、'.join('%s p.%d–%d' % x for x in parts)


def kb_round2():
    """2/15 起：第二輪（錯題重做、限時模擬、觀念總整理）。"""
    tasks = []
    schools = ['台中一中', '台南一中', '嘉中', '武陵', '彰中', '建中', '北一女']
    for s in schools:
        tasks.append(T('kb', '第二輪｜%s 數學 112–114 錯題重做（%s，不看解答）' % (s, kb_where(s, ['數學'])), '這次要全對；又錯的題目收進科班錯題本'))
    for s in ['台中一中', '台南一中', '嘉中', '武陵', '彰中', '北一女']:
        tasks.append(T('kb', '第二輪｜%s 物理＋化學 錯題重做（%s）' % (s, kb_where(s, ['物理', '化學'])), '先重算再看自己上次的訂正，比較哪裡想錯'))
    tasks.append(T('kb', '第二輪｜建中 自然綜合 112–114 錯題重做（%s）' % kb_where('建中', ['自然綜合']), '物地化生混在一起，正好練切換'))
    tasks.append(T('kb', '第二輪｜生物 錯題重做：台中一中（%s）＋台南一中（%s）' % (kb_where('台中一中', ['生物']), kb_where('台南一中', ['生物'])),
                   '生物靠記憶，錯題順便整理成一頁關鍵字'))
    tasks.append(T('kb', '第二輪｜生物 錯題重做：嘉中（%s）＋彰中（%s）' % (kb_where('嘉中', ['生物']), kb_where('彰中', ['生物'])), '同上'))
    tasks.append(T('kb', '第二輪｜生物＋地科 錯題重做：武陵（%s）＋北一女（%s）' % (kb_where('武陵', ['生物']), kb_where('北一女', ['生物', '地科'])),
                   '地科重點畫成一張圖'))
    summary = [T('kbr', '觀念總整理｜%s：自己寫一頁 A4（公式、常用模型、易錯點）' % s, '寫完的那頁就是初試前一晚要看的東西')
               for s in ['數學', '物理', '化學', '生物', '地科']]
    xiong = [T('kbr', '雄中考古題 整份限時（還沒拿到 → 改做 114 年 %s 數學＋自然全真模擬：%s）' % (
        s, kb_where(s, ['數學', '物理', '化學', '生物', '自然綜合'], years=(114,))),
               '照初試時間連考，中間只休息 10 分鐘') for s in ['台中一中', '台南一中', '嘉中', '建中', '彰中', '武陵']]
    out = []
    # 交錯：錯題重做 2、模擬 1、總整理 1
    while tasks or summary or xiong:
        for _ in range(2):
            if tasks:
                out.append(tasks.pop(0))
        if xiong:
            out.append(xiong.pop(0))
        if summary:
            out.append(summary.pop(0))
    out.append(T('kbr', '自學擴充（自己決定主題：開始前在任務細節寫下要讀什麼）', '目標是補「考古題反覆出現、但補習沒教到」的東西'))
    out.append(T('kbr', '自學擴充（接上一次）', ''))
    for s, sc in [('數學', '台中一中'), ('物理', '嘉中'), ('化學', '武陵'), ('數學', '台南一中'), ('生物', '台中一中'), ('自然綜合', '建中')]:
        out.append(T('kb', '限時重做｜114 年 %s %s（%s，整份，看能不能拿到 9 成）' % (sc, s, kb_where(sc, [s], years=(114,))),
                     '這份第一次寫錯的題目這次一定要對'))
    for s in ['數學', '物理', '化學', '生物', '地科']:
        out.append(T('kbr', '初試前總複習｜%s：觀念總整理那頁＋錯題紙' % s, '只看自己整理的東西，不再開新書'))
    out.append(T('kb', '科班錯題本：最常錯的 10 題重做', '還會錯的題目寫在一張紙上，初試早上看'))
    return out


def term_queue():
    """二段（11/23–24）兩週準備。範圍是推估（依第 5 冊自修／段考王／文法即時通的段考分界，以及使用者說的
    「數學考到 2-2、理化從 2-2 再考」），頁碼取自 claude課業 資料夾裡的課本、自修、講義。"""
    R = '（範圍推估，老師公布後以公布為準）'
    g = OrderedDict()
    g['國文'] = [
        T('term', '二段｜國文：L4〈生於憂患死於安樂〉課本 p.46–57＋自修 p.77–96', '先做自修的形音義、注釋、國學常識（你錯最多的題型）；反向題圈出「錯誤／不恰當」' + R),
        T('term', '二段｜國文：L5〈以粥養生〉課本 p.58–71＋自修 p.97–120', '注釋蓋住自己講一次；同音、形近字寫三遍'),
        T('term', '二段｜國文：L6〈獵人〉課本 p.72–89＋自修 p.121–143', '注釋蓋住自己講一次；同音、形近字寫三遍'),
        T('term', '二段｜國文：語文天地〈對聯〉課本 p.90–99＋自修 p.144–150；國文講義 L4–L6 p.32–61 限時＋自修第二次學習成果評量 p.151–157',
          '時間不夠先跳講義；自學二〈大明湖〉（講義 p.102–109、自修 p.257–274）可能出閱讀，有空再看'),
    ]
    g['數學'] = [
        T('term', '二段｜數學：1-4 相似三角形的應用 課本 p.60–81（含章末）', '例題蓋住解答重做' + R),
        T('term', '二段｜數學：2-1 圓形及點、直線與圓之間的關係 課本 p.84–108', '例題蓋住解答重做'),
        T('term', '二段｜數學：2-2 弧與圓周角 課本 p.109–133（含章末）', '例題蓋住解答重做'),
        T('term', '二段｜數學：南一段考王 第 5–7 回（1-4、2-1、2-2）p.34–67', '錯的題目當天訂正'),
        T('term', '二段｜數學：段考王 第 8 回 第二次段考模擬試題 p.68–72 限時＋錯題重做', '照段考時間計時'),
    ]
    g['自然'] = [
        T('term', '二段｜自然：2-2～2-4 牛頓第二、第三運動定律、圓周運動 課本 p.38–59＋良師講義 p.34–49', '公式自己推一次再寫題' + R),
        T('term', '二段｜自然：3-1～3-2 功與功率、動能位能與能量守恆 課本 p.62–72＋良師講義 p.50–63', ''),
        T('term', '二段｜自然：3-3～3-4 槓桿原理與靜力平衡、簡單機械 課本 p.73–89＋良師講義 p.64–81', ''),
        T('term', '二段｜自然：自修 2-2～3-4 精選題 p.43–68、p.74–118', '只寫中等以上的題目'),
        T('term', '二段｜自然：南一點線面 2-2～3-4 p.36–58、p.63–93 限時＋錯題', '老師若已上到第 4 章，這段改看自修 4-1 起 p.120'),
    ]
    g['英文'] = [
        T('term', '二段｜英文：L3 課本 p.45–62 單字片語默寫＋文法即時通 p.37–53', '只看中文默寫英文' + R),
        T('term', '二段｜英文：L4 課本 p.63–80 單字片語默寫＋文法即時通 p.54–70', '只看中文默寫英文'),
        T('term', '二段｜英文：麻辣講義 L3 p.81–114', ''),
        T('term', '二段｜英文：麻辣講義 L4 p.115–150＋Review 2 p.151–156＋課本 Review 2 p.81–88', ''),
    ]
    g['社會'] = [
        T('term', '二段｜社會：歷史 第 3–4 課（課本＋習作；可對照 %s 單元 12 p.196–211）' % BK['his'], '資料夾裡沒有社會課本，範圍與頁碼都是推估' + R),
        T('term', '二段｜社會：地理 第 3–4 課 北美洲、中南美洲（課本＋習作；可對照 %s 單元 14 美洲 p.208–221）' % BK['geo'], R),
        T('term', '二段｜社會：公民 第 3–4 課 市場與競爭、分工與貿易（課本＋習作；可對照 %s 單元 12–13 p.221–253）' % BK['civ'], R),
        T('term', '二段｜社會：三科總複習（名詞＋習作錯題）', ''),
    ]
    return interleave(g)


def fu_queue():
    return [T('fu', '複試準備｜面談：寫自我介紹（1 分鐘版＋3 分鐘版）', '寫完唸出聲，錄音聽一次'),
            T('fu', '複試準備｜實作：國中理化課本實驗總整理（器材、步驟、變因）', ''),
            T('fu', '複試準備｜面談：為什麼想讀科學班、未來想研究什麼', '寫下來再講，不要背稿'),
            T('fu', '複試準備｜實作：數據處理練習（作圖、斜率、誤差來源）', ''),
            T('fu', '複試準備｜面談：把科展／自主學習經驗整理成 5 分鐘能講完的版本', ''),
            T('fu', '複試準備｜實作：用補習班實作講義模擬一次（計時）', ''),
            T('fu', '複試準備｜總演練：自我介紹＋經驗說明＋請家人模擬提問 10 題', '')]


def cap_round2():
    """四月起：單本科目第二輪（只看重點整理＋自己的錯題）。"""
    g = OrderedDict()
    g['chi'] = [T('chi', '國文第二輪｜%s %s：只看重點整理＋自己標記的錯題' % (BK['chi'], un(TOC.CHI, a, b)), '') for a, b in ((6, 9), (10, 13))]
    g['sci'] = [T('sci', '理化第二輪｜%s %s：重點＋錯題' % (BK['phy'], un(TOC.PHY, 1, 11)), ''),
                T('sci', '理化第二輪｜%s %s：重點＋錯題' % (BK['phy'], un(TOC.PHY, 12, 17)), ''),
                T('sci', '生物第二輪｜%s %s：重點＋錯題' % (BK['bio'], un(TOC.BIO, 1, 9)), ''),
                T('sci', '地科第二輪｜%s %s：重點＋錯題' % (BK['ear'], un(TOC.EAR, 1, 5)), '')]
    D = {'his': TOC.HIS, 'geo': TOC.GEO, 'civ': TOC.CIV}
    g['soc'] = [T('soc', '%s第二輪｜%s %s：重點＋錯題' % (n, BK[k], un(D[k], a, b)), '')
                for k, n, a, b in (('his', '歷史', 1, 8), ('geo', '地理', 1, 9), ('civ', '公民', 1, 7),
                                   ('his', '歷史', 9, 15), ('geo', '地理', 10, 16), ('civ', '公民', 8, 14))]
    return interleave(g)


def math2_queue():
    us = [x for x in TOC.MATH_SX if x[0] <= 4]
    return blocks_of(us, 'math', '數學第二本', BK['m2'], pair_upto=40, extras=TOC.MATH_SX_EXTRA,
                     how='只寫中等以上的題目，簡單題跳過；錯的登記錯題本')


def eng2_queue():
    out = [unit_task('eng', '英文第二本', BK['e2'], u, how='主題單字先默寫，再寫文法與閱讀題；聽力部分跳過') for u in TOC.ENG_DMG]
    x = TOC.ENG_DMG_EXTRA[0]
    out.append(T('eng', '英文第二本｜%s %s p.%d–%d' % (BK['e2'], x[0], x[1], x[2]), '限時 60 分'))
    return out


def _light_soc(n):
    return '社會｜第 %d 冊名詞、年代、地圖快速卡：歷史 %s、地理 %s、公民 %s' % (
        n, vol_units(TOC.HIS, n), vol_units(TOC.GEO, n), vol_units(TOC.CIV, n))


def _light_sci(n):
    if n <= 2:
        return '自然｜生物第 %d 冊重點與實驗結論默寫：%s %s' % (n, BK['bio'], vol_units(TOC.BIO, n))
    t = '自然｜理化第 %d 冊公式與實驗結論默寫：%s %s' % (n, BK['phy'], vol_units(TOC.PHY, n))
    if n >= 5:
        t += '＋地科 %s' % vol_units(TOC.EAR, n)
    return t


LIGHT_CYCLE = [
    lambda n: T('chi', '國文｜%s %s 快速複習（只看重點與錯題）' % (BK['chi'], un(TOC.CHI, *([[10, 10], [11, 11], [12, 12], [13, 13], [9, 9], [6, 6]][(n - 1) % 6]))),
                '同音、形近字寫三遍'),
    lambda n: T('eng', '英文｜單字片語默寫：%s 第 %d 冊 %s 的單字表' % (BK['e1'], n, vol_units(TOC.ENG_SX, n, 'Unit')), '只看中文默寫英文'),
    lambda n: T('mock', '錯題本：今天到期的題目（闔上答案重做）', ''),
    lambda n: T('soc', _light_soc(n), ''),
    lambda n: T('sci', _light_sci(n), ''),
]

# ───────────────────────── 時段模板 ─────────────────────────
# 每個元素：(開始, 結束, 種類, 槽位名或名稱)
# 種類：S=讀書槽  F=固定行程  L=生活  R=娛樂  X=空檔


def tpl_school(day, gifted):
    if gifted:
        return [('06:30', '07:20', 'L', '起床、早餐、出門'), ('07:30', '17:00', 'F', '學校（含第八節）'),
                ('17:30', '18:00', 'L', '回家、吃晚餐、出門'), ('18:00', '21:30', 'F', '資優數學'),
                ('21:40', '22:20', 'S', 'S3w'), ('22:20', '22:50', 'R', '娛樂'),
                ('22:50', '23:00', 'L', '洗漱、整理書包，23:00 就寢')]
    return [('06:30', '07:20', 'L', '起床、早餐、出門'), ('07:30', '17:00', 'F', '學校（含第八節）'),
            ('17:30', '18:15', 'L', '回家、晚餐、休息'),
            ('18:15', '19:45', 'S', 'S1'), ('19:55', '21:15', 'S', 'S2'), ('21:25', '22:15', 'S', 'S3'),
            ('22:15', '22:45', 'R', '娛樂'), ('22:45', '23:00', 'L', '洗漱、整理書包，23:00 就寢')]


def tpl_weekend(day):
    sat = day.weekday() == 5
    return [('07:30', '08:30', 'L', '起床、早餐'),
            ('08:30', '10:00', 'S', 'W1'), ('10:10', '11:40', 'S', 'W2'),
            ('11:40', '13:00', 'L', '午餐＋午睡 20 分'),
            ('13:00', '14:30', 'S', 'W3'), ('14:40', '16:00', 'S', 'W4'),
            ('16:00', '16:30', 'R', '娛樂'), ('16:30', '17:00', 'L', '吃點東西、出門'),
            ('17:00', '22:00', 'F', '雄科班補習（%s）' % ('資優數學' if sat else '自然學科')),
            ('22:15', '22:35', 'S', 'W5'), ('22:35', '23:00', 'L', '洗澡，23:00 就寢')]


def tpl_full(day, gifted=False):
    t = [('07:30', '08:30', 'L', '起床、早餐'),
         ('08:30', '10:00', 'S', 'H1'), ('10:15', '11:45', 'S', 'H2'),
         ('11:45', '13:00', 'L', '午餐＋午睡 20 分'),
         ('13:00', '14:30', 'S', 'H3'), ('14:45', '16:15', 'S', 'H4'),
         ('16:15', '16:45', 'R', '娛樂')]
    if gifted:
        t += [('16:45', '17:30', 'S', 'H5'), ('17:30', '18:00', 'L', '晚餐、出門'),
              ('18:00', '21:30', 'F', '資優數學'), ('21:40', '22:20', 'S', 'H8'),
              ('22:20', '23:00', 'L', '洗澡、放鬆，23:00 就寢')]
    else:
        t += [('16:45', '17:45', 'S', 'H5'), ('17:45', '18:45', 'L', '晚餐＋散步'),
              ('18:45', '20:15', 'S', 'H6'), ('20:30', '21:50', 'S', 'H7'),
              ('21:50', '23:00', 'L', '洗澡、放鬆、整理明天，23:00 就寢')]
    return t


def tpl_hanfu(day, gifted):
    t = [('06:40', '07:30', 'L', '起床、早餐、出門'), ('07:45', '12:00', 'F', '寒輔（暫定，學校公布後改）'),
         ('12:00', '13:15', 'L', '午餐＋午睡 20 分'),
         ('13:15', '14:45', 'S', 'K1'), ('15:00', '16:30', 'S', 'K2'), ('16:30', '17:00', 'R', '娛樂')]
    if gifted:
        t += [('17:00', '17:40', 'S', 'K3'), ('17:40', '18:00', 'L', '晚餐、出門'), ('18:00', '21:30', 'F', '資優數學'),
              ('21:40', '22:20', 'S', 'H8'), ('22:20', '23:00', 'L', '洗澡，23:00 就寢')]
    else:
        t += [('17:00', '18:00', 'S', 'K3'), ('18:00', '19:00', 'L', '晚餐'),
              ('19:00', '20:30', 'S', 'K4'), ('20:45', '22:00', 'S', 'K5'),
              ('22:00', '23:00', 'L', '洗澡、放鬆，23:00 就寢')]
    return t


def mins(a, b):
    h1, m1 = map(int, a.split(':'))
    h2, m2 = map(int, b.split(':'))
    return (h2 * 60 + m2) - (h1 * 60 + m1)


SHORT = {'S3', 'S3w', 'W5', 'H5', 'H8', 'K3'}    # 短槽：放作業或輕量任務

# ───────────────────────── 階段 ─────────────────────────


def phase(day):
    if day <= d(10, 29): return 'P0'
    if day <= d(11, 8): return 'P1'
    if day <= d(11, 24): return 'P2'
    if day <= d(12, 15): return 'P3'
    if day <= d(12, 24): return 'P3b'
    if day <= d(2, 14): return 'P4'
    if day <= d(3, 6): return 'P5'
    if day <= d(3, 13): return 'P6'
    if day <= d(4, 14): return 'P7a'          # 五模 4/15–16 前
    if day <= d(4, 30): return 'P7c'
    return 'P7d'


PH_NAME = {
    'P0': '二模衝刺', 'P1': '雙軌（會考 4：科班 6）', 'P2': '二段準備', 'P3': '雙軌（會考 4：科班 6）',
    'P3b': '三模週', 'P4': '科班全衝', 'P5': '科班最後衝刺：訂正＋限時模擬', 'P6': '複試準備＋會考',
    'P7a': '會考衝刺：4–6 冊＋模考卷', 'P7c': '會考衝刺：第二本講義＋歷屆', 'P7d': '會考最後衝刺：歷屆＋錯題本',
}
PH_NOTE = {
    'P0': '先讀第一天考科（社會、數學、國文），晚上自然、英文；只求翻過一遍。週四考完當晚把五科錯題登記進錯題本。',
    'P1': '科班優先（會考 4：科班 6）。考古題從 112 年開始寫，作答隔一段再訂正；會考講義各科交錯推進。',
    'P2': '二段（11/23–24）倒數兩週：會考講義暫停，考古題減半，補習作業照寫。範圍是推估：國文 L4–L6＋對聯、英文 L3–L4、數學 1-4～2-2、自然 2-2～3-4、社會各科第 3–4 課。',
    'P3': '科班優先：三模前會考大約走到第 2 冊＋第 3 冊開頭，剩下的三月接著做。每週日下午的「空檔」先補欠帳。',
    'P3b': '三模（12/23–24）週：模考卷第 2 回限時＋訂正，其餘時間繼續推 1–3 冊。',
    'P4': '二月中前寫完兩本考古題＋訂正、補習講義複習一輪；會考暫停，三段不準備。',
    'P5': '最後兩週半：第二輪錯題重做、限時模擬、觀念總整理。四模不另外準備。',
    'P6': '一半時間準備複試、一半回會考；沒進複試就把複試格子全部改成會考。',
    'P7a': '先補完 1–3 冊，再走 4–6 冊第一輪；4 冊走完寫模考卷第 3 回，4/3–4/4 連假寫第 4 回；五模 4/15–16。',
    'P7c': '4–6 冊第一輪走完後寫模考卷第 5 回（全範圍），接著數學、英文第二本講義＋歷屆會考 112 年；平日 50 分鐘那段做第二輪（只看重點＋錯題）。',
    'P7d': '歷屆會考 113–115 年＋錯題本總複習；考前一週只看錯題紙。',
}


def kind_of(day):
    if day in REST_DAYS: return 'rest'
    if day in EXAM: return 'exam'
    wk = day.weekday()
    hol = day in HOLIDAY or day in SPRING
    winter = WINTER[0] <= day <= WINTER[1]
    if day in HANFU: return 'hanfu'
    if wk >= 5:
        return 'weekend' if (not hol and day <= CRAM_LAST) else 'full'
    if hol or winter: return 'full'
    return 'school'


def is_gifted(day):
    return day.weekday() == 2 and day <= GIFTED_LAST and day not in HOLIDAY and day not in SPRING


# ───────────────────────── 槽位 → 軌道 ─────────────────────────
P13 = {   # 雙軌 會考 4：科班 6
    0: {'S1': 'cap', 'S2': 'kb', 'S3': 'hw'}, 1: {'S1': 'kb', 'S2': 'cap', 'S3': 'hw'},
    2: {'S1': 'cap', 'S2': 'kb', 'S3': 'hw', 'S3w': 'hw'}, 3: {'S1': 'cap', 'S2': 'kb', 'S3': 'hw'},
    4: {'S1': 'kb', 'S2': 'cap', 'S3': 'hw'},
    5: {'W1': 'kb', 'W2': 'kb', 'W3': 'cap', 'W4': 'cap', 'W5': 'recall'},
    6: {'W1': 'hw', 'W2': 'cap', 'W3': 'kb', 'W4': 'free', 'W5': 'recall'},
}
P2M = {
    0: {'S1': 'term', 'S2': 'term', 'S3': 'hw'}, 1: {'S1': 'term', 'S2': 'term', 'S3': 'hw'},
    2: {'S1': 'term', 'S2': 'term', 'S3': 'hw', 'S3w': 'hw'}, 3: {'S1': 'term', 'S2': 'term', 'S3': 'hw'},
    4: {'S1': 'term', 'S2': 'term', 'S3': 'hw'},
    5: {'W1': 'kb', 'W2': 'kb', 'W3': 'term', 'W4': 'term', 'W5': 'recall'},
    6: {'W1': 'hw', 'W2': 'term', 'W3': 'kb', 'W4': 'free', 'W5': 'recall'},
}


def track(day, ph, slot, kind):
    wk = day.weekday()
    if kind == 'weekend' and day.weekday() == 6 and slot == 'W4':
        return 'free'
    if kind == 'full' and day.weekday() == 6 and slot == 'H4':
        return 'free'
    if ph == 'P3' and wk == 6 and slot == 'W3' and day >= d(11, 29):
        return 'cap'                                   # 三模前多給會考一格，讓 1–3 冊走得完
    if ph in ('P1', 'P3'):
        if slot.startswith('H'):                       # 假日（P1/P3 期間沒有）
            return 'cap' if slot in ('H1', 'H3', 'H6') else ('hw' if slot in SHORT else 'kb')
        return P13[wk].get(slot, 'hw')
    if ph == 'P2':
        return P2M[wk].get(slot, 'hw')
    if ph == 'P3b':
        if slot in SHORT:
            return 'recall' if slot == 'W5' else 'hw'
        if wk == 6 and slot == 'W1':
            return 'hw'
        return 'cap'
    if ph in ('P4', 'P5'):
        if slot == 'W5':
            return 'recall'
        if slot in SHORT or (wk == 6 and slot == 'W1'):
            return 'hw'
        return 'kbx' if ph == 'P4' else 'kb2'
    if ph == 'P6':
        if slot in SHORT:
            return 'recall' if slot == 'W5' else 'light'
        if slot in ('S1', 'W1', 'W3', 'H1', 'H3', 'H6'):
            return 'fu'
        return 'cap'
    # P7
    if slot in SHORT:
        return 'light'
    return 'cap'


# ───────────────────────── 主程式 ─────────────────────────


class Q(object):
    def __init__(self, items, name):
        self.items, self.name = list(items), name

    def pop(self):
        return self.items.pop(0) if self.items else None

    def __len__(self):
        return len(self.items)


def build():
    cap13 = Q(interleave(pass1([1, 2, 3])), 'cap13')
    cap46 = Q([], 'cap46')
    kb = Q(kb_queue(), 'kb')
    term = Q(term_queue(), 'term')
    fu = Q(fu_queue(), 'fu')
    kb2 = Q(kb_round2(), 'kb2')
    stats = defaultdict(lambda: defaultdict(int))
    weekly_kbx = defaultdict(int)
    light_i = [0]
    rot = {'kbr': 0, 'hw_mon': 0, 'weak': 0}
    KBR_SUBJ = ['資優數學', '物理', '化學', '生物', '地科']

    def light(day=None):
        if day is not None and day >= d(4, 9) and r2q.items and light_i[0] % 2 == 0:
            light_i[0] += 1
            return r2q.pop()
        i = light_i[0]
        light_i[0] += 1
        f = LIGHT_CYCLE[i % len(LIGHT_CYCLE)]
        return f((i // len(LIGHT_CYCLE)) % 6 + 1)

    def kbr_review():
        s = KBR_SUBJ[rot['kbr'] % len(KBR_SUBJ)]
        rot['kbr'] += 1
        return T('kbr', '補習講義複習｜%s（從最早的講義往後推，這次約一個單元）' % s,
                 '先看自己的筆記默寫重點，再挑講義例題重做')

    def hw_task(day, slot):
        wk = day.weekday()
        if wk == 0 and slot == 'S3':
            return T('hw', '雄科班補習作業（先花 15 分複習昨天的自然課）', '週末課前要交的先寫')
        if wk == 6 and slot == 'W1':
            return T('hw', '雄科班補習作業（先花 15 分複習昨天的資優數學課）', '週末課前要交的先寫')
        return T('hw', '雄科班補習作業', '最難的那份先寫；寫不出來的題目記到「要問老師」')

    # 7 月以後的會考隊列在進入 P6 時建立（要接上 P3 沒做完的 1–3 冊）
    p7_built = [False]
    q7a, q7c, q7d = Q([], 'q7a'), Q([], 'q7c'), Q([], 'q7d')
    r2q = Q([], 'r2q')

    def build_p7():
        p7_built[0] = True
        rest13 = list(cap13.items)
        cap13.items = []
        g = pass1([4, 5, 6])
        # 剩下的 1–3 冊排在最前面
        seq = [T('mock', '四模訂正：初試前沒時間訂正的五科錯題，現在補登記錯題本', '每題一行「為什麼錯」')] + rest13 + interleave(g)
        # 4 冊結束後插入模考卷第 3 回、5 冊結束後插入第 4 回
        def last_idx(vol):
            idx = -1
            for i, t in enumerate(seq):
                if t.get('vol') == vol:
                    idx = i
            return idx
        i6 = last_idx(6)
        seq = seq[:i6 + 1] + mock_round(5) + seq[i6 + 1:]
        i4 = last_idx(4)
        seq = seq[:i4 + 1] + mock_round(3) + seq[i4 + 1:]
        q7a.items = seq
        g2 = OrderedDict()
        g2['math'] = math2_queue()
        g2['eng'] = eng2_queue()
        g2['past'] = past_round(112)
        r2q.items = cap_round2()            # 第二輪改放三月後的 50 分鐘輕量時段
        q7c.items = interleave(g2)
        g3 = OrderedDict()
        g3['past'] = past_round(113) + past_round(114) + past_round(115)
        g3['wrong'] = [T('mock', '錯題本總複習｜%s：全部標★的題目重做' % s, '還錯的抄到一張紙，考前一晚只看這張')
                       for s in ['數學', '自然', '社會', '國文', '英文', '數學', '自然', '社會']]
        g3['last'] = [T(c, '最後一輪｜%s' % w, '只看自己整理過的東西') for c, w in [
            ('math', '數學：自己的公式紙＋錯題紙，不看解答重做'),
            ('chi', '國文：形音義、成語、國學常識總整理（%s %s）' % (BK['chi'], un(TOC.CHI, 9, 13))),
            ('eng', '英文：%s 1–6 冊單字表快速默寫＋跨冊文法整理 p.112–113、240–242、353–355' % BK['e1']),
            ('sci', '自然：理化公式＋生物、地科關鍵名詞，自己畫一張總圖'),
            ('soc', '社會：歷史年代表、地理圖表、公民名詞總整理')]]
        q7d.items = interleave(g3)

    def cap_pop(day, ph):
        if ph in ('P1', 'P3', 'P3b'):
            t = cap13.pop()
            return t or T('mock', '會考｜1–3 冊錯題本＋講義打★的題目重做', '')
        if not p7_built[0]:
            build_p7()
        for q in ((q7a,) if ph in ('P6', 'P7a') else (q7a, q7c) if ph == 'P7c' else (q7a, q7d, q7c)):
            t = q.pop()
            if t:
                return t
        for q in (q7a, q7c, q7d):
            t = q.pop()
            if t:
                return t
        sub = ['數學', '自然', '社會', '國文', '英文'][rot['weak'] % 5]
        rot['weak'] += 1
        return T('mock', '弱科加強｜%s（若五模有更低的科目就換那科）：回講義重做打★題' % sub, '')

    def kbx_pop(day):
        # 每週的科班混合：考古題為主，穿插補習講義複習、雄中考古、自學、錯題重做
        wkey = day - dt.timedelta(days=day.weekday())
        n = weekly_kbx[wkey]
        weekly_kbx[wkey] += 1
        if n in (2, 7, 12, 17):
            return kbr_review()
        if n in (4, 14):
            return T('kbr', '雄中考古題（還沒發 → 改做：考古題錯題重做）', '拿到雄中考古題本後，這格就照年份往下寫')
        if n == 9:
            return T('kbr', '自學擴充（自己決定主題：開始前在任務細節寫下要讀什麼）', '')
        if n == 19:
            return T('kb', '科班錯題本：本週錯題重做', '')
        t = kb.pop()
        return t or kbr_review()

    plan = OrderedDict()
    day = START
    while day <= END:
        k = '%d-%d-%d' % (day.year, day.month, day.day)
        ph = phase(day)
        kind = kind_of(day)
        gifted = is_gifted(day)
        blocks = []
        if ph == 'P0':
            blocks = manual_p0(day)
        elif kind == 'rest':
            blocks = [('—', '—', 'rest', '%s：整天休息，過年' % SPRING[day], '這是計畫的一部分；明天照表回來', 3)]
        elif kind == 'exam':
            blocks = exam_day(day, ph, cap_pop, kb, hw_task, kbx_pop, kb2, light)
        else:
            if kind == 'school':
                tpl = tpl_school(day, gifted)
            elif kind == 'weekend':
                tpl = tpl_weekend(day)
            elif kind == 'hanfu':
                tpl = tpl_hanfu(day, gifted)
            else:
                tpl = tpl_full(day, gifted)
            for s, e, ty, name in tpl:
                if ty == 'L':
                    blocks.append((s, e, 'life', name, '', 2)); continue
                if ty == 'F':
                    cat = 'fixed'
                    blocks.append((s, e, cat, name, '', 1)); continue
                if ty == 'R':
                    blocks.append((s, e, 'rest', '娛樂／自由（30 分）', '欠帳每天最多扣 60 分，娛樂不低於 30 分', 3)); continue
                tr = track(day, ph, name, kind)
                pin = pinned(day, name)
                if pin is not None:
                    if pin is False:
                        continue
                    t = pin
                elif tr == 'free':
                    blocks.append((s, e, 'free', '空檔：本週有欠帳先補，沒有就完全自由', '一週一格，不准被新進度佔用', 4)); continue
                elif tr == 'cap':
                    t = cap_pop(day, ph)
                elif tr == 'kb':
                    t = kb.pop() or kbr_review()
                elif tr == 'kbx':
                    t = kbx_pop(day)
                elif tr == 'kb2':
                    t = kb2.pop() or (kbr_review() if day < d(2, 26) else T('kb', '科班錯題本：到期題＋最常錯的題目', ''))
                elif tr == 'term':
                    t = term.pop() or T('term', '二段｜最弱的一科再做一次總複習', '')
                elif tr == 'fu':
                    t = fu.pop() or cap_pop(day, ph)
                elif tr == 'hw':
                    if day > CRAM_LAST:
                        t = light()
                    else:
                        t = hw_task(day, name)
                elif tr == 'recall':
                    t = T('hw', '今天補習重點回想：不看筆記，寫下 3 個重點', '寫不出來的就是下週要問的')
                elif tr == 'light':
                    t = light(day)
                else:
                    t = light()
                blocks.append((s, e, t['cat'], t['n'], t.get('d', ''), 0))
                stats[ph][t['cat']] += mins(s, e) if s[0].isdigit() else 0
        lab = {'school': '上學日', 'weekend': '週末（晚上補習）', 'full': '放假日', 'hanfu': '寒輔日',
               'exam': '考試日', 'rest': '休息日'}[kind]
        if kind == 'weekend' and gifted:
            lab += '＋資優數學'
        if kind == 'school' and gifted:
            lab += '（資優數學）'
        notes = []
        if day in EXAM: notes.append(EXAM[day][0] + ('：' + EXAM[day][2] if EXAM[day][2] else ''))
        if day in HOLIDAY: notes.append(HOLIDAY[day])
        if day in SPRING: notes.append(SPRING[day])
        if day in HANFU: notes.append('寒輔（暫定日期）')
        if day in DAY_NOTES: notes.append(DAY_NOTES[day])
        if day.weekday() >= 5 and day <= CRAM_LAST and (day in HOLIDAY or day in SPRING):
            notes.append('連假，補習停課')
        for bl in blocks:
            assert len(bl) == 6, (k, bl)
        plan[k] = {'k': kind, 'lab': lab, 'ph': PH_NAME[ph], 'tip': PH_NOTE.get(ph, ''),
                   'note': '・'.join(notes),
                   'b': [list(b) for b in blocks]}
        day += dt.timedelta(days=1)

    left = {'會考 1–3 冊': len(cap13), '考古題': len(kb), '段考': len(term), '第二輪': len(kb2),
            'P7a': len(q7a), 'P7c': len(q7c), 'P7d': len(q7d)}
    return plan, stats, left


# ─── 特定日期的固定安排 ───
def pinned(day, slot):
    P = {
        # 自然學科競賽初選
        (d(12, 1), 'S1'): T('kbr', '自然學科競賽暖身：理化觀念＋最近考古題的錯題', '後天校內初選'),
        (d(12, 2), 'S3w'): T('kbr', '明天自然學科競賽：只翻公式與錯題，早點睡', ''),
        (d(1, 6), 'S3w'): T('kbr', '明天自然學科競賽複賽（有晉級才需要）：公式卡', '沒晉級就寫補習作業'),
        # 三模週：模考卷第 2 回
        (d(12, 19), 'W1'): mock_paper(2, '數學'),
        (d(12, 19), 'W2'): mock_paper(2, '社會'),
        (d(12, 19), 'W3'): mock_paper(2, '國文'),
        (d(12, 19), 'W4'): mock_fix(2, ['數學', '社會', '國文']),
        (d(12, 20), 'W2'): mock_paper(2, '自然'),
        (d(12, 20), 'W3'): mock_paper(2, '英文'),
        (d(12, 21), 'S1'): mock_fix(2, ['自然', '英文']),
        (d(12, 22), 'S2'): T('mock', '三模第一天考科最後複習：社會、數學、國文', '只看重點整理和錯題，不寫新題'),
        (d(12, 22), 'S3'): T('mock', '明天三模：公式、年代、易錯字快速過一遍，早點睡', ''),
        # 初試前一天
        (d(3, 5), 'S1'): T('kbr', '初試前一天：觀念總整理那五頁＋錯題紙，不寫新題', ''),
        (d(3, 5), 'S2'): T('kbr', '準備准考證、文具、手錶；洗澡，22:00 前上床', ''),
        (d(3, 5), 'S3'): False,
        (d(3, 2), 'S3'): T('hw', '雄科班補習作業（初試週：只寫老師指定要交的）', ''),
        # 4/3–4/4 連假寫模考卷第 4 回；第 5 回等 6 冊走完再寫（五模 4/15–16，沒有六模）
        (d(4, 3), 'H1'): mock_paper(4, '數學'),
        (d(4, 3), 'H2'): mock_paper(4, '社會'),
        (d(4, 3), 'H3'): mock_paper(4, '國文'),
        (d(4, 3), 'H4'): mock_fix(4, ['數學', '社會', '國文']),
        (d(4, 4), 'H1'): mock_paper(4, '自然'),
        (d(4, 4), 'H2'): mock_paper(4, '英文'),
        (d(4, 4), 'H3'): mock_fix(4, ['自然', '英文']),
        (d(4, 14), 'S2'): T('mock', '明天五模第一天：社會、數學、國文 重點快速過', '只看重點和錯題'),
        (d(4, 14), 'S3'): False,
        # 會考前
        (d(5, 13), 'S3'): T('mock', '錯題紙（考前只看這張）整理完成', ''),
        (d(5, 14), 'S1'): T('mock', '最後一晚：錯題紙＋各科公式、年代、易錯字，只看不寫', ''),
        (d(5, 14), 'S2'): T('life', '準備准考證、2B 鉛筆、橡皮擦、尺、手錶；21:30 洗澡', ''),
        (d(5, 14), 'S3'): False,
    }
    return P.get((day, slot))


def manual_p0(day):
    """10/26–10/29 二模衝刺（10/28 第一天：社會、數學、國文；10/29 第二天：自然、英文）。"""
    how = '只看重點整理＋每章挑幾題代表題；目標是「翻過一遍」，不是讀完'
    if day == d(10, 26):
        return [
            ('13:00', '14:30', 'math', '二模｜數學 1–3 冊：%s %s 每單元重點整理＋代表題' % (BK['m1'], un(TOC.MATH_SJ, 1, 12)), how, 0),
            ('14:45', '16:15', 'soc', '二模｜社會 1–3 冊：%s %s＋%s %s 的重點整理' % (BK['geo'], un(TOC.GEO, 1, 9), BK['civ'], un(TOC.CIV, 1, 7)),
             '每單元只看開頭的重點整理；歷史留到明天', 0),
            ('16:15', '16:45', 'rest', '娛樂／自由（30 分）', '', 3),
            ('16:45', '17:45', 'chi', '二模｜國文：%s 單元 10 字形 %s＋單元 11 字音 %s' % (BK['chi'], pg(TOC.CHI, 10, 10), pg(TOC.CHI, 11, 11)),
             '形音義是你錯最多的題型，先顧這塊；易錯字寫三遍', 0),
            ('17:45', '18:45', 'life', '晚餐＋散步', '', 2),
            ('18:45', '20:15', 'sci', '二模｜自然 1–4 冊：%s %s＋%s %s 重點整理' % (BK['bio'], un(TOC.BIO, 1, 9), BK['phy'], un(TOC.PHY, 1, 11)), how, 0),
            ('20:30', '21:50', 'eng', '二模｜英文 1–3 冊：%s Unit 1–8 %s 文法重點＋1–2 冊跨冊文法整理 p.112–113' % (BK['e1'], pg(TOC.ENG_SX, 1, 8)), how, 0),
            ('21:50', '23:00', 'life', '洗澡、放鬆、整理明天書包，23:00 就寢', '', 2),
        ]
    if day == d(10, 27):
        return [
            ('06:30', '07:20', 'life', '起床、早餐、出門', '', 2), ('07:30', '17:00', 'fixed', '學校（含第八節）', '', 1),
            ('17:30', '18:15', 'life', '回家、晚餐、休息', '', 2),
            ('18:15', '19:45', 'soc', '二模｜社會：%s %s 重點整理＋模考卷第 2 回社會選擇題快速看' % (BK['his'], un(TOC.HIS, 1, 8)), '明天第一節就考社會', 0),
            ('19:55', '21:15', 'math', '二模｜數學：%s 會考模擬測驗（第 1–2 冊）p.115–119＋%s 易錯題' % (BK['m1'], un(TOC.MATH_SJ, 10, 12)),
             '模擬測驗限時寫，第 3 冊每單元挑 3 題', 0),
            ('21:25', '22:15', 'chi', '二模｜國文：%s 單元 13 成語 %s＋單元 9 國學常識 p.141–143' % (BK['chi'], pg(TOC.CHI, 13, 13)), '', 0),
            ('22:15', '22:45', 'rest', '娛樂／自由（30 分）', '', 3),
            ('22:45', '23:00', 'life', '準備明天考試用品，23:00 就寢', '', 2),
        ]
    if day == d(10, 28):
        return [
            ('06:30', '07:20', 'life', '起床、早餐（只翻公式卡，不看新東西）', '', 2),
            ('07:30', '17:00', 'fixed', '學校：二模第一天（社會、數學、國文）', '', 1),
            ('17:30', '18:00', 'life', '回家、吃晚餐、出門', '', 2), ('18:00', '21:30', 'fixed', '資優數學', '', 1),
            ('21:40', '22:20', 'sci', '明天二模：%s %s 公式＋%s 重點名詞、%s 跨冊文法整理 p.112–113' % (BK['phy'], un(TOC.PHY, 1, 11), BK['bio'], BK['e1']),
             '只看不寫，早點睡', 0),
            ('22:20', '22:50', 'rest', '娛樂／自由（30 分）', '', 3),
            ('22:50', '23:00', 'life', '準備明天考試用品，23:00 就寢', '', 2),
        ]
    if day == d(10, 29):
        return [
            ('06:30', '07:20', 'life', '起床、早餐', '', 2),
            ('07:30', '17:00', 'fixed', '學校：二模第二天（自然、英文）', '', 1),
            ('17:30', '18:15', 'life', '回家、晚餐、休息', '', 2),
            ('18:15', '19:45', 'mock', '二模訂正：五科錯題登記錯題本（每題一行「為什麼錯」）', '這份錯題就是之後的弱點清單', 0),
            ('19:55', '21:15', 'hw', '雄科班補習作業', '二模這週欠的先補', 0),
            ('21:25', '22:15', 'hw', '雄科班補習作業', '', 0),
            ('22:15', '22:45', 'rest', '娛樂／自由（30 分）', '', 3),
            ('22:45', '23:00', 'life', '洗漱、整理書包，23:00 就寢', '', 2),
        ]
    return []


def exam_day(day, ph, cap_pop, kb, hw_task, kbx_pop, kb2, light):
    name, kind, subj = EXAM[day]
    L = lambda s, e, n: (s, e, 'life', n, '', 2)
    F = lambda s, e, n: (s, e, 'fixed', n, '', 1)
    R = ('22:15', '22:45', 'rest', '娛樂／自由（30 分）', '', 3)
    if kind == 'kb1':
        return [L('07:00', '08:00', '起床、早餐；只看觀念總整理的五頁'),
                F('08:30', '16:00', '科學班初試（時間依准考證）'),
                L('16:00', '19:00', '回家休息，什麼都不用做'),
                ('19:00', '20:00', 'kbr', '初試回想：把記得的題型和不會的題寫下來', '複試和會考都用得到', 0),
                ('20:00', '23:00', 'rest', '今晚完全自由，23:00 就寢', '', 3)]
    if kind == 'kb2':
        return [L('07:00', '08:00', '起床、早餐'),
                F('08:30', '16:00', '科學班複試：實作＋面談（推估日期，以簡章為準）'),
                L('16:00', '18:45', '回家休息'),
                ('18:45', '20:15', 'mock', '回到會考：%s' % '錯題本今天到期的題目＋明天要讀的講義先翻', '若沒進複試，白天照放假日排：上午兩段會考、下午兩段會考', 0),
                ('20:30', '23:00', 'rest', '今晚自由，23:00 就寢', '', 3)]
    if kind == 'cap':
        if day == d(5, 15):
            return [L('06:30', '07:30', '起床、早餐；只看錯題紙'),
                    F('08:00', '16:40', '會考第一天：社會、數學、國文、寫作（依准考證）'),
                    L('17:00', '18:30', '回家、晚餐，今天考完的不要對答案'),
                    ('19:00', '20:00', 'sci', '明天考科：自然公式＋英文片語，只看錯題紙', '', 0),
                    ('20:00', '22:00', 'rest', '放鬆，22:00 就寢', '', 3)]
        return [L('06:30', '07:30', '起床、早餐'),
                F('08:00', '15:00', '會考第二天：自然、英文（依准考證）'),
                ('15:00', '23:00', 'rest', '全部結束。把時間還給你自己 🎉', '', 3)]
    gifted = is_gifted(day)
    first = name.endswith('第一天') or '第一天' in name
    out = [L('06:30', '07:20', '起床、早餐（只翻公式卡）'), F('07:30', '17:00', '學校：%s%s' % (name, ('（%s）' % subj) if subj else ''))]
    if kind == 'term3':                       # 三段：不準備，晚上照科班
        if gifted:
            return out + [L('17:30', '18:00', '回家、晚餐、出門'), F('18:00', '21:30', '資優數學'),
                          ('21:40', '22:20', 'hw', '雄科班補習作業', '', 0), ('22:20', '22:50', 'rest', '娛樂／自由（30 分）', '', 3),
                          L('22:50', '23:00', '23:00 就寢')]
        t1, t2 = kbx_pop(day), kbx_pop(day)
        return out + [L('17:30', '18:15', '回家、晚餐、休息'),
                      ('18:15', '19:45', t1['cat'], t1['n'], t1.get('d', ''), 0),
                      ('19:55', '21:15', t2['cat'], t2['n'], t2.get('d', ''), 0),
                      ('21:25', '22:15', 'hw', '雄科班補習作業', '', 0), R, L('22:45', '23:00', '23:00 就寢')]
    if ph == 'P5':                            # 四模不準備，晚上照科班
        if gifted:
            return out + [L('17:30', '18:00', '回家、晚餐、出門'), F('18:00', '21:30', '資優數學（最後一堂）'),
                          ('21:40', '22:20', 'hw', '雄科班補習作業（初試週：只寫老師指定要交的）', '', 0),
                          ('22:20', '22:50', 'rest', '娛樂／自由（30 分）', '', 3), L('22:50', '23:00', '23:00 就寢')]
        t1 = kb2.pop() or T('kb', '科班錯題本：到期題', '')
        t2 = kb2.pop() or T('kb', '科班錯題本：最常錯的題目', '')
        return out + [L('17:30', '18:15', '回家、晚餐、休息'),
                      ('18:15', '19:45', t1['cat'], t1['n'], t1.get('d', ''), 0),
                      ('19:55', '21:15', t2['cat'], t2['n'], t2.get('d', ''), 0),
                      ('21:25', '22:15', 'hw', '雄科班補習作業（初試週：只寫老師指定要交的）', '', 0), R,
                      L('22:45', '23:00', '23:00 就寢')]
    nxt = EXAM.get(day + dt.timedelta(days=1))
    fix = ('18:15', '19:45', 'mock', '訂正今天考的科目：錯題登記錯題本', '每題一行「為什麼錯」', 0)
    if gifted:
        tail = [L('17:30', '18:00', '回家、晚餐、出門'), F('18:00', '21:30', '資優數學')]
        if nxt:
            tail.append(('21:40', '22:20', 'mock', '明天考科快速過：%s' % (nxt[2] or '依考程'), '只看不寫', 0))
        else:
            tail.append(('21:40', '22:20', 'hw', '雄科班補習作業', '', 0))
        return out + tail + [('22:20', '22:50', 'rest', '娛樂／自由（30 分）', '', 3), L('22:50', '23:00', '23:00 就寢')]
    if nxt:
        return out + [L('17:30', '18:15', '回家、晚餐、休息'), fix,
                      ('19:55', '21:15', 'mock', '明天考科最後複習：%s' % (nxt[2] or '依考程'), '只看重點和錯題', 0),
                      ('21:25', '22:15', 'mock', '明天考科：公式、單字、易錯字快速過', '', 0), R,
                      L('22:45', '23:00', '準備明天考試用品，23:00 就寢')]
    # 第二天晚上：訂正＋回到常規
    if ph in ('P4', 'P5'):
        t2 = kbx_pop(day) if ph == 'P4' else (kb2.pop() or T('kb', '科班錯題本：到期題', ''))
    elif ph in ('P1', 'P2', 'P3', 'P3b'):
        t2 = kb.pop() or T('kbr', '補習講義複習', '')
    else:
        t2 = cap_pop(day, ph)
    s3 = hw_task(day, 'S3') if day <= CRAM_LAST else light()
    return out + [L('17:30', '18:15', '回家、晚餐、休息'), fix,
                  ('19:55', '21:15', t2['cat'], t2['n'], t2.get('d', ''), 0),
                  ('21:25', '22:15', s3['cat'], s3['n'], s3.get('d', ''), 0), R,
                  L('22:45', '23:00', '洗漱，23:00 就寢')]


def main():
    plan, stats, left = build()
    key = lambda x: '%d-%d-%d' % (x.year, x.month, x.day)
    exams = [[x.year, x.month, x.day, re.sub(r'（推估[^）]*）', '', n), 1 if '推估' in n else 0]
             for x, (n, kd, sb) in sorted(EXAM.items())]
    hol = OrderedDict((key(x), n) for x, n in list(HOLIDAY.items()) + list(SPRING.items()))
    out = {'v': VERSION, 'from': '2026-10-26', 'to': '2027-5-16', 'books': BK,
           'sci': [2027, 3, 6], 'cap': [2027, 5, 15], 'exams': exams, 'hol': hol,
           'hanfu': [key(x) for x in sorted(HANFU)], 'notes': OrderedDict((key(x), n) for x, n in DAY_NOTES.items()),
           'papers': [[bk, sc, sb, yr, a, b] for bk, lst in (('A', PAPERS_A), ('B', PAPERS_B)) for sc, sb, yr, a, b in lst],
           'days': plan}
    here = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(here, '..', 'plan.js')
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* 由 tools/gen_plan.py 產生，請勿手改 */\nwindow.PLAN=')
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    sys.stdout.reconfigure(encoding='utf-8')
    print('寫出', os.path.normpath(path), os.path.getsize(path), 'bytes,', len(plan), '天')
    for ph in ['P0', 'P1', 'P2', 'P3', 'P3b', 'P4', 'P5', 'P6', 'P7a', 'P7c', 'P7d']:
        s = stats[ph]
        tot = sum(s.values())
        if tot:
            print('%-4s %5d 分 ' % (ph, tot) + '  '.join('%s %d%%' % (k, round(v * 100 / tot)) for k, v in sorted(s.items(), key=lambda x: -x[1])))
    print('沒排進去的：', left)


if __name__ == '__main__':
    main()
