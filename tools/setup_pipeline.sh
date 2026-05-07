#!/bin/bash
# HIERO AI Pipeline 의존성 설치

pip install openai anthropic google-generativeai

echo ""
echo "API 키 설정 (.zshrc에 추가):"
echo "  export OPENAI_API_KEY=your-key"
echo "  export ANTHROPIC_API_KEY=your-key"
echo "  export GEMINI_API_KEY=your-key"
