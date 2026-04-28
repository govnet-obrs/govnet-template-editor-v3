package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"math"
	"net/http"
	"reflect"
	"strings"
	"time"
	"unicode"

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

func safeHTML(s string) template.HTML {
	return template.HTML(s)
}

func add(a, b any) (float64, error) {
	left, err := toFloat64(a)
	if err != nil {
		return 0, err
	}

	right, err := toFloat64(b)
	if err != nil {
		return 0, err
	}

	return left + right, nil
}

func sub(a, b any) (float64, error) {
	left, err := toFloat64(a)
	if err != nil {
		return 0, err
	}

	right, err := toFloat64(b)
	if err != nil {
		return 0, err
	}

	return left - right, nil
}

func mul(a, b any) (float64, error) {
	left, err := toFloat64(a)
	if err != nil {
		return 0, err
	}

	right, err := toFloat64(b)
	if err != nil {
		return 0, err
	}

	return left * right, nil
}

func div(a, b any) (float64, error) {
	left, err := toFloat64(a)
	if err != nil {
		return 0, err
	}

	right, err := toFloat64(b)
	if err != nil {
		return 0, err
	}

	if right == 0 {
		return 0, fmt.Errorf("division by zero")
	}

	return left / right, nil
}

func defaultValue(fallback, value any) any {
	if isEmpty(value) {
		return fallback
	}

	return value
}

func coalesce(values ...any) any {
	for _, value := range values {
		if !isEmpty(value) {
			return value
		}
	}

	return nil
}

func upper(value any) string {
	return strings.ToUpper(fmt.Sprint(value))
}

func lower(value any) string {
	return strings.ToLower(fmt.Sprint(value))
}

func trim(value any) string {
	return strings.TrimSpace(fmt.Sprint(value))
}

func title(value any) string {
	runes := []rune(strings.ToLower(fmt.Sprint(value)))
	capitalize := true

	for i, r := range runes {
		if unicode.IsLetter(r) {
			if capitalize {
				runes[i] = unicode.ToUpper(r)
			}
			capitalize = false
			continue
		}

		capitalize = true
	}

	return string(runes)
}

func now() time.Time {
	return time.Now()
}

func dateFormat(layout string, value any) (string, error) {
	switch v := value.(type) {
	case time.Time:
		return v.Format(layout), nil
	case string:
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			return "", fmt.Errorf("invalid date string %q", v)
		}
		return t.Format(layout), nil
	default:
		return "", fmt.Errorf("unsupported date type %T", value)
	}
}

func isEmpty(value any) bool {
	if value == nil {
		return true
	}

	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.String, reflect.Array, reflect.Slice, reflect.Map:
		return rv.Len() == 0
	case reflect.Bool:
		return !rv.Bool()
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return rv.Int() == 0
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return rv.Uint() == 0
	case reflect.Float32, reflect.Float64:
		return rv.Float() == 0
	case reflect.Interface, reflect.Pointer:
		return rv.IsNil()
	}

	return false
}

func toFloat64(v any) (float64, error) {
	switch value := v.(type) {
	case int:
		return float64(value), nil
	case int8:
		return float64(value), nil
	case int16:
		return float64(value), nil
	case int32:
		return float64(value), nil
	case int64:
		return float64(value), nil
	case uint:
		return float64(value), nil
	case uint8:
		return float64(value), nil
	case uint16:
		return float64(value), nil
	case uint32:
		return float64(value), nil
	case uint64:
		if value > math.MaxInt64 {
			return 0, fmt.Errorf("value %v is too large", v)
		}
		return float64(value), nil
	case float32:
		return float64(value), nil
	case float64:
		return value, nil
	default:
		return 0, fmt.Errorf("unsupported number type %T", v)
	}
}

func renderTemplate(htmlText string, data map[string]any) (string, error) {
	tmpl, err := template.New("preview").
		Funcs(template.FuncMap{
			"safeHTML":   safeHTML,
			"add":        add,
			"sub":        sub,
			"mul":        mul,
			"div":        div,
			"default":    defaultValue,
			"coalesce":   coalesce,
			"upper":      upper,
			"lower":      lower,
			"trim":       trim,
			"title":      title,
			"now":        now,
			"dateFormat": dateFormat,
		}).
		Parse(htmlText)
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
