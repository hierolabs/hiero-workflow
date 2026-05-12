#!/usr/bin/env python3
"""
장소 가치 수집 스크립트
- Google Places API → 별점, 리뷰 수, 리뷰 텍스트
- 네이버 블로그 검색 API → 블로그 후기 수, 제목
- 카카오 로컬 API → 장소 상세, 카카오맵 URL
"""
import json, os, time, urllib.request, urllib.parse, ssl

# ─── API Keys ───
GOOGLE_KEY = "AIzaSyAIKOfUcgRcJXPONZX6WX4FlkswQcrnUV8"
NAVER_CLIENT = "0tzeawbnunuW9yOhjkmo"
NAVER_SECRET = "0nqK8GLLnB"
KAKAO_KEY = "2421434df12289654035b0fe54bb0eef"

# SSL 무시 (일부 환경)
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE, "admin", "public", "data")

def api_get(url, headers=None):
    """Simple GET with error handling"""
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=10, context=ctx) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"  ⚠ API 오류: {e}")
        return None

# ─── Google Places ───
def google_find_place(query):
    """Google Places - Find Place + Details"""
    q = urllib.parse.quote(query)
    url = f"https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input={q}&inputtype=textquery&fields=place_id,name,formatted_address,geometry&language=ko&key={GOOGLE_KEY}"
    data = api_get(url)
    if not data or not data.get("candidates"):
        return None
    return data["candidates"][0]

def google_place_details(place_id):
    """Google Places - Details (rating, reviews, etc.)"""
    url = f"https://maps.googleapis.com/maps/api/place/details/json?place_id={place_id}&fields=name,rating,user_ratings_total,reviews,editorial_summary,types,website,formatted_phone_number,opening_hours,url&language=ko&key={GOOGLE_KEY}"
    data = api_get(url)
    if not data or not data.get("result"):
        return None
    return data["result"]

# ─── 네이버 블로그 검색 ───
def naver_blog_search(query, display=5):
    """네이버 블로그 검색 → 후기 수, 제목"""
    q = urllib.parse.quote(query)
    url = f"https://openapi.naver.com/v1/search/blog.json?query={q}&display={display}&sort=sim"
    headers = {
        "X-Naver-Client-Id": NAVER_CLIENT,
        "X-Naver-Client-Secret": NAVER_SECRET,
    }
    data = api_get(url, headers)
    if not data:
        return {"total": 0, "items": []}
    return {
        "total": data.get("total", 0),
        "items": [
            {
                "title": item.get("title", "").replace("<b>", "").replace("</b>", ""),
                "description": item.get("description", "").replace("<b>", "").replace("</b>", "")[:100],
                "link": item.get("link", ""),
                "bloggername": item.get("bloggername", ""),
                "postdate": item.get("postdate", ""),
            }
            for item in data.get("items", [])[:display]
        ],
    }

# ─── 카카오 로컬 검색 ───
def kakao_search(query):
    """카카오 로컬 키워드 검색"""
    q = urllib.parse.quote(query)
    url = f"https://dapi.kakao.com/v2/local/search/keyword.json?query={q}&size=1"
    headers = {"Authorization": f"KakaoAK {KAKAO_KEY}"}
    data = api_get(url, headers)
    if not data or not data.get("documents"):
        return None
    doc = data["documents"][0]
    return {
        "kakao_id": doc.get("id"),
        "place_name": doc.get("place_name"),
        "category": doc.get("category_name"),
        "phone": doc.get("phone"),
        "address": doc.get("road_address_name") or doc.get("address_name"),
        "url": doc.get("place_url"),
        "lat": float(doc.get("y", 0)),
        "lng": float(doc.get("x", 0)),
    }

# ─── 감성 분석 (간이) ───
POSITIVE = ["맛있", "좋았", "최고", "추천", "감동", "완벽", "깔끔", "친절", "분위기", "재방문", "대만족", "최애", "정갈", "부드러", "깊은", "진한", "담백", "아름다", "멋진", "편안", "조용", "역사", "전통", "인생", "꼭 가", "또 가", "사랑", "힐링", "산책", "숨은"]
NEGATIVE = ["아쉬", "별로", "비싸", "짜", "불친절", "기다", "실망", "위생", "더러", "시끄", "냄새", "좁", "오래"]

def analyze_sentiment(texts):
    all_text = " ".join(texts)
    pos = sum(1 for w in POSITIVE if w in all_text)
    neg = sum(1 for w in NEGATIVE if w in all_text)
    total = pos + neg
    if total == 0:
        return 70  # neutral default
    return min(99, round(pos / total * 100))

def extract_keywords(texts):
    all_text = " ".join(texts)
    found = []
    for w in POSITIVE:
        if w in all_text:
            found.append({"word": w, "category": "긍정"})
    for w in NEGATIVE:
        if w in all_text:
            found.append({"word": w, "category": "부정"})
    return found[:15]

