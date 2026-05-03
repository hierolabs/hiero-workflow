package main

import (
	"log"
	"os"

	"hiero-workflow/backend/config"
	"hiero-workflow/backend/models"
	"hiero-workflow/backend/router"

	"github.com/joho/godotenv"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println(".env 파일을 찾을 수 없습니다")
	}

	config.ConnectDB()
	config.DB.AutoMigrate(&models.Task{}, &models.AdminUser{})
	seedAdminUser()

	r := router.Setup()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("서버 시작: http://localhost:%s\n", port)
	r.Run(":" + port)
}

func seedAdminUser() {
	var count int64
	config.DB.Model(&models.AdminUser{}).Count(&count)
	if count > 0 {
		return
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatal("비밀번호 해싱 실패:", err)
	}

	admin := models.AdminUser{
		LoginID:  "admin",
		Password: string(hashed),
		Name:     "관리자",
		Role:     models.RoleSuperAdmin,
	}
	config.DB.Create(&admin)
	log.Println("기본 관리자 계정 생성 완료 (admin/admin)")
}
