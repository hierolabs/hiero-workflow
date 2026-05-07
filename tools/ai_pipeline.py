#!/usr/bin/env python3
"""
HIERO AI Pipeline — 멀티모델 자동 워크플로우
GPT(기획) → Claude(코딩) → Gemini(검수)

사용법:
  python ai_pipeline.py "deposit_date 기준 입금 예정 대시보드 추가"
  python ai_pipeline.py --plan-only "기능 설명"
  python ai_pipeline.py --review-only "코드 파일 경로"
"""

import os
import sys
import json
import argparse
from datetime import datetime
from pathlib import Path

# --- API Clients ---

def call_gpt(prompt: str, system: str = "") -> str:
    """OpenAI GPT-4o 호출 (기획자)"""
    from openai import OpenAI
    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=messages,
        temperature=0.7,
    )
    return resp.choices[0].message.content


def call_claude(prompt: str, system: str = "") -> str:
    """Anthropic Claude 호출 (개발자)"""
    import anthropic
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    kwargs = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 8192,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system
    resp = client.messages.create(**kwargs)
    return resp.content[0].text


def call_gemini(prompt: str, system: str = "") -> str:
    """Google Gemini 호출 (검수자)"""
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(
        model_name="gemini-2.5-pro",
        system_instruction=system or None,
    )
    resp = model.generate_content(prompt)
    return resp.text


# --- Pipeline Stages ---

SYSTEM_PLANNER = """너는 HIERO 프로젝트의 기획자다.
HIERO는 중단기 임대 운영 OS이며, Go(백엔드) + React/TypeScript(프론트) 스택을 사용한다.
기획 결과물은 다음을 포함해야 한다:
1. 기능 목적과 사용자 시나리오
2. 필요한 API 엔드포인트 목록
3. DB 변경 사항 (있으면)
4. UI 화면 구성
5. 엣지 케이스와 주의사항
간결하고 실행 가능한 기획서를 작성해라."""

SYSTEM_CODER = """너는 HIERO 프로젝트의 개발자다.
스택: Go(Gin/GORM) 백엔드, React/TypeScript 프론트엔드.
기획서를 받으면 바로 구현 가능한 코드를 작성해라.
- 파일 경로와 함께 전체 코드를 제공
- 기존 패턴을 따를 것
- 불필요한 설명 없이 코드 중심으로"""

SYSTEM_REVIEWER = """너는 HIERO 프로젝트의 코드 검수자다.
코드를 검토하고 다음을 체크해라:
1. 버그 또는 로직 오류
2. 보안 취약점
3. 성능 문제
4. 기획서와의 불일치
5. 누락된 엣지 케이스
문제가 있으면 구체적 수정 방안을 제시하고, 없으면 "PASS"로 표시해라."""


def run_pipeline(task: str, context: str = "") -> dict:
    """전체 파이프라인 실행: 기획 → 코딩 → 검수"""
    result = {"task": task, "timestamp": datetime.now().isoformat()}

    full_context = f"프로젝트 컨텍스트:\n{context}\n\n" if context else ""

    # Stage 1: GPT 기획
    print("\n[1/3] GPT-4o 기획 중...")
    plan_prompt = f"{full_context}다음 기능을 기획해줘:\n\n{task}"
    result["plan"] = call_gpt(plan_prompt, SYSTEM_PLANNER)
    print("  ✓ 기획 완료")

    # Stage 2: Claude 코딩
    print("[2/3] Claude 코딩 중...")
    code_prompt = f"{full_context}다음 기획서를 기반으로 코드를 작성해줘:\n\n{result['plan']}"
    result["code"] = call_claude(code_prompt, SYSTEM_CODER)
    print("  ✓ 코딩 완료")

    # Stage 3: Gemini 검수
    print("[3/3] Gemini 검수 중...")
    review_prompt = (
        f"기획서:\n{result['plan']}\n\n"
        f"구현 코드:\n{result['code']}\n\n"
        f"위 기획과 코드를 검수해줘."
    )
    result["review"] = call_gemini(review_prompt, SYSTEM_REVIEWER)
    print("  ✓ 검수 완료")

    return result


