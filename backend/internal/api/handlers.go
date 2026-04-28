package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"

	"govnet/docify-backend/internal/pdf"
)

// PreviewRequest is the strict preview payload for local/remote document preview.
type PreviewRequest struct {
	HTML         string           `json:"html"`
	SampleData   map[string]any   `json:"sampleData"`
	PageSettings pdf.PageSettings `json:"pageSettings"`
}

type Handler struct {
	pdfClient *pdf.Client
}

func New(pdfClient *pdf.Client) *Handler {
	return &Handler{pdfClient: pdfClient}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /documents/preview-document", h.previewDocument)
}

func (h *Handler) previewDocument(w http.ResponseWriter, r *http.Request) {
	var req PreviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.HTML == "" {
		writeJSONError(w, http.StatusBadRequest, "html is required")
		return
	}

	renderedHTML, err := renderTemplate(req.HTML, req.SampleData)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, fmt.Sprintf("template render failed: %v", err))
		return
	}

	pdfBytes, err := h.pdfClient.HTMLToPDF(renderedHTML, req.PageSettings)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, fmt.Sprintf("pdf generation failed: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `inline; filename="preview.pdf"`)
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(pdfBytes)
}

func renderTemplate(htmlText string, data map[string]any) (string, error) {
	tmpl, err := template.New("preview").Parse(htmlText)
	if err != nil {
		return "", err
	}

	var out bytes.Buffer
	if err := tmpl.Execute(&out, data); err != nil {
		return "", err
	}

	return out.String(), nil
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
