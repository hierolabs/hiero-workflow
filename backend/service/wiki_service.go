package service

import (
	"strings"
	"time"
	"unicode/utf8"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
)

type WikiService struct{}

func NewWikiService() *WikiService { return &WikiService{} }

// ── TOC ─────────────────────────────────────────────────────────────

type WikiTOCItem struct {
	ID           uint      `json:"id"`
	PartNumber   int       `json:"part_number"`
	PartTitle    string    `json:"part_title"`
	Chapter      int       `json:"chapter"`
	ChapterTitle string    `json:"chapter_title"`
	Section      string    `json:"section"`
	Title        string    `json:"title"`
	Status       string    `json:"status"`
	AssignedTo   string    `json:"assigned_to"`
	AuthorName   string    `json:"author_name"`
	WordCount    int       `json:"word_count"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (s *WikiService) GetTOC() ([]WikiTOCItem, error) {
	var articles []models.WikiArticle
	err := config.DB.
		Select("id, part_number, part_title, chapter, chapter_title, section, title, status, assigned_to, author_name, word_count, updated_at").
		Order("sort_order ASC, part_number ASC, chapter ASC, section ASC").
		Find(&articles).Error
	if err != nil {
		return nil, err
	}
	items := make([]WikiTOCItem, len(articles))
	for i, a := range articles {
		items[i] = WikiTOCItem{
			ID: a.ID, PartNumber: a.PartNumber, PartTitle: a.PartTitle,
			Chapter: a.Chapter, ChapterTitle: a.ChapterTitle,
			Section: a.Section, Title: a.Title, Status: a.Status,
			AssignedTo: a.AssignedTo, AuthorName: a.AuthorName,
			WordCount: a.WordCount, UpdatedAt: a.UpdatedAt,
		}
	}
	return items, nil
}

// ── Progress ────────────────────────────────────────────────────────

type WikiProgress struct {
	Total     int            `json:"total"`
	Empty     int            `json:"empty"`
	Draft     int            `json:"draft"`
	Review    int            `json:"review"`
	Published int            `json:"published"`
	ByPart    []PartProgress `json:"by_part"`
	ByRole    []RoleProgress `json:"by_role"`
}
type PartProgress struct {
	PartNumber int    `json:"part_number"`
	PartTitle  string `json:"part_title"`
	Total      int    `json:"total"`
	Filled     int    `json:"filled"`
}
type RoleProgress struct {
	Role   string `json:"role"`
	Total  int    `json:"total"`
	Filled int    `json:"filled"`
}

func (s *WikiService) GetProgress() (*WikiProgress, error) {
	var articles []models.WikiArticle
	if err := config.DB.Select("id, part_number, part_title, status, assigned_to").Find(&articles).Error; err != nil {
		return nil, err
	}
	p := &WikiProgress{}
	partMap := map[int]*PartProgress{}
	roleMap := map[string]*RoleProgress{}

	for _, a := range articles {
		p.Total++
		switch a.Status {
		case "empty":
			p.Empty++
		case "draft":
			p.Draft++
		case "review":
			p.Review++
		case "published":
			p.Published++
		}
		pp, ok := partMap[a.PartNumber]
		if !ok {
			pp = &PartProgress{PartNumber: a.PartNumber, PartTitle: a.PartTitle}
			partMap[a.PartNumber] = pp
		}
		pp.Total++
		if a.Status != "empty" {
			pp.Filled++
		}
		role := a.AssignedTo
		if role == "" {
			role = "unassigned"
		}
		rp, ok := roleMap[role]
		if !ok {
			rp = &RoleProgress{Role: role}
			roleMap[role] = rp
		}
		rp.Total++
		if a.Status != "empty" {
			rp.Filled++
		}
	}
	for _, v := range partMap {
		p.ByPart = append(p.ByPart, *v)
	}
	for _, v := range roleMap {
		p.ByRole = append(p.ByRole, *v)
	}
	return p, nil
}

// ── Get Article ─────────────────────────────────────────────────────

func (s *WikiService) GetArticle(id uint) (*models.WikiArticle, error) {
	var a models.WikiArticle
	if err := config.DB.First(&a, id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// ── Update ──────────────────────────────────────────────────────────

type UpdateArticleReq struct {
	Content      string `json:"content"`
	Status       string `json:"status"`
	RevisionNote string `json:"revision_note"`
	References   string `json:"references"`
}

func (s *WikiService) UpdateArticle(id uint, req UpdateArticleReq, authorID uint, authorName string) (*models.WikiArticle, error) {
	var a models.WikiArticle
	if err := config.DB.First(&a, id).Error; err != nil {
		return nil, err
	}
	if req.Content != a.Content && a.Content != "" {
		config.DB.Create(&models.WikiRevision{
			ArticleID: id, Content: a.Content,
			AuthorID: authorID, AuthorName: authorName,
			RevisionNote: req.RevisionNote, WordCount: a.WordCount,
		})
	}
	wc := countWords(req.Content)
	updates := map[string]interface{}{
		"content": req.Content, "word_count": wc,
		"author_id": authorID, "author_name": authorName,
	}
	if req.References != "" {
		updates["references"] = req.References
	}
	if req.Status != "" {
		updates["status"] = req.Status
		if req.Status == "published" {
			now := time.Now()
			updates["published_at"] = &now
		}
	} else if a.Status == "empty" && req.Content != "" {
		updates["status"] = "draft"
	}
	config.DB.Model(&a).Updates(updates)
	config.DB.First(&a, id)
	return &a, nil
}

// ── Assign ──────────────────────────────────────────────────────────

func (s *WikiService) AssignArticle(id uint, assignedTo string) error {
	return config.DB.Model(&models.WikiArticle{}).Where("id = ?", id).Update("assigned_to", assignedTo).Error
}

// ── Revisions ───────────────────────────────────────────────────────

func (s *WikiService) GetRevisions(articleID uint) ([]models.WikiRevision, error) {
	var revs []models.WikiRevision
	err := config.DB.Where("article_id = ?", articleID).Order("created_at DESC").Limit(50).Find(&revs).Error
	return revs, err
}

// ── Create Article ─────────────────────────────────────────────────

type CreateArticleReq struct {
	PartNumber   int    `json:"part_number"`
	PartTitle    string `json:"part_title"`
	Chapter      int    `json:"chapter"`
	ChapterTitle string `json:"chapter_title"`
	Section      string `json:"section"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	Status       string `json:"status"`
	AssignedTo   string `json:"assigned_to"`
	Tags         string `json:"tags"`
}

