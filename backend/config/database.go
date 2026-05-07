package config

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB
var LocalDB *gorm.DB // 근태/활동 기록용 로컬 SQLite

func ConnectDB() {
	dbName := os.Getenv("DB_NAME")
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
		dbName,
	)

	// DB가 없으면 자동 생성
	dsnNoDB := fmt.Sprintf("%s:%s@tcp(%s:%s)/?charset=utf8mb4&parseTime=True&loc=Local",
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_HOST"),
		os.Getenv("DB_PORT"),
	)
	initDB, err := gorm.Open(mysql.Open(dsnNoDB), &gorm.Config{})
	if err == nil {
		initDB.Exec(fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s`", dbName))
		sqlDB, _ := initDB.DB()
		sqlDB.Close()
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("DB 연결 실패:", err)
	}

	// 커넥션 풀 설정
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatal("DB 풀 설정 실패:", err)
	}
	sqlDB.SetMaxOpenConns(50)                  // 최대 동시 연결
	sqlDB.SetMaxIdleConns(20)                  // 대기 커넥션
	sqlDB.SetConnMaxLifetime(time.Hour)        // 커넥션 최대 수명
	sqlDB.SetConnMaxIdleTime(5 * time.Minute)  // 유휴 후 닫기

	log.Println("DB 연결 성공 (pool: max=50, idle=20)")
	DB = db
}

// ConnectLocalDB — 근태/활동 기록용 로컬 SQLite
func ConnectLocalDB() {
	dataDir := filepath.Join(".", ".data")
	os.MkdirAll(dataDir, 0755)
	dbPath := filepath.Join(dataDir, "local.db")

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Printf("[LocalDB] SQLite 연결 실패: %v — MySQL로 fallback", err)
		LocalDB = DB
		return
	}

	log.Printf("[LocalDB] 로컬 SQLite 연결: %s", dbPath)
	LocalDB = db
}
