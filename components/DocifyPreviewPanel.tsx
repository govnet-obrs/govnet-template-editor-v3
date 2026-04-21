"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import type { PageSettings } from '@/components/SettingsEditor'

interface DocifyPreviewPanelProps {
    htmlContent: string
    pageSettings: PageSettings
    previewMode: 'html' | 'pdf'
    onPreviewModeChange: (mode: 'html' | 'pdf') => void
    apiUrl: string
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
    templateName,
    description,
    sampleData,
}: DocifyPreviewPanelProps) {
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)
    const [pdfError, setPdfError] = useState<string | null>(null)
    const [isGenerating, setIsGenerating] = useState(false)
    const lastPdfUrlRef = useRef<string | null>(null)

    const revokePdfUrl = useCallback((url: string | null) => {
        if (url) {
            URL.revokeObjectURL(url)
        }
    }, [])

    const handleGeneratePdf = useCallback(async () => {
        if (isGenerating) return
        if (!apiUrl) {
            setPdfError('Missing document generator API URL')
            return
        }
        if (!htmlContent?.trim()) {
            setPdfError('Missing template HTML content')
            return
        }

        let dataPayload: unknown = {}
        if (sampleData?.trim()) {
            try {
                dataPayload = JSON.parse(sampleData)
            } catch (err) {
                setPdfError('Sample JSON is invalid')
                return
            }
        }

        setIsGenerating(true)
        setPdfError(null)

        try {
            const token =
                process.env.NEXT_PUBLIC_DOCUMENT_GENERATOR_API_TOKEN ||
                process.env.DOCUMENT_GENERATOR_API_TOKEN ||
                ''

            const response = await fetch(`${apiUrl}/documents/preview-document`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    templateName,
                    description,
                    data: dataPayload,
                    templateContent: htmlContent,
                    pageSettings,
                }),
            })

            if (!response.ok) {
                throw new Error(`Failed to generate PDF (${response.status})`)
            }

            const blob = await response.blob()
            const url = URL.createObjectURL(blob)
            revokePdfUrl(lastPdfUrlRef.current)
            lastPdfUrlRef.current = url
            setPdfUrl(url)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to generate PDF'
            setPdfError(message)
        } finally {
            setIsGenerating(false)
        }
    }, [apiUrl, templateName, description, sampleData, htmlContent, pageSettings, isGenerating, revokePdfUrl])

    useEffect(() => {
        return () => {
            revokePdfUrl(lastPdfUrlRef.current)
            lastPdfUrlRef.current = null
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
                    {previewMode === 'pdf' && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleGeneratePdf()}
                            disabled={isGenerating}
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
                ) : (
                    <div className="flex items-center justify-center h-full">
                        {isGenerating ? (
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
                )}
            </div>
        </div>
    )
}
