package service

import (
	"fmt"
	"log"
	"time"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/hostex"
	"hiero-workflow/backend/models"
)

type ReviewService struct {
	client *hostex.Client
}

func NewReviewService() *ReviewService {
	return &ReviewService{
		client: hostex.NewClient(),
	}
}

// SyncReviews — Hostex 리뷰 전체 동기화 (최근 180일)
func (s *ReviewService) SyncReviews() (int, error) {
	now := time.Now()
	total := 0

	// 6개월분을 90일씩 2번에 나눠서
	for _, rangeStart := range []int{180, 90} {
		start := now.Add(-time.Duration(rangeStart) * 24 * time.Hour).Format("2006-01-02")
		end := now.Add(-time.Duration(rangeStart-90) * 24 * time.Hour).Format("2006-01-02")
		if rangeStart == 90 {
			end = now.Format("2006-01-02")
		}

		offset := 0
		for {
			reviews, err := s.client.GetReviews(map[string]string{
				"start_check_out_date": start,
				"end_check_out_date":   end,
				"review_status":        "reviewed",
				"limit":                "100",
				"offset":               fmt.Sprintf("%d", offset),
			})
			if err != nil {
				log.Printf("[ReviewSync] 조회 실패 (%s~%s): %s", start, end, err)
				break
			}
			if len(reviews) == 0 {
				break
			}

			for _, r := range reviews {
				s.upsertReview(r)
				total++
			}

			offset += len(reviews)
			if len(reviews) < 100 {
				break
			}
		}
	}

	log.Printf("[ReviewSync] 리뷰 동기화 완료: %d건", total)
	return total, nil
}

func (s *ReviewService) upsertReview(r hostex.HostexReview) {
	// property 매칭
	var internalPropID *uint
	var propName string
	var prop models.Property
	if err := config.DB.Where("hostex_id = ?", r.PropertyID).First(&prop).Error; err == nil {
		internalPropID = &prop.ID
		propName = prop.DisplayName
		if propName == "" {
			propName = prop.Name
		}
	}

	review := models.Review{
		ReservationCode: r.ReservationCode,
		PropertyID:      r.PropertyID,
		InternalPropID:  internalPropID,
		PropertyName:    propName,
		ChannelType:     r.ChannelType,
		CheckInDate:     r.CheckInDate,
		CheckOutDate:    r.CheckOutDate,
	}

	if r.GuestReview != nil {
		review.GuestScore = r.GuestReview.Score
		review.GuestContent = r.GuestReview.Content
		if t, err := time.Parse(time.RFC3339, r.GuestReview.CreatedAt); err == nil {
			review.GuestReviewAt = &t
		}
		for _, sub := range r.GuestReview.SubScore {
			switch sub.Category {
			case "accuracy":
				review.AccuracyScore = sub.Rating
			case "checkin":
				review.CheckinScore = sub.Rating
			case "cleanliness":
				review.CleanlinessScore = sub.Rating
			case "communication":
				review.CommunicationScore = sub.Rating
			case "location":
				review.LocationScore = sub.Rating
			case "value":
				review.ValueScore = sub.Rating
			}
		}
	}

	if r.HostReview != nil {
		review.HostScore = r.HostReview.Score
		review.HostContent = r.HostReview.Content
		if t, err := time.Parse(time.RFC3339, r.HostReview.CreatedAt); err == nil {
			review.HostReviewAt = &t
		}
	}

	if r.HostReply != nil {
		review.HostReply = *r.HostReply
	}

	var existing models.Review
	if err := config.DB.Where("reservation_code = ?", r.ReservationCode).First(&existing).Error; err != nil {
		config.DB.Create(&review)
	} else {
		review.ID = existing.ID
		config.DB.Model(&existing).Updates(review)
	}
}

// SyncSingleReview — 단건 리뷰 동기화 (웹훅용)
func (s *ReviewService) SyncSingleReview(reservationCode string) {
	reviews, err := s.client.GetReviews(map[string]string{
		"reservation_code": reservationCode,
		"limit":            "1",
	})
	if err != nil {
		log.Printf("[ReviewSync] 단건 조회 실패 (%s): %s", reservationCode, err)
		return
	}
	for _, r := range reviews {
		s.upsertReview(r)
		log.Printf("[ReviewSync] 리뷰 저장: %s (score: %d)", reservationCode, r.GuestReview.Score)
	}
}

// ListRecent — 최근 리뷰 목록
func (s *ReviewService) ListRecent(days int) []models.Review {
	var reviews []models.Review
	since := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	config.DB.Where("guest_review_at >= ?", since).Order("guest_review_at DESC").Find(&reviews)
	return reviews
}

// GetLowScoreReviews — 낮은 점수 리뷰 (4점 이하)
func (s *ReviewService) GetLowScoreReviews(days int) []models.Review {
	var reviews []models.Review
	since := time.Now().Add(-time.Duration(days) * 24 * time.Hour)
	config.DB.Where("guest_score > 0 AND guest_score <= 4 AND guest_review_at >= ?", since).
		Order("guest_score ASC, guest_review_at DESC").Find(&reviews)
	return reviews
}
