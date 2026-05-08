package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

type Message struct {
	ConversationID string
	SenderType     string
	Content        string
	SentAt         string
}

type Conversation struct {
	ConversationID string
	GuestName      string
	ChannelType    string
}

func main() {
	godotenv.Load("/Users/heiro/hiero-workflow/backend/.env")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"), os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"), os.Getenv("DB_PORT"), os.Getenv("DB_NAME"))
	db, _ := gorm.Open(mysql.Open(dsn), &gorm.Config{})

	// 전체 게스트 메시지
	var msgs []Message
	db.Table("messages").Select("conversation_id, sender_type, content, sent_at").
		Where("sender_type = 'guest' AND content != ''").
		Order("sent_at ASC").Find(&msgs)

	fmt.Printf("=== 게스트 메시지 %d건 분석 ===\n\n", len(msgs))

	// ========== 1. 얼리 체크인 / 레이트 체크아웃 / 얼리 체크아웃 ==========
	earlyCheckin := 0
	lateCheckout := 0
	earlyCheckout := 0
	lateCheckin := 0

	earlyCheckinMsgs := []string{}
	lateCheckoutMsgs := []string{}
	earlyCheckoutMsgs := []string{}

	for _, m := range msgs {
		lower := strings.ToLower(m.Content)

		// 얼리 체크인
		if (strings.Contains(lower, "일찍") && (strings.Contains(lower, "들어") || strings.Contains(lower, "입실") || strings.Contains(lower, "체크인"))) ||
			(strings.Contains(lower, "early") && strings.Contains(lower, "check")) ||
			(strings.Contains(lower, "얼리") && strings.Contains(lower, "체크인")) ||
			(strings.Contains(lower, "체크인") && (strings.Contains(lower, "앞당") || strings.Contains(lower, "빨리"))) ||
			(strings.Contains(lower, "미리") && strings.Contains(lower, "들어")) ||
			(strings.Contains(lower, "오전") && strings.Contains(lower, "입실")) ||
			(strings.Contains(lower, "일찍") && strings.Contains(lower, "가능")) {
			earlyCheckin++
			snip := m.Content; if len(snip) > 60 { snip = snip[:60] }
			if len(earlyCheckinMsgs) < 5 { earlyCheckinMsgs = append(earlyCheckinMsgs, snip) }
		}

		// 레이트 체크아웃
		if (strings.Contains(lower, "늦게") && (strings.Contains(lower, "나가") || strings.Contains(lower, "퇴실") || strings.Contains(lower, "체크아웃"))) ||
			(strings.Contains(lower, "late") && strings.Contains(lower, "check")) ||
			(strings.Contains(lower, "레이트") && strings.Contains(lower, "체크아웃")) ||
			(strings.Contains(lower, "체크아웃") && (strings.Contains(lower, "늦") || strings.Contains(lower, "연장"))) ||
			(strings.Contains(lower, "더 있") && (strings.Contains(lower, "가능") || strings.Contains(lower, "될까"))) ||
			(strings.Contains(lower, "오후") && strings.Contains(lower, "퇴실")) {
			lateCheckout++
			snip := m.Content; if len(snip) > 60 { snip = snip[:60] }
			if len(lateCheckoutMsgs) < 5 { lateCheckoutMsgs = append(lateCheckoutMsgs, snip) }
		}

		// 얼리 체크아웃 (일찍 나감)
		if (strings.Contains(lower, "일찍") && (strings.Contains(lower, "나가") || strings.Contains(lower, "퇴실") || strings.Contains(lower, "체크아웃"))) ||
			(strings.Contains(lower, "먼저") && strings.Contains(lower, "나가")) ||
			(strings.Contains(lower, "오전") && strings.Contains(lower, "나가")) ||
			(strings.Contains(lower, "빨리") && strings.Contains(lower, "체크아웃")) {
			earlyCheckout++
			snip := m.Content; if len(snip) > 60 { snip = snip[:60] }
			if len(earlyCheckoutMsgs) < 5 { earlyCheckoutMsgs = append(earlyCheckoutMsgs, snip) }
		}

		// 레이트 체크인 (늦게 도착)
		if (strings.Contains(lower, "늦게") && (strings.Contains(lower, "도착") || strings.Contains(lower, "들어") || strings.Contains(lower, "입실"))) ||
			(strings.Contains(lower, "늦은") && strings.Contains(lower, "체크인")) ||
			(strings.Contains(lower, "밤") && (strings.Contains(lower, "도착") || strings.Contains(lower, "들어"))) ||
			(strings.Contains(lower, "새벽") && strings.Contains(lower, "도착")) {
			lateCheckin++
		}

		// 주차는 아래에서 별도 분석
	}

	fmt.Println("========== 체크인/아웃 시간 요청 ==========")
	fmt.Printf("  얼리 체크인 요청:    %d건\n", earlyCheckin)
	fmt.Printf("  레이트 체크아웃 요청: %d건\n", lateCheckout)
	fmt.Printf("  얼리 체크아웃 (일찍 나감): %d건\n", earlyCheckout)
	fmt.Printf("  레이트 체크인 (늦게 도착): %d건\n", lateCheckin)

	if len(earlyCheckinMsgs) > 0 {
		fmt.Println("\n  [얼리 체크인 샘플]")
		for _, s := range earlyCheckinMsgs { fmt.Printf("    • %s\n", s) }
	}
	if len(lateCheckoutMsgs) > 0 {
		fmt.Println("\n  [레이트 체크아웃 샘플]")
		for _, s := range lateCheckoutMsgs { fmt.Printf("    • %s\n", s) }
	}
	if len(earlyCheckoutMsgs) > 0 {
		fmt.Println("\n  [얼리 체크아웃 샘플]")
		for _, s := range earlyCheckoutMsgs { fmt.Printf("    • %s\n", s) }
	}

	// ========== 2. 주차 수요 ==========
	fmt.Println("\n========== 주차 수요 ==========")

	parkingRequest := 0    // 주차 가능한지 문의
	parkingHelp := 0       // 주차 관련 도움 요청 (등록, 출차 등)
	parkingInfo := 0       // 주차 정보 문의 (위치, 방법)
	noParkingMention := 0  // 주차 불가 관련

	parkingSamples := []string{}

	for _, m := range msgs {
		lower := strings.ToLower(m.Content)
		if !strings.Contains(lower, "주차") && !strings.Contains(lower, "parking") &&
			!strings.Contains(lower, "차량") && !strings.Contains(lower, "차를") {
			continue
		}

		snip := m.Content; if len(snip) > 80 { snip = snip[:80] }

		// 주차 가능 여부 문의
		if strings.Contains(lower, "주차") && (strings.Contains(lower, "가능") || strings.Contains(lower, "되나") || strings.Contains(lower, "있나") || strings.Contains(lower, "할 수")) {
			parkingRequest++
			if len(parkingSamples) < 5 { parkingSamples = append(parkingSamples, "[가능여부] "+snip) }
			continue
		}

		// 주차 도움 (등록, 출차, 주차비)
		if strings.Contains(lower, "등록") || strings.Contains(lower, "출차") || strings.Contains(lower, "주차비") || strings.Contains(lower, "정기권") {
			parkingHelp++
			if len(parkingSamples) < 8 { parkingSamples = append(parkingSamples, "[등록/출차] "+snip) }
			continue
		}

		// 주차 불가
		if strings.Contains(lower, "주차") && (strings.Contains(lower, "안되") || strings.Contains(lower, "불가") || strings.Contains(lower, "없")) {
			noParkingMention++
			continue
		}

		// 주차 정보 문의
		parkingInfo++
		if len(parkingSamples) < 10 { parkingSamples = append(parkingSamples, "[정보] "+snip) }
	}

	totalParking := parkingRequest + parkingHelp + parkingInfo + noParkingMention
	fmt.Printf("  주차 관련 메시지 총: %d건\n", totalParking)
	fmt.Printf("    주차 가능 여부 문의: %d건\n", parkingRequest)
	fmt.Printf("    주차 등록/출차 도움: %d건\n", parkingHelp)
	fmt.Printf("    주차 정보 문의:      %d건\n", parkingInfo)
	fmt.Printf("    주차 불가 언급:      %d건\n", noParkingMention)

	if totalParking > 0 && len(msgs) > 0 {
		fmt.Printf("\n  전체 메시지 대비 주차 비율: %.1f%%\n", float64(totalParking)/float64(len(msgs))*100)
	}

	if len(parkingSamples) > 0 {
		fmt.Println("\n  [주차 메시지 샘플]")
		for _, s := range parkingSamples { fmt.Printf("    • %s\n", s) }
	}

	// ========== 3. 통화 데이터에서도 주차/얼리/레이트 확인 ==========
	// CSV 파일명에서 추출
	fmt.Println("\n========== 전체 비율 요약 ==========")
	fmt.Printf("  전체 게스트 메시지: %d건\n", len(msgs))
	fmt.Printf("  얼리체크인+레이트체크아웃 요청: %d건 (%.1f%%)\n",
		earlyCheckin+lateCheckout, float64(earlyCheckin+lateCheckout)/float64(len(msgs))*100)
	fmt.Printf("  주차 관련 전체: %d건 (%.1f%%)\n",
		totalParking, float64(totalParking)/float64(len(msgs))*100)

	// 월별 추이
	fmt.Println("\n========== 월별 추이 ==========")
	type Monthly struct{ early, late, parking int }
	monthly := map[string]*Monthly{}
	for _, m := range msgs {
		if len(m.SentAt) < 7 { continue }
		mon := m.SentAt[:7]
		if monthly[mon] == nil { monthly[mon] = &Monthly{} }
		lower := strings.ToLower(m.Content)

		if (strings.Contains(lower, "일찍") || strings.Contains(lower, "얼리") || strings.Contains(lower, "early")) &&
			(strings.Contains(lower, "체크인") || strings.Contains(lower, "들어") || strings.Contains(lower, "입실")) {
			monthly[mon].early++
		}
		if (strings.Contains(lower, "늦게") || strings.Contains(lower, "레이트") || strings.Contains(lower, "late") || strings.Contains(lower, "연장")) &&
			(strings.Contains(lower, "체크아웃") || strings.Contains(lower, "나가") || strings.Contains(lower, "퇴실")) {
			monthly[mon].late++
		}
		if strings.Contains(lower, "주차") || strings.Contains(lower, "parking") {
			monthly[mon].parking++
		}
	}
	fmt.Printf("  %-10s  얼리IN  레이트OUT  주차\n", "월")
	for _, mon := range []string{"2025-12","2026-01","2026-02","2026-03","2026-04","2026-05"} {
		if m, ok := monthly[mon]; ok {
			fmt.Printf("  %-10s  %5d   %7d   %4d\n", mon, m.early, m.late, m.parking)
		}
	}
}