# ─── 메인 수집 ───
def collect_place_value(name, district, extra_query=""):
    """한 장소의 가치 데이터를 3개 소스에서 수집"""
    query = f"{name} {district} 서울" if extra_query == "" else extra_query
    print(f"\n▶ {name} ({district})")
    result = {
        "name": name,
        "district": district,
        "google": None,
        "naver": None,
        "kakao": None,
    }

    # 1. Google Places
    print("  📍 Google Places...")
    gplace = google_find_place(f"{name} 서울 {district}")
    if gplace and gplace.get("place_id"):
        details = google_place_details(gplace["place_id"])
        if details:
            reviews_raw = details.get("reviews", [])
            result["google"] = {
                "rating": details.get("rating"),
                "reviewCount": details.get("user_ratings_total", 0),
                "editorialSummary": details.get("editorial_summary", {}).get("overview", ""),
                "website": details.get("website", ""),
                "phone": details.get("formatted_phone_number", ""),
                "url": details.get("url", ""),
                "types": details.get("types", []),
                "reviews": [
                    {
                        "author": r.get("author_name", ""),
                        "rating": r.get("rating", 0),
                        "text": r.get("text", ""),
                        "time": r.get("relative_time_description", ""),
                    }
                    for r in reviews_raw[:5]
                ],
            }
            print(f"    ⭐ {details.get('rating')} ({details.get('user_ratings_total',0)}건)")
    time.sleep(0.2)

    # 2. 네이버 블로그
    print("  📝 네이버 블로그...")
    naver = naver_blog_search(f"{name} {district} 후기")
    result["naver"] = naver
    print(f"    블로그 {naver['total']}건")
    time.sleep(0.2)

    # 3. 카카오 로컬
    print("  🗺 카카오 로컬...")
    kakao = kakao_search(f"{name} {district}")
    result["kakao"] = kakao
    if kakao:
        print(f"    {kakao.get('category','')} | {kakao.get('url','')}")
    time.sleep(0.2)

    return result

def build_value_entry(raw, place_info=None):
    """수집 결과를 가치 분석 엔트리로 변환"""
    g = raw.get("google") or {}
    n = raw.get("naver") or {}
    k = raw.get("kakao") or {}

    # 리뷰 텍스트 수집
    review_texts = []
    if g.get("reviews"):
        review_texts += [r["text"] for r in g["reviews"] if r.get("text")]
    if n.get("items"):
        review_texts += [i["title"] + " " + i.get("description","") for i in n["items"]]

    sentiment = analyze_sentiment(review_texts)
    keywords = extract_keywords(review_texts)

    # 정체성 문장
    identity = []
    if g.get("editorialSummary"):
        identity.append(g["editorialSummary"])
    if g.get("reviews"):
        # 가장 높은 평점 리뷰에서 정체성 추출
        best = max(g["reviews"], key=lambda r: r.get("rating",0))
        if best.get("text"):
            identity.append(best["text"][:80])
    if n.get("total", 0) > 1000:
        identity.append(f"네이버 블로그에 {n['total']:,}건의 후기가 있는 인기 장소")
    elif n.get("total", 0) > 100:
        identity.append(f"블로그 후기 {n['total']:,}건 — 입소문이 퍼지고 있는 장소")

    rating = g.get("rating", 0)
    review_count = g.get("reviewCount", 0)
    blog_count = n.get("total", 0)

    # 가치 점수 = Google 별점×20 + min(리뷰수/100,30) + min(블로그수/100,20) + 감성×0.2
    value_score = round(
        (rating or 0) * 20
        + min(review_count / 100, 30)
        + min(blog_count / 100, 20)
        + sentiment * 0.2
    )

    has_web = bool(g.get("website") or (k and k.get("url")))
    has_phone = bool(g.get("phone") or (k and k.get("phone")) or (place_info and place_info.get("phone")))
    gap_count = place_info.get("gapCount", 0) if place_info else (0 if has_web and has_phone else (2 if not has_web and not has_phone else 1))

    return {
        "name": raw["name"],
        "district": raw["district"],
        "address": k.get("address", "") if k else "",
        "category": k.get("category", "") if k else "",
        "rating": rating,
        "reviewCount": review_count,
        "blogCount": blog_count,
        "phone": g.get("phone", "") or (k.get("phone","") if k else ""),
        "website": g.get("website", ""),
        "googleUrl": g.get("url", ""),
        "kakaoUrl": k.get("url", "") if k else "",
        "hasDigitalPresence": has_web,
        "gapCount": gap_count,
        "dataSource": "google+naver+kakao",
        "sentimentScore": sentiment,
        "keywords": keywords,
        "identity": identity,
        "reviews": g.get("reviews", [])[:5],
        "blogPosts": [
            {"title": i["title"], "blogger": i["bloggername"], "date": i.get("postdate","")}
            for i in n.get("items", [])[:3]
        ],
        "valueScore": value_score,
        "isHiddenGem": (rating or 0) >= 4.0 and gap_count >= 2,
    }


