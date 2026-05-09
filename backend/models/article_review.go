package models

import "time"

// ArticleReview 위키 아티클 다관점 AI 평가 결과
type ArticleReview struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ArticleID    uint      `gorm:"index;not null" json:"article_id"`
	Perspective  string    `gorm:"size:30;not null" json:"perspective"`  // investor, academic, operator, reader, tech
	Name         string    `gorm:"size:50" json:"name"`                 // 투자자, 도시계획 학자, ...
	Score        int       `json:"score"`                               // 1~10
	Review       string    `gorm:"type:text" json:"review"`             // 전체 평가 텍스트
	ContentSnap  string    `gorm:"type:text" json:"content_snapshot"`   // 평가 시점의 원문 (처음 500자)
	WordCountAt  int       `json:"word_count_at"`                       // 평가 시점 글자수
	RequestedBy  string    `gorm:"size:100" json:"requested_by"`
	CreatedAt    time.Time `json:"created_at"`
}
