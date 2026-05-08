package main

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Message struct {
	ID             uint      `gorm:"primaryKey"`
	ConversationID string
	SenderType     string
	Content        string
	SentAt         time.Time
}

func main() {
	godotenv.Load("/Users/heiro/hiero-workflow/backend/.env")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_NAME"))
	db, _ := gorm.Open(mysql.Open(dsn), &gorm.Config{})

	var convIDs []string
	db.Table("messages").Distinct("conversation_id").Pluck("conversation_id", &convIDs)

	fmt.Printf("=== 대화 %d개 분석 (AI 자동 + 단순 답변 제외) ===\n\n", len(convIDs))

	// 호스트 자동메시지 패턴 (체크인 안내, 체크아웃 안내, 인사, 후기 요청)
	autoMsgKW := []string{
		"체크인", "check-in", "check in", "입실",
		"체크아웃", "check-out", "check out", "퇴실",
		"감사합니다", "thank you", "thanks",
		"리뷰", "review", "후기",
		"이용해주셔서", "즐거운", "편안한", "좋은 하루",
		"welcome", "enjoy", "have a great",
		"ai", "자동", "automated", "auto", "bot",
		"비밀번호", "password", "door code", "wifi",
		"주소", "address", "찾아오시는",
	}

	// 게스트 단순 답변 패턴 (이슈가 아닌 것)
	simpleReplyKW := []string{
		"감사", "고마워", "고맙습니다", "thank", "thanks",
		"네", "넵", "넹", "알겠", "ok", "okay",
		"잘 쉬었", "좋았", "만족", "최고", "편했",
		"수고", "잘 지냈", "good", "great", "nice", "perfect",
		"ㅎㅎ", "ㅋㅋ", "^^", ":)", "👍",
	}

	// 이슈 키워드
	issueKW := map[string][]string{
		"boiler":      {"온수", "보일러", "에러", "난방", "가스", "뜨거운물", "차가운물"},
		"checkin":     {"안열", "안돼", "못들어", "잠겨", "잠김", "문이안", "번호가안", "출입이안"},
		"parking":     {"주차등록", "출차", "주차비", "차가안나", "주차가안"},
		"cleaning":    {"청소", "머리카락", "냄새", "수건", "이불", "더러", "벌레", "바퀴"},
		"reservation": {"연장", "환불", "취소", "입금", "결제", "위약금"},
		"emergency":   {"화재", "가스누출", "물새", "정전", "119", "112"},
	}
	actionKW := []string{"수리", "교체", "출동", "기사", "방문", "설치", "보충", "배송"}

	type Exchange struct {
		ResponseSec int
		Category    string
		IsGuide     bool
		Hour        int
		GuestMsg    string
		HostMsg     string
	}

	var exchanges []Exchange
	var skippedAuto, skippedSimple int

	for _, cid := range convIDs {
		var msgs []Message
		db.Table("messages").Where("conversation_id = ?", cid).Order("sent_at ASC").Find(&msgs)

		for i := 0; i < len(msgs)-1; i++ {
			if msgs[i].SenderType != "guest" || msgs[i].Content == "" {
				continue
			}

			gText := strings.ToLower(msgs[i].Content)

			// 1) 이 게스트 메시지 바로 앞이 호스트 자동메시지인지 확인
			isReplyToAuto := false
			if i > 0 && msgs[i-1].SenderType == "host" {
				prevHost := strings.ToLower(msgs[i-1].Content)
				for _, kw := range autoMsgKW {
					if strings.Contains(prevHost, kw) {
						isReplyToAuto = true
						break
					}
				}
			}

			// 2) 게스트 메시지가 단순 답변인지
			isSimple := false
			if len(msgs[i].Content) < 50 { // 짧은 메시지만 체크
				for _, kw := range simpleReplyKW {
					if strings.Contains(gText, kw) {
						isSimple = true
						break
					}
				}
			}

			// 자동메시지에 대한 단순 답변이면 스킵
			if isReplyToAuto && isSimple {
				skippedSimple++
				continue
			}

			// 단순 답변이면 (자동 아니어도) 이슈 아닐 가능성 높음
			if isSimple && !containsIssueKW(gText, issueKW) {
				skippedSimple++
				continue
			}

			// 이슈 카테고리 분류
			cat := ""
			for c, kws := range issueKW {
				for _, kw := range kws {
					if strings.Contains(gText, kw) { cat = c; break }
				}
				if cat != "" { break }
			}
			if cat == "" { continue }

			// 다음 호스트 응답 찾기 (AI 자동 스킵)
			for j := i + 1; j < len(msgs); j++ {
				if msgs[j].SenderType != "host" { continue }

				hostLower := strings.ToLower(msgs[j].Content)

				// AI/자동 메시지 스킵
				isAutoHost := false
				for _, kw := range []string{"ai", "자동", "automated", "auto", "bot"} {
					if strings.Contains(hostLower, kw) { isAutoHost = true; break }
				}
				if isAutoHost { skippedAuto++; continue }

				// 야간 30초 이내 = 자동
				respSec := int(msgs[j].SentAt.Sub(msgs[i].SentAt).Seconds())
				kstH := (msgs[j].SentAt.Hour() + 9) % 24
				if (kstH >= 22 || kstH < 10) && respSec < 30 {
					skippedAuto++; continue
				}

				if respSec < 0 || respSec > 86400*3 { break }

				isGuide := true
				for _, kw := range actionKW {
					if strings.Contains(hostLower, kw) { isGuide = false; break }
				}

				guestH := (msgs[i].SentAt.Hour() + 9) % 24
				gSnip := msgs[i].Content; if len(gSnip) > 40 { gSnip = gSnip[:40] }
				hSnip := msgs[j].Content; if len(hSnip) > 40 { hSnip = hSnip[:40] }

				exchanges = append(exchanges, Exchange{
					ResponseSec: respSec, Category: cat, IsGuide: isGuide,
					Hour: guestH, GuestMsg: gSnip, HostMsg: hSnip,
				})
				break
			}
		}
	}

	fmt.Printf("이슈 교환: %d건 (자동 제외: %d, 단순답변 제외: %d)\n\n", len(exchanges), skippedAuto, skippedSimple)

	// 카테고리별
	fmt.Println("--- 카테고리별 ---")
	catStats := map[string]struct{ cnt, total, guide, action int }{}
	for _, e := range exchanges {
		s := catStats[e.Category]
		s.cnt++; s.total += e.ResponseSec
		if e.IsGuide { s.guide++ } else { s.action++ }
		catStats[e.Category] = s
	}
	for cat, s := range catStats {
		avg := s.total / max(s.cnt, 1)
		gPct := s.guide * 100 / max(s.cnt, 1)
		fmt.Printf("  %-15s %3d건  평균 %5d초 (%3d분)  안내%d%% 조치%d%%\n",
			cat, s.cnt, avg, avg/60, gPct, 100-gPct)
	}

	// 응답시간 분포
	fmt.Println("\n--- 응답시간 분포 ---")
	type Bucket struct { label string; lo, hi int }
	buckets := []Bucket{
		{"1분 이내", 0, 60}, {"1~5분", 61, 300}, {"5~15분", 301, 900},
		{"15~30분", 901, 1800}, {"30분~1시간", 1801, 3600}, {"1~3시간", 3601, 10800},
		{"3시간+", 10801, 999999},
	}
	for _, b := range buckets {
		cnt := 0
		for _, e := range exchanges { if e.ResponseSec >= b.lo && e.ResponseSec <= b.hi { cnt++ } }
		pct := cnt * 100 / max(len(exchanges), 1)
		bar := ""; for i := 0; i < pct/2; i++ { bar += "█" }
		fmt.Printf("  %-12s %3d건 (%2d%%) %s\n", b.label, cnt, pct, bar)
	}

	// 시간대별
	fmt.Println("\n--- 시간대별 평균 응답시간 (KST) ---")
	hourStats := map[int]struct{ total, cnt int }{}
	for _, e := range exchanges {
		s := hourStats[e.Hour]; s.total += e.ResponseSec; s.cnt++; hourStats[e.Hour] = s
	}
	for h := 0; h < 24; h++ {
		s := hourStats[h]; if s.cnt == 0 { continue }
		avg := s.total / s.cnt
		bar := ""; mins := avg/60; for i := 0; i < mins && i < 60; i++ { bar += "█" }
		fmt.Printf("  %02d시: %3d건  평균 %5d초 (%3d분) %s\n", h, s.cnt, avg, avg/60, bar)
	}

	// 전체 평균
	total := 0; for _, e := range exchanges { total += e.ResponseSec }
	if len(exchanges) > 0 {
		avg := total / len(exchanges)
		fmt.Printf("\n전체 평균 응답시간: %d초 (%d분)\n", avg, avg/60)
	}

	// 샘플 출력 (느린 응답 Top 5)
	fmt.Println("\n--- 가장 느린 응답 Top 5 ---")
	// 정렬
	for i := 0; i < len(exchanges); i++ {
		for j := i+1; j < len(exchanges); j++ {
			if exchanges[j].ResponseSec > exchanges[i].ResponseSec {
				exchanges[i], exchanges[j] = exchanges[j], exchanges[i]
			}
		}
	}
	for i := 0; i < min(5, len(exchanges)); i++ {
		e := exchanges[i]
		fmt.Printf("  %d분 [%s] 게스트: %s...\n", e.ResponseSec/60, e.Category, e.GuestMsg)
	}
}

func containsIssueKW(text string, kws map[string][]string) bool {
	for _, words := range kws {
		for _, w := range words {
			if strings.Contains(text, w) { return true }
		}
	}
	return false
}
func max(a, b int) int { if a > b { return a }; return b }
func min(a, b int) int { if a < b { return a }; return b }