def main():
    # 대상 장소 로드
    seoul = json.load(open(os.path.join(DATA_DIR, "seoul-data.json")))

    # 고가치 후보: 태그 많은 명소 + 동결 장소 우선
    attractions = seoul.get("attractions", [])
    if isinstance(attractions, dict):
        attractions = attractions.get("all", [])

    # 태그 수 기준 정렬 (가치 높을 가능성)
    for a in attractions:
        a["_tagCount"] = len(str(a.get("tag","")).split(","))

    # 동결(gap>=2) 중 태그 많은 순 + 활성 중 태그 많은 순
    frozen = sorted([a for a in attractions if a["gapCount"] >= 2], key=lambda x: -x["_tagCount"])
    active = sorted([a for a in attractions if a["gapCount"] == 0], key=lambda x: -x["_tagCount"])

    # 수집 대상: 동결 TOP 25 + 활성 TOP 10 + 음식점 TOP 15 = 50개
    targets = []

    # 명소
    for a in frozen[:25]:
        targets.append({"name": a["name"], "district": a["district"], "info": a})
    for a in active[:10]:
        targets.append({"name": a["name"], "district": a["district"], "info": a})

    # 음식점 (gap >= 1인 것 중 랜덤 15개)
    restaurants = seoul.get("restaurants", [])
    rest_frozen = [r for r in restaurants if r["gapCount"] >= 1]
    import random
    random.seed(42)
    random.shuffle(rest_frozen)
    for r in rest_frozen[:15]:
        targets.append({"name": r["name"], "district": r["district"], "info": r})

    print(f"═══ 가치 수집 시작: {len(targets)}개 장소 ═══\n")

    results = []
    for i, t in enumerate(targets):
        print(f"\n[{i+1}/{len(targets)}]", end="")
        raw = collect_place_value(t["name"], t["district"])
        entry = build_value_entry(raw, t.get("info"))
        results.append(entry)

        # Rate limiting
        if (i + 1) % 10 == 0:
            print(f"\n  ⏳ {i+1}/{len(targets)} 완료, 잠시 대기...")
            time.sleep(1)

    # 가치 점수순 정렬
    results.sort(key=lambda x: -x["valueScore"])

    # 통계 계산
    rated = [r for r in results if r["rating"]]
    summary = {
        "totalAnalyzed": len(results),
        "avgRating": round(sum(r["rating"] for r in rated) / max(len(rated),1), 1),
        "totalReviews": sum(r["reviewCount"] for r in results),
        "totalBlogPosts": sum(r["blogCount"] for r in results),
        "hiddenGems": len([r for r in results if r["isHiddenGem"]]),
    }

    # 키워드 빈도
    kw_freq = {}
    for r in results:
        for kw in r.get("keywords", []):
            w = kw["word"]
            kw_freq[w] = kw_freq.get(w, 0) + 1

    # 구별 가치
    district_vals = {}
    for r in results:
        d = r["district"]
        if d not in district_vals:
            district_vals[d] = {"count": 0, "ratings": [], "totalReviews": 0, "totalBlogs": 0, "hiddenGems": 0}
        district_vals[d]["count"] += 1
        if r["rating"]: district_vals[d]["ratings"].append(r["rating"])
        district_vals[d]["totalReviews"] += r["reviewCount"]
        district_vals[d]["totalBlogs"] += r["blogCount"]
        if r["isHiddenGem"]: district_vals[d]["hiddenGems"] += 1
    for d in district_vals:
        rats = district_vals[d]["ratings"]
        district_vals[d]["avgRating"] = round(sum(rats) / max(len(rats),1), 1)
        del district_vals[d]["ratings"]

    output = {
        "generatedAt": "2026-05-12",
        "source": "Google Places API + 네이버 블로그 검색 + 카카오 로컬 API",
        "summary": summary,
        "places": results,
        "keywords": dict(sorted(kw_freq.items(), key=lambda x: -x[1])[:30]),
        "districtValues": district_vals,
    }

    out_path = os.path.join(DATA_DIR, "review-values.json")
    json.dump(output, open(out_path, "w"), ensure_ascii=False, indent=2)

    print(f"\n\n═══ 수집 완료 ═══")
    print(f"  장소: {summary['totalAnalyzed']}개")
    print(f"  평균별점: {summary['avgRating']}")
    print(f"  총 Google 리뷰: {summary['totalReviews']:,}건")
    print(f"  총 블로그 후기: {summary['totalBlogPosts']:,}건")
    print(f"  숨은보석: {summary['hiddenGems']}개")
    print(f"  저장: {out_path}")


if __name__ == "__main__":
    main()
