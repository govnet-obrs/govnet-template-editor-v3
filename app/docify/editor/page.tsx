'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useEditorStorage } from '@/hooks/useEditorStorage'
import { useTemplateSync } from '@/hooks/useTemplateSync'
import { DocifyEditorHeader } from '../../../components/DocifyEditorHeader'
import { DocifyEditorTabs } from '@/components/DocifyEditorTabs'
import { extractGoTemplateVariables, mergeVariablesWithJson } from '@/lib/extract-template-variables'
import { updateDocifyTemplate, updateDocifyTemplateVariable } from '@/lib/editor-api'
import { decodeBase64Utf8 } from '@/lib/base64'
import { toast } from 'sonner'
import type { EditorConfig } from '@/lib/editor-types'
import type { PageSettings } from '@/components/SettingsEditor'

interface PdfTemplate {
    id: string
    name: string
    refNumber?: string
    fileName?: string
    folderName?: string
    sampleJsonData?: string
    pageSettings?: {
        pageSize?: string
        orientation?: string
        marginLeft?: number
        marginRight?: number
        marginTop?: number
        marginBottom?: number
    }
    createdAt: string
    updatedAt?: string
    deletedAt?: string | null
}

export default function DocifyEditorPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const editorId = searchParams.get('editorId')
    const templateId = searchParams.get('templateId')
    const currentEditor = searchParams.get('editor') || 'code'

    const { getEditor, isLoaded: editorStorageLoaded } = useEditorStorage()
    const { syncStatus, triggerSync, autoSyncEnabled, setAutoSyncEnabled } = useTemplateSync(editorId || undefined)

    const [editor, setEditor] = useState<EditorConfig | null>(null)
    const [template, setTemplate] = useState<PdfTemplate | null>(null)
    const [initialHtmlContent, setInitialHtmlContent] = useState('')
    const [htmlContent, setHtmlContent] = useState('')
    const [variablesContent, setVariablesContent] = useState('{}')
    const [pageSettings, setPageSettings] = useState<PageSettings>({})
    const [isLoadingTemplate, setIsLoadingTemplate] = useState(true)
    const [isLoadingHtml, setIsLoadingHtml] = useState(false)
    const [previewMode, setPreviewMode] = useState<'html' | 'pdf' | 'local'>('html')
    const [zoom] = useState(100)

    // Load editor configuration from storage
    useEffect(() => {
        if (editorStorageLoaded && editorId) {
            const editorConfig = getEditor(editorId)
            if (editorConfig) {
                setEditor(editorConfig)
            }
        }
    }, [editorStorageLoaded, editorId, getEditor])

    // Load template from localStorage
    useEffect(() => {
        if (!templateId) {
            setIsLoadingTemplate(false)
            return
        }

        const storedData = localStorage.getItem(`template-${templateId}`)
        if (storedData) {
            try {
                const { expiry, template: storedTemplate } = JSON.parse(storedData)

            
                // Check if expired
                if (expiry && Date.now() > expiry) {
                    storedTemplate.htmlContent = '' // Clear HTML content for expired templates
                    setIsLoadingTemplate(false)
                    return
                }

                setTemplate(storedTemplate)
                setInitialHtmlContent(storedTemplate.htmlContent || '')
                setVariablesContent(storedTemplate.sampleJsonData || '{}')
                setPageSettings(storedTemplate.pageSettings || {})
                setIsLoadingTemplate(false)
            } catch (err) {
                console.error('Failed to parse stored template:', err)
                setIsLoadingTemplate(false)
            }
        } else {
            setIsLoadingTemplate(false)
        }
    }, [templateId])

    useEffect(() => {
        if (template) {
            document.title = `${template.name || 'Untitled'} - Docify Editor`
        } else {
            document.title = 'Docify Editor'
        }
    }, [template])

    useEffect(() => {
        setHtmlContent(initialHtmlContent)
    }, [initialHtmlContent])

    // Extract variables from HTML content and merge with existing variables
    useEffect(() => {
        if (!initialHtmlContent) {
            return
        }

        const extractedVariables = extractGoTemplateVariables(initialHtmlContent)
        if (extractedVariables.length > 0) {
            setVariablesContent((prevVariables) => {
                return mergeVariablesWithJson(prevVariables, extractedVariables)
            })
        }
    }, [initialHtmlContent])

    // Fetch HTML content from API if empty
    useEffect(() => {
        if (!template || initialHtmlContent || !editor || !template.refNumber) {
            return
        }

        const fetchHtmlContent = async () => {
            setIsLoadingHtml(true)
            try {
                const headers: HeadersInit = {}
                if (editor.credentialsType === 'header') {
                    editor.credentials.forEach((cred) => {
                        if (cred.key && cred.value) {
                            headers[cred.key] = cred.value
                        }
                    })
                }

                let url = `${editor.apiUrl}/templates/preview/${template.refNumber}`

                if (editor.credentialsType === 'query') {
                    const params = new URLSearchParams()
                    editor.credentials.forEach((cred) => {
                        if (cred.key && cred.value) {
                            params.append(cred.key, cred.value)
                        }
                    })
                    url += `?${params.toString()}`
                }

                const response = await fetch(url, { headers })
                if (response.ok) {
                    const jsonData = await response.json()
                    if (jsonData.data) {
                        const decodedHtml = decodeBase64Utf8(jsonData.data)
                        setInitialHtmlContent(decodedHtml)
                    }
                }
            } catch (err) {
                console.error('Failed to fetch HTML content:', err)
            } finally {
                setIsLoadingHtml(false)
            }
        }

        fetchHtmlContent()
    }, [template, initialHtmlContent, editor])

    const handleBack = () => {
        if (templateId) {
            localStorage.removeItem(`template-${templateId}`)
        }
        router.push(`/docify?editorId=${editorId}`)
    }

    const getTemplateName = (): string => {
        if (!template) return 'Unknown Template'
        return template.name || template.fileName || 'Untitled'
    }

    const handleEditorChange = (value: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('editor', value)
        router.push(`?${params.toString()}`, { scroll: false })
    }

    const handleHtmlChange = useCallback((value: string) => {
        setHtmlContent(value)
    }, [])

    const handleVariablesChange = useCallback((value: string) => {
        setVariablesContent(value)
    }, [])

    const handlePageSettingsChange = useCallback((settings: PageSettings) => {
        setPageSettings(settings)
    }, [])

    const handlePushHtml = useCallback(async () => {
        if (!editor || !template) {
            toast.error('Editor or template not ready')
            return
        }

        try {
            await updateDocifyTemplate(
                {
                    templateId: template.id,
                    data: {
                        ...template,
                        htmlContent,
                    },
                },
                editor
            )
            toast.success('HTML pushed successfully')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to push HTML'
            toast.error(message)
        }
    }, [editor, template, htmlContent])

    const handleSyncMetadata = useCallback(async () => {
        if (!editor || !template) {
            toast.error('Editor or template not ready')
            return
        }

        try {
            await updateDocifyTemplateVariable(
                {
                    templateId: template.id,
                    data: {
                        ...template,
                        sampleJsonData: variablesContent,
                    },
                },
                editor
            )
            toast.success('Metadata synced successfully')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to sync metadata'
            toast.error(message)
        }
    }, [editor, template, variablesContent])

    // Sync HTML content to localStorage
    useEffect(() => {
        if (!template || !templateId || isLoadingTemplate || isLoadingHtml) {
            return
        }

        console.log('Syncing HTML content to localStorage for template:', templateId)
        const storedData = localStorage.getItem(`template-${templateId}`)
        if (storedData) {
            try {
                const { expiry, template: storedTemplate, ...rest } = JSON.parse(storedData)
                const updatedData = {
                    ...rest,
                    expiry,
                    template: {
                        ...storedTemplate,
                        htmlContent: htmlContent,
                        sampleJsonData: variablesContent,
                        pageSettings,
                    },
                }
                console.log('Updated template data to be stored:', updatedData)
                localStorage.setItem(`template-${templateId}`, JSON.stringify(updatedData))
            } catch (err) {
                console.error('Failed to sync HTML to localStorage:', err)
            }
        }
    }, [htmlContent, variablesContent, pageSettings, templateId, template, isLoadingTemplate, isLoadingHtml])

    // Sync variables content to localStorage
    useEffect(() => {
        if (!template || !templateId || isLoadingTemplate) {
            return
        }

        const storedData = localStorage.getItem(`template-${templateId}`)
        if (storedData) {
            try {
                const { expiry, template: storedTemplate, ...rest } = JSON.parse(storedData)
                const updatedData = {
                    ...rest,
                    expiry,
                    template: {
                        ...storedTemplate,
                        sampleJsonData: variablesContent,
                    },
                }
                localStorage.setItem(`template-${templateId}`, JSON.stringify(updatedData))
            } catch (err) {
                console.error('Failed to sync variables to localStorage:', err)
            }
        }
    }, [variablesContent, templateId, template, isLoadingTemplate])

    if (isLoadingTemplate || isLoadingHtml) {
        return (
            <main className="min-h-screen bg-background">
                <div className="mx-auto max-w-7xl px-4 py-8">
                    <p className="text-muted-foreground">Loading template...</p>
                </div>
            </main>
        )
    }

    if (!template) {
        return (
            <main className="min-h-screen bg-background">
                <div className="mx-auto max-w-7xl px-4 py-8">
                    <p className="text-destructive">Template not found. Please select a template from the list.</p>
                    <Button onClick={handleBack} className="mt-4">
                        Back to Templates
                    </Button>
                </div>
            </main>
        )
    }

    return (
        <main className="min-h-screen bg-background flex flex-col">
            <DocifyEditorHeader
                templateName={getTemplateName()}
                refNumber={template.refNumber}
                onBack={handleBack}
                syncStatus={syncStatus}
                onSync={() => triggerSync({ source: 'manual' })}
                autoSyncEnabled={autoSyncEnabled}
                onAutoSyncToggle={() => setAutoSyncEnabled(!autoSyncEnabled)}
            />

            <div className="flex-1 flex overflow-hidden">
                <DocifyEditorTabs
                    currentEditor={currentEditor}
                    htmlContent={htmlContent}
                    variablesContent={variablesContent}
                    pageSettings={pageSettings}
                    previewMode={previewMode}
                    zoom={zoom}
                    apiUrl={editor?.apiUrl || ''}
                    localPreviewUrl={editor?.localPreviewUrl || ''}
                    sampleData={variablesContent}
                    onPushHtml={handlePushHtml}
                    onSyncMetadata={handleSyncMetadata}
                    onPageSettingsChange={handlePageSettingsChange}
                    onEditorChange={handleEditorChange}
                    onHtmlChange={handleHtmlChange}
                    onVariablesChange={handleVariablesChange}
                    onPreviewModeChange={setPreviewMode}
                />
            </div>
        </main>
    )
}