def run_plan_only(task: str, context: str = "") -> dict:
    """기획만 실행"""
    full_context = f"프로젝트 컨텍스트:\n{context}\n\n" if context else ""
    print("\n[1/1] GPT-4o 기획 중...")
    plan = call_gpt(f"{full_context}다음 기능을 기획해줘:\n\n{task}", SYSTEM_PLANNER)
    print("  ✓ 기획 완료")
    return {"task": task, "plan": plan, "timestamp": datetime.now().isoformat()}


def run_review_only(code_path: str, context: str = "") -> dict:
    """검수만 실행"""
    code = Path(code_path).read_text()
    print("\n[1/1] Gemini 검수 중...")
    review = call_gemini(
        f"다음 코드를 검수해줘:\n\n```\n{code}\n```",
        SYSTEM_REVIEWER,
    )
    print("  ✓ 검수 완료")
    return {"file": code_path, "review": review, "timestamp": datetime.now().isoformat()}


# --- Output ---

def save_result(result: dict, output_dir: str = "tools/pipeline_results"):
    """결과를 파일로 저장"""
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filepath = Path(output_dir) / f"pipeline_{ts}.md"

    sections = []
    sections.append(f"# AI Pipeline Result\n**Task:** {result.get('task', result.get('file', 'N/A'))}")
    sections.append(f"**Time:** {result['timestamp']}\n")

    if "plan" in result:
        sections.append(f"## 1. 기획 (GPT-4o)\n\n{result['plan']}\n")
    if "code" in result:
        sections.append(f"## 2. 코드 (Claude)\n\n{result['code']}\n")
    if "review" in result:
        sections.append(f"## 3. 검수 (Gemini)\n\n{result['review']}\n")

    filepath.write_text("\n---\n\n".join(sections))
    print(f"\n결과 저장: {filepath}")
    return str(filepath)


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="HIERO AI Pipeline")
    parser.add_argument("task", help="작업 설명 또는 파일 경로")
    parser.add_argument("--plan-only", action="store_true", help="기획만 실행")
    parser.add_argument("--review-only", action="store_true", help="검수만 실행")
    parser.add_argument("--context", "-c", default="", help="추가 컨텍스트 파일 경로")
    parser.add_argument("--no-save", action="store_true", help="결과 파일 저장 안 함")
    args = parser.parse_args()

    # 환경 변수 체크
    required_keys = {
        "plan-only": ["OPENAI_API_KEY"],
        "review-only": ["GEMINI_API_KEY"],
        "full": ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY"],
    }
    mode = "plan-only" if args.plan_only else "review-only" if args.review_only else "full"
    missing = [k for k in required_keys[mode] if not os.environ.get(k)]
    if missing:
        print(f"ERROR: 환경 변수 필요: {', '.join(missing)}")
        print("export OPENAI_API_KEY=xxx ANTHROPIC_API_KEY=xxx GEMINI_API_KEY=xxx")
        sys.exit(1)

    # 컨텍스트 로드
    context = ""
    if args.context:
        context = Path(args.context).read_text()

    # 실행
    if args.plan_only:
        result = run_plan_only(args.task, context)
    elif args.review_only:
        result = run_review_only(args.task, context)
    else:
        result = run_pipeline(args.task, context)

    # 출력
    for key in ["plan", "code", "review"]:
        if key in result:
            label = {"plan": "기획", "code": "코드", "review": "검수"}[key]
            print(f"\n{'='*60}")
            print(f"  {label}")
            print(f"{'='*60}")
            print(result[key])

    # 저장
    if not args.no_save:
        save_result(result)


if __name__ == "__main__":
    main()
