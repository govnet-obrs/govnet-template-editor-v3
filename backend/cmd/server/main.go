package main

import (
	"log"
	"net/http"
	"os"
	"strings"

	"govnet/docify-backend/internal/api"
	"govnet/docify-backend/internal/pdf"
)

func main() {
	port := envOr("PORT", "8080")
	gotenbergURL := envOr("GOTENBERG_URL", "http://localhost:3599")
	apiToken := os.Getenv("API_TOKEN")
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")

	pdfClient := pdf.New(gotenbergURL)
	handler := api.New(pdfClient)

	mux := http.NewServeMux()
	handler.Register(mux)
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	var root http.Handler = mux
	root = withAuth(root, apiToken)
	root = withCORS(root, allowedOrigins)

	addr := ":" + port
	log.Printf("preview backend listening on %s (gotenberg: %s)", addr, gotenbergURL)
	if err := http.ListenAndServe(addr, root); err != nil {
		log.Fatal(err)
	}
}

func withAuth(next http.Handler, expectedToken string) http.Handler {
	if expectedToken == "" {
		return next
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		auth := r.Header.Get("Authorization")
		token, _ := strings.CutPrefix(auth, "Bearer ")
		if token != expectedToken {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
			return
		}

		next.ServeHTTP(w, r)
	})
}

func withCORS(next http.Handler, allowList string) http.Handler {
	allowed := parseCSV(allowList)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		allowOrigin := "*"

		if len(allowed) > 0 && origin != "" {
			allowOrigin = ""
			for _, candidate := range allowed {
				if candidate == "*" || strings.EqualFold(candidate, origin) {
					allowOrigin = origin
					break
				}
			}
		}

		if allowOrigin != "" {
			w.Header().Set("Access-Control-Allow-Origin", allowOrigin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Max-Age", "86400")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func envOr(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	return value
}

func parseCSV(raw string) []string {
	if raw == "" {
		return nil
	}

	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}
