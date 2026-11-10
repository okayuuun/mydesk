#!/usr/bin/env python3
"""Googleニュースの公開RSSから見出し・出典・URL・日時だけ収集。外部ライブラリ不要。
GitHub Actionsで定期実行して静的な news.json を更新する。
"""
from __future__ import annotations
import datetime as dt
import email.utils
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'news.json'
SEARCHES = [
    ('総合', '(ゲーム業界 OR 新作ゲーム) (発表 OR 発売 OR 決算 OR 買収) when:7d'),
    ('任天堂', '(任天堂 OR Nintendo OR Switch) (発表 OR 発売 OR 新作) when:7d'),
    ('PlayStation', '(PlayStation OR PS5 OR ソニー) (新作 OR 発表 OR 発売) when:7d'),
    ('PC・Steam', '(Steam OR PCゲーム) (発売 OR 発表 OR アップデート) when:7d'),
    ('ゲーム開発', '(ゲーム開発 OR Unity OR Unreal Engine) (発表 OR 技術 OR 更新) when:7d'),
]
KEYWORDS = ('発表', '新作', '発売', '大型', '公開', '決算', '買収', '延期', '配信', 'アップデート', 'リリース', '公式', '開発', 'サービス終了', 'Nintendo', 'PlayStation', 'Steam', 'Switch')
STOP_WORDS = ('PR TIMES', '懸賞', 'まとめサイト', 'クーポン', 'アフィリエイト', '占い', '芸能')

def feed_url(query: str)->str:
    return 'https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':query,'hl':'ja','gl':'JP','ceid':'JP:ja'})

def parse_rss(xml_bytes: bytes, category: str, now: dt.datetime)->list[dict]:
    root=ET.fromstring(xml_bytes)
    results=[]
    for node in root.findall('.//channel/item'):
        title=(node.findtext('title') or '').strip()
        url=(node.findtext('link') or '').strip()
        src=(node.findtext('source') or '').strip()
        if not title or not url.startswith('https://') or len(title)>220:
            continue
        if any(x.lower() in title.lower() for x in STOP_WORDS):
            continue
        try:
            published=email.utils.parsedate_to_datetime(node.findtext('pubDate') or '')
            if published.tzinfo is None: published=published.replace(tzinfo=dt.timezone.utc)
            published=published.astimezone(dt.timezone.utc)
        except (ValueError, TypeError):
            continue
        age=(now-published).total_seconds()
        if age < -3600 or age > 8*86400:
            continue
        # 特集や短い噂記事より、具体的な発表・発売情報を少し上位にする（重要度を保証しない）
        score=sum(2 if kw in ('発表','発売','新作','大型') else 1 for kw in KEYWORDS if kw.lower() in title.lower())
        score+= max(0, int(8-age/86400))
        results.append({'title':title,'url':url,'source':src or 'Googleニュース','category':category,
                        'published':published.isoformat().replace('+00:00','Z'),'_score':score})
    return results

def main()->int:
    now=dt.datetime.now(dt.timezone.utc)
    seen=set(); items=[]; successes=0
    for category,query in SEARCHES:
        try:
            request=urllib.request.Request(feed_url(query),headers={'User-Agent':'Mozilla/5.0 (MyDesk personal news feed; RSS reader)','Accept':'application/rss+xml, application/xml'})
            with urllib.request.urlopen(request,timeout=18) as resp:
                blob=resp.read(1_800_000)
            found=parse_rss(blob,category,now)
            successes+=1
            print(category,len(found))
            # 1分野8記事まで。どのジャンルも一覧に残す
            for item in sorted(found,key=lambda x:(x['_score'],x['published']),reverse=True)[:8]:
                normalized=re.sub(r'\s+','',item['title'].split(' - ')[0]).lower()
                if normalized in seen:continue
                seen.add(normalized);items.append(item)
        except Exception as exc:
            print('取得失敗:',category,type(exc).__name__,str(exc)[:100],file=sys.stderr)
    if successes == 0 or not items:
        print('有効なニュースが得られません。既存のnews.jsonを維持します。',file=sys.stderr)
        return 1
    items=sorted(items,key=lambda x:(x['_score'],x['published']),reverse=True)[:36]
    for it in items:it.pop('_score',None)
    TARGET.write_text(json.dumps({'updatedAt':now.isoformat().replace('+00:00','Z'),'items':items},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('保存',len(items),'件')
    return 0

if __name__=='__main__':raise SystemExit(main())