func (s *WikiService) CreateArticle(req CreateArticleReq, authorID uint, authorName string) (*models.WikiArticle, error) {
	// 같은 part+section 최대 sort_order 조회
	var maxSort int
	config.DB.Model(&models.WikiArticle{}).
		Where("part_number = ?", req.PartNumber).
		Select("COALESCE(MAX(sort_order), 0)").Scan(&maxSort)

	status := req.Status
	if status == "" && req.Content != "" {
		status = "draft"
	} else if status == "" {
		status = "empty"
	}

	wc := countWords(req.Content)
	var now *time.Time
	if status == "published" {
		t := time.Now()
		now = &t
	}

	article := models.WikiArticle{
		PartNumber:   req.PartNumber,
		PartTitle:    req.PartTitle,
		Chapter:      req.Chapter,
		ChapterTitle: req.ChapterTitle,
		Section:      req.Section,
		Title:        req.Title,
		Content:      req.Content,
		Status:       status,
		AssignedTo:   req.AssignedTo,
		AuthorID:     &authorID,
		AuthorName:   authorName,
		SortOrder:    maxSort + 1,
		Tags:         req.Tags,
		WordCount:    wc,
		PublishedAt:  now,
	}

	if err := config.DB.Create(&article).Error; err != nil {
		return nil, err
	}
	return &article, nil
}

func countWords(s string) int {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	return utf8.RuneCountInString(s)
}
