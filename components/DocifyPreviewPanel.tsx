"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PageSettings } from '@/components/SettingsEditor'

interface DocifyPreviewPanelProps {
    htmlContent: string
    pageSettings: PageSettings
    previewMode: 'html' | 'pdf' | 'local'
    onPreviewModeChange: (mode: 'html' | 'pdf' | 'local') => void
    apiUrl: string
    localPreviewUrl: string
    templateName: string
    description: string
    sampleData: string
}

export function DocifyPreviewPanel({
    htmlContent,
    pageSettings,
    previewMode,
    onPreviewModeChange,
    apiUrl,
    localPreviewUrl,
    templateName,
    description,
    sampleData,
}: DocifyPreviewPanelProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [localPdfUrl, setLocalPdfUrl] = useState<string | null>(null)
    const [pdfError, setPdfError] = useState<string | null>(null)
    const [localPdfError, setLocalPdfError] = useState<string | null>(null)
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
    const [isGeneratingLocalPdf, setIsGeneratingLocalPdf] = useState(false)
    const lastPdfUrlRef = useRef<string | null>(null)
    const lastLocalPdfUrlRef = useRef<string | null>(null)
    const hasLocalPreview = Boolean(localPreviewUrl?.trim())

    const revokePdfUrl = useCallback((url: string | null) => {
        if (url) {
            URL.revokeObjectURL(url)
        }
    }, [])

    const parseSampleData = useCallback(() => {
        if (!sampleData?.trim()) {
            return {}
        }

        const parsed = JSON.parse(sampleData)
        if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
            throw new Error('Sample JSON must be a JSON object')
        }

        return parsed
    }, [sampleData])

    const getResponseError = useCallback(async (response: Response) => {
        try {
            const body = await response.json()
            if (body?.error && typeof body.error === 'string') {
                return body.error
            }
        } catch {
            // Ignore parse failures and fall back to HTTP status details.
        }

        return `Failed to generate PDF (${response.status})`
    }, [])

    const generatePdfForMode = useCallback(async (mode: 'pdf' | 'local') => {
        if (mode === 'pdf' && isGeneratingPdf) return
        if (mode === 'local' && isGeneratingLocalPdf) return

        const targetApiUrl = mode === 'pdf' ? apiUrl : localPreviewUrl
        if (!targetApiUrl) {
            if (mode === 'pdf') {
                setPdfError('Missing document generator API URL')
            } else {
                setLocalPdfError('Missing local preview URL')
            }
            return
        }

        if (!htmlContent?.trim()) {
            if (mode === 'pdf') {
                setPdfError('Missing template HTML content')
            } else {
                setLocalPdfError('Missing template HTML content')
            }
            return
        }

        let dataPayload: Record<string, unknown>
        try {
            dataPayload = parseSampleData()
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Sample JSON is invalid'
            if (mode === 'pdf') {
                setPdfError(message)
            } else {
                setLocalPdfError(message)
            }
            return
        }

        if (mode === 'pdf') {
            setIsGeneratingPdf(true)
            setPdfError(null)
        } else {
            setIsGeneratingLocalPdf(true)
            setLocalPdfError(null)
        }

        try {
            const token =
                process.env.NEXT_PUBLIC_DOCUMENT_GENERATOR_API_TOKEN ||
                process.env.DOCUMENT_GENERATOR_API_TOKEN ||
                ''

            const requestBody = mode === 'pdf'
                ? {
                    templateName,
                    description,
                    data: dataPayload,
                    templateContent: htmlContent,
                    pageSettings,
                }
                : {
                    html: htmlContent,
                    sampleData: dataPayload,
                    pageSettings,
                }

            const response = await fetch(`${targetApiUrl}/documents/preview-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
            })

            if (!response.ok) {
                throw new Error(await getResponseError(response))
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)

            if (mode === 'pdf') {
                revokePdfUrl(lastPdfUrlRef.current)
                lastPdfUrlRef.current = url
                setPdfUrl(url)
            } else {
                revokePdfUrl(lastLocalPdfUrlRef.current)
                lastLocalPdfUrlRef.current = url
                setLocalPdfUrl(url)
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate PDF'
            if (mode === 'pdf') {
                setPdfError(message)
            } else {
                setLocalPdfError(message)
            }
        } finally {
            if (mode === 'pdf') {
                setIsGeneratingPdf(false)
            } else {
                setIsGeneratingLocalPdf(false)
            }
        }
    }, [apiUrl, localPreviewUrl, templateName, description, htmlContent, pageSettings, isGeneratingPdf, isGeneratingLocalPdf, parseSampleData, getResponseError, revokePdfUrl])

    const handleGeneratePdf = useCallback(async () => {
        await generatePdfForMode('pdf')
    }, [generatePdfForMode])

    const handleGenerateLocalPdf = useCallback(async () => {
        await generatePdfForMode('local')
    }, [generatePdfForMode])

    useEffect(() => {
        return () => {
            revokePdfUrl(lastPdfUrlRef.current)
            lastPdfUrlRef.current = null
            revokePdfUrl(lastLocalPdfUrlRef.current)
            lastLocalPdfUrlRef.current = null
        }
    }, [revokePdfUrl])

    return (
        <div className="flex flex-col border-l border-border h-full">
            <div className="bg-muted/50 px-4 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Live Preview</p>
                <div className="flex items-center gap-2">
                    <Button
                        variant={previewMode === 'html' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => onPreviewModeChange('html')}
                    >
                        HTML
                    </Button>
                    <Button
                        variant={previewMode === 'pdf' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => {
                            onPreviewModeChange('pdf')
                            void handleGeneratePdf()
                        }}
                    >
                        PDF
                    </Button>
                    {hasLocalPreview && (
                        <Button
                            variant={previewMode === 'local' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                                onPreviewModeChange('local')
                                void handleGenerateLocalPdf()
                            }}
                        >
                            Local
                        </Button>
                    )}
                    {previewMode === 'pdf' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleGeneratePdf()}
                            disabled={isGeneratingPdf}
                        >
                            Refresh
                        </Button>
                    )}
                    {previewMode === 'local' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleGenerateLocalPdf()}
                            disabled={isGeneratingLocalPdf}
                        >
                            Refresh
                        </Button>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-auto bg-white">
                {previewMode === 'html' ? (
                    htmlContent ? (
                        <iframe
                            title="Preview"
                            srcDoc={htmlContent}
                            className="w-full h-full border-0"
                            sandbox="allow-scripts"
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-muted-foreground">Enter HTML to see preview</p>
                        </div>
                    )
                ) : previewMode === 'pdf' ? (
                    <div className="flex items-center justify-center h-full">
                        {isGeneratingPdf ? (
                            <p className="text-muted-foreground">Generating PDF...</p>
                        ) : pdfError ? (
                            <p className="text-destructive">{pdfError}</p>
                        ) : pdfUrl ? (
                            <iframe
                                title="PDF Preview"
                                src={pdfUrl}
                                className="w-full h-full border-0"
                            />
                        ) : (
                            <p className="text-muted-foreground">Click PDF to generate preview</p>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        {isGeneratingLocalPdf ? (
                            <p className="text-muted-foreground">Generating Local preview...</p>
                        ) : localPdfError ? (
                            <p className="text-destructive">{localPdfError}</p>
                        ) : localPdfUrl ? (
                            <iframe
                                title="Local PDF Preview"
                                src={localPdfUrl}
                                className="w-full h-full border-0"
                            />
                        ) : (
                            <p className="text-muted-foreground">Click Local to generate preview</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
