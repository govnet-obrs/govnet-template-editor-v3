package pdf

import (
	"bytes"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strconv"
	"time"
)

const defaultTimeout = 60 * time.Second

// PageSettings mirrors the page settings shape used by docify preview.
type PageSettings struct {
	PageSize     string `json:"pageSize"`
	Orientation  string `json:"orientation"`
	MarginTop    int    `json:"marginTop"`
	MarginBottom int    `json:"marginBottom"`
	MarginLeft   int    `json:"marginLeft"`
	MarginRight  int    `json:"marginRight"`
}

// Client calls Gotenberg's Chromium HTML-to-PDF endpoint.
type Client struct {
	baseURL    string
	httpClient *http.Client
}

func New(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: defaultTimeout,
		},
	}
}

func (c *Client) HTMLToPDF(renderedHTML string, ps PageSettings) ([]byte, error) {
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)

	fileHeader := make(textproto.MIMEHeader)
	fileHeader.Set("Content-Disposition", `form-data; name="files"; filename="index.html"`)
	fileHeader.Set("Content-Type", "text/html; charset=utf-8")

	filePart, err := writer.CreatePart(fileHeader)
	if err != nil {
		return nil, fmt.Errorf("create multipart html file: %w", err)
	}

	if _, err := io.WriteString(filePart, renderedHTML); err != nil {
		return nil, fmt.Errorf("write html content: %w", err)
	}

	width, height := resolvePageSize(ps)
	fields := map[string]string{
		"paperWidth":      formatFloat(width),
		"paperHeight":     formatFloat(height),
		"marginTop":       formatFloat(mmToIn(defaultIfZero(ps.MarginTop, 15))),
		"marginBottom":    formatFloat(mmToIn(defaultIfZero(ps.MarginBottom, 15))),
		"marginLeft":      formatFloat(mmToIn(defaultIfZero(ps.MarginLeft, 15))),
		"marginRight":     formatFloat(mmToIn(defaultIfZero(ps.MarginRight, 15))),
		"landscape":       strconv.FormatBool(ps.Orientation == "landscape"),
		"printBackground": "true",
	}

	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			return nil, fmt.Errorf("write form field %s: %w", key, err)
		}
	}

	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("close multipart writer: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, c.baseURL+"/forms/chromium/convert/html", &body)
	if err != nil {
		return nil, fmt.Errorf("build gotenberg request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("call gotenberg: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read gotenberg response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gotenberg status %d: %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

func resolvePageSize(ps PageSettings) (float64, float64) {
	var width float64
	var height float64

	switch ps.PageSize {
	case "A3":
		width, height = 11.7, 16.54
	case "A5":
		width, height = 5.83, 8.27
	case "A2":
		width, height = 16.54, 23.4
	case "Letter":
		width, height = 8.5, 11
	case "Legal":
		width, height = 8.5, 14
	case "A4", "":
		width, height = 8.27, 11.7
	default:
		width, height = 8.27, 11.7
	}

	if ps.Orientation == "landscape" {
		return height, width
	}

	return width, height
}

func mmToIn(mm int) float64 {
	return float64(mm) / 25.4
}

func defaultIfZero(value, fallback int) int {
	if value == 0 {
		return fallback
	}
	return value
}

func formatFloat(v float64) string {
	return strconv.FormatFloat(v, 'f', 4, 64)
}
