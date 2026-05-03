from dataclasses import dataclass, asdict
from typing import List, Dict
import json
from datetime import datetime


@dataclass
class Lead:
    name: str
    area: str
    property_type: str
    current_status: str
    pain_point: str
    has_vacancy: bool = False
    has_operation_pain: bool = False
    has_revenue_pain: bool = False
    has_photos: bool = False
    ready_to_operate: bool = False


def score_lead(lead: Lead) -> int:
    score = 0

    if lead.has_vacancy:
        score += 30
    if lead.has_operation_pain:
        score += 25
    if lead.has_revenue_pain:
        score += 25
    if any(area in lead.area for area in ["서울", "강동", "종로", "마포", "홍대", "강남"]):
        score += 10
    if lead.property_type in ["오피스텔", "다가구", "빌라", "도시형생활주택", "단독주택"]:
        score += 10
    if lead.has_photos:
        score += 5
    if lead.ready_to_operate:
        score += 15

    return score


def classify_lead(score: int) -> str:
    if score >= 90:
        return "A급 - 즉시 상담"
    if score >= 70:
        return "B급 - 우선 연락"
    if score >= 50:
        return "C급 - 콘텐츠 육성"
    return "D급 - 보류"


def generate_first_message(lead: Lead) -> str:
    return f"""안녕하세요, {lead.name}님.

{lead.area} 지역의 {lead.property_type} 운영 가능성을 보고 연락드렸습니다.

현재 상황이 "{lead.current_status}"라면,
보통 가장 큰 문제는 "{lead.pain_point}"에서 생깁니다.

저희는 빈집이나 공실을 단순히 플랫폼에 올리는 것이 아니라,
사진, 가격, 채널 등록, 예약 관리, 청소 배정, CS, 정산 리포트까지 묶어서
실제로 예약이 발생하는 숙소 상품으로 만드는 위탁운영 시스템을 운영하고 있습니다.

계약을 권유드리기 전에 먼저 간단히 확인해드릴 수 있는 것은 다음입니다.

1. 이 숙소가 단기/미드텀 운영에 적합한지
2. 예상 월매출은 어느 정도인지
3. 손익분기 가동률은 어느 정도인지
4. 사진/구성/가격 중 어디가 문제인지

가능하시면 현재 숙소 사진 몇 장과 대략적인 위치를 보내주세요.
먼저 운영 가능성부터 간단히 진단해드리겠습니다.
"""


def generate_call_questions(lead: Lead) -> List[str]:
    return [
        "현재 이 공간은 공실인가요, 장기임대 중인가요, 아니면 이미 단기임대를 운영 중인가요?",
        "직접 운영을 하신다면 가장 부담되는 부분은 청소, CS, 예약, 가격, 정산 중 어디인가요?",
        "월 기준으로 어느 정도 수익이 나와야 운영할 가치가 있다고 보시나요?",
        "현재 숙소 사진이나 플랫폼 등록 페이지가 있으신가요?",
        "운영을 맡긴다면 가장 중요하게 보고 싶은 기준은 수익, 투명한 정산, 안정적 관리 중 무엇인가요?",
    ]


def recommend_next_action(score: int) -> str:
    if score >= 90:
        return "오늘 바로 전화 상담을 잡고 사진/주소를 받아라."
    if score >= 70:
        return "개인화 메시지를 보내고 답장 시 진단 상담으로 전환해라."
    if score >= 50:
        return "위탁운영 사례 콘텐츠를 보내고 3일 뒤 후속 연락해라."
    return "당장 영업하지 말고 DB에 저장만 해라."


def build_report(leads: List[Lead]) -> Dict:
    rows = []

    for lead in leads:
        score = score_lead(lead)
        rows.append({
            "lead": asdict(lead),
            "score": score,
            "grade": classify_lead(score),
            "first_message": generate_first_message(lead),
            "call_questions": generate_call_questions(lead),
            "next_action": recommend_next_action(score),
        })

    rows.sort(key=lambda x: x["score"], reverse=True)

    return {
        "created_at": datetime.now().isoformat(),
        "total_leads": len(leads),
        "leads": rows
    }


if __name__ == "__main__":
    leads = [
        Lead(
            name="김OO 임대인",
            area="서울 강동구",
            property_type="오피스텔",
            current_status="공실 상태로 월세 손실이 나는 상황",
            pain_point="공실과 고정비 손실",
            has_vacancy=True,
            has_operation_pain=True,
            has_revenue_pain=True,
            has_photos=True,
            ready_to_operate=True,
        ),
        Lead(
            name="박OO 호스트",
            area="종로구",
            property_type="다가구",
            current_status="에어비앤비를 해보고 싶지만 직접 운영이 어려운 상태",
            pain_point="청소와 게스트 응대 부담",
            has_vacancy=False,
            has_operation_pain=True,
            has_revenue_pain=False,
            has_photos=False,
            ready_to_operate=True,
        ),
    ]

    report = build_report(leads)

    with open("marketing/reports/lead_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    for item in report["leads"]:
        lead = item["lead"]
        print("=" * 70)
        print(f"{lead['name']} / {lead['area']} / {lead['property_type']}")
        print(f"점수: {item['score']} / 등급: {item['grade']}")
        print(f"다음 액션: {item['next_action']}")
        print()
        print(item["first_message"])
