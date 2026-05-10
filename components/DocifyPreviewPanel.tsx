"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import type { PageSettings } from '@/components/SettingsEditor'
import { injectGlobalAssetsIntoHtml } from '@/lib/docify-global-assets'

interface DocifyPreviewPanelProps {
    htmlContent: string
    globalCssContent: string
    globalCssAssetNames: string[]
    globalJsContent: string
    globalJsAssetNames: string[]
    pageSettings: PageSettings
    previewMode: 'html' | 'pdf' | 'local'
    onPreviewModeChange: (mode: 'html' | 'pdf' | 'local') => void
    apiUrl: string
    localPreviewUrl: string
    previewEndpoints: string[]
    selectedPreviewEndpoint: string
    onPreviewEndpointChange: (endpoint: string) => void
    templateName: string
    description: string
    sampleData: string
}

export function DocifyPreviewPanel({
    htmlContent,
    globalCssContent,
    globalCssAssetNames,
    globalJsContent,
    globalJsAssetNames,
    pageSettings,
    previewMode,
    onPreviewModeChange,
    apiUrl,
    localPreviewUrl,
    previewEndpoints,
    selectedPreviewEndpoint,
    onPreviewEndpointChange,
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
    const isGeneratingRef = useRef({ pdf: false, local: false })
    const hasLocalPreview = Boolean(localPreviewUrl?.trim())
    const htmlPreviewContent = injectGlobalAssetsIntoHtml(
        htmlContent,
        globalCssContent,
        globalJsContent,
        globalCssAssetNames,
        globalJsAssetNames
    )

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

    const generatePdfForMode = useCallback(async (mode: 'pdf' | 'local', endpointOverride?: string) => {
        if (mode === 'pdf' && isGeneratingRef.current.pdf) return
        if (mode === 'local' && isGeneratingRef.current.local) return

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
            isGeneratingRef.current.pdf = true
            setIsGeneratingPdf(true)
            setPdfError(null)
        } else {
            isGeneratingRef.current.local = true
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
                    templateContent: injectGlobalAssetsIntoHtml(
                        htmlContent,
                        globalCssContent,
                        globalJsContent,
                        globalCssAssetNames,
                        globalJsAssetNames
                    ),
                    pageSettings,
                }
                : {
                    html: injectGlobalAssetsIntoHtml(
                        htmlContent,
                        globalCssContent,
                        globalJsContent,
                        globalCssAssetNames,
                        globalJsAssetNames
                    ),
                    sampleData: dataPayload,
                    pageSettings,
                }

            const response = await fetch(`${targetApiUrl}${mode === 'pdf' ? (endpointOverride ?? selectedPreviewEndpoint) : '/documents/preview-document'}`, {
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
                isGeneratingRef.current.pdf = false
                setIsGeneratingPdf(false)
            } else {
                isGeneratingRef.current.local = false
                setIsGeneratingLocalPdf(false)
            }
        }
    }, [apiUrl, localPreviewUrl, selectedPreviewEndpoint, templateName, description, htmlContent, globalCssContent, globalCssAssetNames, globalJsContent, globalJsAssetNames, pageSettings, parseSampleData, getResponseError, revokePdfUrl])

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
                        <>
                            {previewEndpoints.length > 1 && (
                                <Select
                                    value={selectedPreviewEndpoint}
                                    onValueChange={(endpoint) => {
                                        if (!endpoint) return
                                        onPreviewEndpointChange(endpoint)
                                        void generatePdfForMode('pdf', endpoint)
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-xs w-28">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {previewEndpoints.map((ep, i) => (
                                            <SelectItem key={ep} value={ep}>
                                                v{i + 1}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleGeneratePdf()}
                                disabled={isGeneratingPdf}
                            >
                                Refresh
                            </Button>
                        </>
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
                    htmlPreviewContent ? (
                        <iframe
                            title="Preview"
                            srcDoc={htmlPreviewContent}
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
