package models

import "time"

// WikiArticle represents a section in the company knowledge base (Operating Manual / Technical Whitepaper).
type WikiArticle struct {
	ID           uint       `gorm:"primaryKey" json:"id"`
	PartNumber   int        `gorm:"not null;index" json:"part_number"`
	PartTitle    string     `gorm:"size:200;not null" json:"part_title"`
	Chapter      int        `gorm:"not null;index" json:"chapter"`
	ChapterTitle string     `gorm:"size:200;not null" json:"chapter_title"`
	Section      string     `gorm:"size:20" json:"section"`
	Title        string     `gorm:"size:300;not null" json:"title"`
	Content      string     `gorm:"type:longtext" json:"content"`
	Status       string     `gorm:"size:30;not null;default:empty" json:"status"` // empty, draft, review, published
	AssignedTo   string     `gorm:"size:50" json:"assigned_to"`
	AuthorID     *uint      `gorm:"index" json:"author_id"`
	AuthorName   string     `gorm:"size:100" json:"author_name"`
	ReviewedBy   string     `gorm:"size:100" json:"reviewed_by"`
	SortOrder    int        `gorm:"not null;default:0" json:"sort_order"`
	Tags         string     `gorm:"size:500" json:"tags"`
	References   string     `gorm:"type:text" json:"references"` // JSON array [{url, title, note}]
	WordCount    int        `gorm:"not null;default:0" json:"word_count"`
	PublishedAt  *time.Time `json:"published_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// WikiRevision stores edit history for each article.
type WikiRevision struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	ArticleID    uint      `gorm:"not null;index" json:"article_id"`
	Content      string    `gorm:"type:longtext" json:"content"`
	AuthorID     uint      `gorm:"not null" json:"author_id"`
	AuthorName   string    `gorm:"size:100" json:"author_name"`
	RevisionNote string    `gorm:"size:500" json:"revision_note"`
	WordCount    int       `gorm:"not null;default:0" json:"word_count"`
	CreatedAt    time.Time `json:"created_at"`
}
