package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"

	"govnet/docify-backend/internal/pdf"
)

// PreviewRequest is compatible with the existing docify preview request shape,
// with templateContent added so preview can run without backend persistence.
type PreviewRequest struct {
	TemplateName    string           `json:"templateName"`
	Description     string           `json:"description"`
	Data            map[string]any   `json:"data"`
	TemplateContent string           `json:"templateContent"`
	PageSettings    pdf.PageSettings `json:"pageSettings"`
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

	if req.TemplateContent == "" {
		writeJSONError(w, http.StatusBadRequest, "templateContent is required")
		return
	}

	renderedHTML, err := renderTemplate(req.TemplateContent, req.Data)
	if err != nil {
		writeJSONError(w, http.StatusUnprocessableEntity, fmt.Sprintf("template render failed: %v", err))
		return
	}

	pdfBytes, err := h.pdfClient.HTMLToPDF(renderedHTML, req.PageSettings)
	if err != nil {
		writeJSONError(w, http.StatusBadGateway, fmt.Sprintf("pdf generation failed: %v", err))
		return
	}

	filename := "preview.pdf"
	if req.TemplateName != "" {
		filename = sanitizeFilename(req.TemplateName) + ".pdf"
	}

	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
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

func sanitizeFilename(name string) string {
	if name == "" {
		return "preview"
	}

	sanitized := make([]rune, 0, len(name))
	for _, r := range name {
		switch r {
		case '/', '\\', ':', '*', '?', '"', '<', '>', '|':
			sanitized = append(sanitized, '_')
		default:
			sanitized = append(sanitized, r)
		}
	}

	if len(sanitized) == 0 {
		return "preview"
	}

	return string(sanitized)
}

func writeJSONError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}
