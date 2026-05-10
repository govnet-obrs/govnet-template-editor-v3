'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { useTheme } from 'next-themes'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useEditorStorage } from '@/hooks/useEditorStorage'
import { useTemplateSync } from '@/hooks/useTemplateSync'
import { DocifyEditorHeader } from '../../../components/DocifyEditorHeader'
import { DocifyEditorTabs } from '@/components/DocifyEditorTabs'
import { extractGoTemplateVariables, mergeVariablesWithJson } from '@/lib/extract-template-variables'
import { updateDocifyTemplate, updateDocifyTemplateVariable } from '@/lib/editor-api'
import { decodeBase64Utf8 } from '@/lib/base64'
import {
    buildGlobalAssetApiPath,
    combineGlobalCssAssets,
    combineGlobalJsAssets,
    INJECTED_GLOBAL_CSS_ATTR,
    INJECTED_GLOBAL_JS_ATTR,
    injectGlobalAssetsIntoHtml,
    maskInjectedGlobalAssetsForEditing,
    parseInjectedAssetNamesFromHtml,
    type ManifestAsset,
} from '@/lib/docify-global-assets'
import { toast } from 'sonner'
import type { EditorConfig } from '@/lib/editor-types'
import { DEFAULT_PREVIEW_ENDPOINTS } from '@/lib/editor-types'
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

interface GlobalAssetsManifestResponse {
    version: string
    assets: Array<ManifestAsset & { url: string }>
}

type AssetSyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

const GLOBAL_CSS_AUTO_SYNC_KEY = 'docify-global-css-auto-sync-enabled'
const GLOBAL_JS_AUTO_SYNC_KEY = 'docify-global-js-auto-sync-enabled'

export default function DocifyEditorPage() {
    // Max size for cacheable CSS/JS assets (1MB)
    const MAX_CACHEABLE_ASSET_SIZE = 1024 * 1024

    const router = useRouter()
    const { resolvedTheme } = useTheme()
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
    const [manifestAssets, setManifestAssets] = useState<Array<ManifestAsset & { url: string }>>([])
    const [assetContentBySrc, setAssetContentBySrc] = useState<Record<string, string>>({})
    const [selectedCssAssetSrc, setSelectedCssAssetSrc] = useState('')
    const [selectedJsAssetSrc, setSelectedJsAssetSrc] = useState('')
    const [cssEditorContent, setCssEditorContent] = useState('')
    const [jsEditorContent, setJsEditorContent] = useState('')
    const [cssAutoSync, setCssAutoSync] = useState(true)
    const [jsAutoSync, setJsAutoSync] = useState(true)
    const [cssSyncStatus, setCssSyncStatus] = useState<AssetSyncStatus>('idle')
    const [jsSyncStatus, setJsSyncStatus] = useState<AssetSyncStatus>('idle')
    const [cssSyncMessage, setCssSyncMessage] = useState('')
    const [jsSyncMessage, setJsSyncMessage] = useState('')
    const [cssDirty, setCssDirty] = useState(false)
    const [jsDirty, setJsDirty] = useState(false)
    const [selectedPreviewEndpoint, setSelectedPreviewEndpoint] = useState<string>(
        DEFAULT_PREVIEW_ENDPOINTS[0]
    )

    const templateCssAssetNames = useMemo(
        () => parseInjectedAssetNamesFromHtml(htmlContent || initialHtmlContent, INJECTED_GLOBAL_CSS_ATTR),
        [htmlContent, initialHtmlContent]
    )
    const templateJsAssetNames = useMemo(
        () => parseInjectedAssetNamesFromHtml(htmlContent || initialHtmlContent, INJECTED_GLOBAL_JS_ATTR),
        [htmlContent, initialHtmlContent]
    )
    const normalizedEditorTab = useMemo(() => {
        if (currentEditor === 'global-assets') {
            return 'global-assets-css'
        }
        return currentEditor
    }, [currentEditor])

    const cssAssetsInTemplate = useMemo(
        () =>
            manifestAssets.filter(
                (asset) =>
                    asset.type === 'css' &&
                    templateCssAssetNames.some((name) => name.toLowerCase() === asset.name.toLowerCase())
            ),
        [manifestAssets, templateCssAssetNames]
    )
    const jsAssetsInTemplate = useMemo(
        () =>
            manifestAssets.filter(
                (asset) =>
                    asset.type === 'js' &&
                    templateJsAssetNames.some((name) => name.toLowerCase() === asset.name.toLowerCase())
            ),
        [manifestAssets, templateJsAssetNames]
    )

    const cssAssetsForInjection = useMemo(
        () => cssAssetsInTemplate.filter((asset) => (assetContentBySrc[asset.src] || '').trim().length > 0),
        [cssAssetsInTemplate, assetContentBySrc]
    )

    const jsAssetsForInjection = useMemo(
        () => jsAssetsInTemplate.filter((asset) => (assetContentBySrc[asset.src] || '').trim().length > 0),
        [jsAssetsInTemplate, assetContentBySrc]
    )

    const globalCssContent = useMemo(
        () =>
            combineGlobalCssAssets(
                cssAssetsForInjection.map((asset) => ({
                    src: asset.src,
                    type: 'css' as const,
                    content: assetContentBySrc[asset.src] || '',
                }))
            ),
        [cssAssetsForInjection, assetContentBySrc]
    )

    const globalJsContent = useMemo(
        () =>
            combineGlobalJsAssets(
                jsAssetsForInjection.map((asset) => ({
                    src: asset.src,
                    type: 'js' as const,
                    content: assetContentBySrc[asset.src] || '',
                }))
            ),
        [jsAssetsForInjection, assetContentBySrc]
    )

    const globalCssAssetNames = useMemo(
        () => cssAssetsForInjection.map((asset) => asset.name || asset.src),
        [cssAssetsForInjection]
    )

    const globalJsAssetNames = useMemo(
        () => jsAssetsForInjection.map((asset) => asset.name || asset.src),
        [jsAssetsForInjection]
    )

    const htmlContentWithInjectedGlobalAssets = useMemo(
        () =>
            injectGlobalAssetsIntoHtml(
                htmlContent,
                globalCssContent,
                globalJsContent,
                globalCssAssetNames,
                globalJsAssetNames
            ),
        [htmlContent, globalCssContent, globalJsContent, globalCssAssetNames, globalJsAssetNames]
    )

    useEffect(() => {
        try {
            const storedCssAutoSync = localStorage.getItem(GLOBAL_CSS_AUTO_SYNC_KEY)
            if (storedCssAutoSync !== null) {
                setCssAutoSync(storedCssAutoSync === 'true')
            }

            const storedJsAutoSync = localStorage.getItem(GLOBAL_JS_AUTO_SYNC_KEY)
            if (storedJsAutoSync !== null) {
                setJsAutoSync(storedJsAutoSync === 'true')
            }
        } catch (err) {
            console.error('Failed to load global asset auto-sync preferences:', err)
        }
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(GLOBAL_CSS_AUTO_SYNC_KEY, String(cssAutoSync))
        } catch (err) {
            console.error('Failed to save CSS auto-sync preference:', err)
        }
    }, [cssAutoSync])

    useEffect(() => {
        try {
            localStorage.setItem(GLOBAL_JS_AUTO_SYNC_KEY, String(jsAutoSync))
        } catch (err) {
            console.error('Failed to save JS auto-sync preference:', err)
        }
    }, [jsAutoSync])

    // Load editor configuration from storage
    useEffect(() => {
        if (editorStorageLoaded && editorId) {
            const editorConfig = getEditor(editorId)
            if (editorConfig) {
                setEditor(editorConfig)
                // Reset selected endpoint to first available when editor config loads/changes
                const endpoints = editorConfig.previewEndpoints?.length
                    ? editorConfig.previewEndpoints
                    : DEFAULT_PREVIEW_ENDPOINTS
                setSelectedPreviewEndpoint(endpoints[0])
            }
        }
    }, [editorStorageLoaded, editorId, getEditor])

    // Load global assets (CSS and JS) from local manifest API.
    // Binary assets are never fetched into editor state.
    useEffect(() => {
        const loadAssets = async () => {
            try {
                const manifestResponse = await fetch('/api/global-assets/manifest', {
                    cache: 'no-store',
                })

                if (!manifestResponse.ok) {
                    throw new Error('Failed to load global assets manifest')
                }

                const manifestPayload =
                    (await manifestResponse.json()) as GlobalAssetsManifestResponse
                const manifestAssets = manifestPayload.assets ?? []
                setManifestAssets(manifestAssets)
                const nextAssetContentBySrc: Record<string, string> = {}

                for (const asset of manifestAssets) {
                    if (asset.type !== 'css' && asset.type !== 'js') {
                        continue
                    }

                    const assetUrl = asset.url || buildGlobalAssetApiPath(asset.src)
                    try {
                        const response = await fetch(assetUrl, { cache: 'no-store' })
                        if (!response.ok) {
                            continue
                        }

                        // Avoid loading large CSS/JS assets into memory for preview injection.
                        const contentLength = response.headers.get('content-length')
                        const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0
                        if (fileSizeBytes > 0 && fileSizeBytes > MAX_CACHEABLE_ASSET_SIZE) {
                            console.warn(
                                `Skipping large ${asset.type} asset ${asset.src} (${(
                                    fileSizeBytes /
                                    1024 /
                                    1024
                                ).toFixed(2)}MB)`
                            )
                            continue
                        }

                        const content = await response.text()
                        nextAssetContentBySrc[asset.src] = content
                    } catch (err) {
                        console.error(`Failed to load asset ${asset.src}:`, err)
                    }
                }

                setAssetContentBySrc(nextAssetContentBySrc)
            } catch (err) {
                console.error('Failed to load global assets:', err)
                setAssetContentBySrc({})
            }
        }

        loadAssets()
    }, [MAX_CACHEABLE_ASSET_SIZE])

    useEffect(() => {
        if (!selectedCssAssetSrc && cssAssetsInTemplate.length > 0) {
            setSelectedCssAssetSrc(cssAssetsInTemplate[0].src)
        }
    }, [cssAssetsInTemplate, selectedCssAssetSrc])

    useEffect(() => {
        if (!selectedJsAssetSrc && jsAssetsInTemplate.length > 0) {
            setSelectedJsAssetSrc(jsAssetsInTemplate[0].src)
        }
    }, [jsAssetsInTemplate, selectedJsAssetSrc])

    const loadAssetEditorContent = useCallback(
        async (assetSrc: string, type: 'css' | 'js') => {
            if (!assetSrc) {
                if (type === 'css') {
                    setCssEditorContent('')
                    setCssDirty(false)
                } else {
                    setJsEditorContent('')
                    setJsDirty(false)
                }
                return
            }

            const asset = manifestAssets.find((entry) => entry.src === assetSrc)
            if (!asset || /^https?:\/\//i.test(asset.src)) {
                return
            }

            try {
                const response = await fetch(asset.url, { cache: 'no-store' })
                if (!response.ok) {
                    throw new Error(`Failed to load ${asset.src}`)
                }
                const content = await response.text()
                if (type === 'css') {
                    setCssEditorContent(content)
                    setCssDirty(false)
                } else {
                    setJsEditorContent(content)
                    setJsDirty(false)
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : `Failed to load ${assetSrc}`
                if (type === 'css') {
                    setCssSyncStatus('error')
                    setCssSyncMessage(message)
                } else {
                    setJsSyncStatus('error')
                    setJsSyncMessage(message)
                }
            }
        },
        [manifestAssets]
    )

    useEffect(() => {
        if (selectedCssAssetSrc) {
            void loadAssetEditorContent(selectedCssAssetSrc, 'css')
        }
    }, [selectedCssAssetSrc, loadAssetEditorContent])

    useEffect(() => {
        if (selectedJsAssetSrc) {
            void loadAssetEditorContent(selectedJsAssetSrc, 'js')
        }
    }, [selectedJsAssetSrc, loadAssetEditorContent])

    const syncAssetContent = useCallback(
        async (type: 'css' | 'js') => {
            const selectedSrc = type === 'css' ? selectedCssAssetSrc : selectedJsAssetSrc
            const content = type === 'css' ? cssEditorContent : jsEditorContent

            if (!selectedSrc) {
                return
            }

            if (type === 'css') {
                setCssSyncStatus('syncing')
                setCssSyncMessage('Syncing...')
            } else {
                setJsSyncStatus('syncing')
                setJsSyncMessage('Syncing...')
            }

            try {
                const response = await fetch('/api/global-assets/sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ src: selectedSrc, type, content }),
                })

                if (!response.ok) {
                    const payload = (await response.json()) as { error?: string }
                    throw new Error(payload.error || 'Sync failed')
                }

                if (type === 'css') {
                    setCssSyncStatus('saved')
                    setCssSyncMessage('Synced')
                    setCssDirty(false)
                } else {
                    setJsSyncStatus('saved')
                    setJsSyncMessage('Synced')
                    setJsDirty(false)
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Sync failed'
                if (type === 'css') {
                    setCssSyncStatus('error')
                    setCssSyncMessage(message)
                } else {
                    setJsSyncStatus('error')
                    setJsSyncMessage(message)
                }
            }
        },
        [selectedCssAssetSrc, selectedJsAssetSrc, cssEditorContent, jsEditorContent]
    )

    useEffect(() => {
        if (!cssAutoSync || !cssDirty || !selectedCssAssetSrc) {
            return
        }

        const timeout = setTimeout(() => {
            void syncAssetContent('css')
        }, 800)

        return () => clearTimeout(timeout)
    }, [cssAutoSync, cssDirty, selectedCssAssetSrc, cssEditorContent, syncAssetContent])

    useEffect(() => {
        if (!jsAutoSync || !jsDirty || !selectedJsAssetSrc) {
            return
        }

        const timeout = setTimeout(() => {
            void syncAssetContent('js')
        }, 800)

        return () => clearTimeout(timeout)
    }, [jsAutoSync, jsDirty, selectedJsAssetSrc, jsEditorContent, syncAssetContent])

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
        setHtmlContent(maskInjectedGlobalAssetsForEditing(initialHtmlContent))
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
                        htmlContent: htmlContentWithInjectedGlobalAssets,
                    },
                },
                editor
            )
            toast.success('HTML pushed successfully')
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to push HTML'
            toast.error(message)
        }
    }, [editor, template, htmlContentWithInjectedGlobalAssets])

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
                        htmlContent: htmlContentWithInjectedGlobalAssets,
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
    }, [htmlContentWithInjectedGlobalAssets, variablesContent, pageSettings, templateId, template, isLoadingTemplate, isLoadingHtml])

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

    const editorTheme = resolvedTheme === 'dark' ? 'vs-dark' : 'vs'

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
                    currentEditor={normalizedEditorTab}
                    htmlContent={htmlContent}
                    downloadHtmlContent={htmlContentWithInjectedGlobalAssets}
                    globalCssContent={globalCssContent}
                    globalCssAssetNames={globalCssAssetNames}
                    globalJsContent={globalJsContent}
                    globalJsAssetNames={globalJsAssetNames}
                    variablesContent={variablesContent}
                    pageSettings={pageSettings}
                    previewMode={previewMode}
                    zoom={zoom}
                    apiUrl={editor?.apiUrl || ''}
                    localPreviewUrl={editor?.localPreviewUrl || ''}
                    previewEndpoints={editor?.previewEndpoints?.length ? editor.previewEndpoints : DEFAULT_PREVIEW_ENDPOINTS}
                    selectedPreviewEndpoint={selectedPreviewEndpoint}
                    onPreviewEndpointChange={setSelectedPreviewEndpoint}
                    templateName={getTemplateName()}
                    description={template.fileName || template.name || ''}
                    sampleData={variablesContent}
                    onPushHtml={handlePushHtml}
                    onSyncMetadata={handleSyncMetadata}
                    onPageSettingsChange={handlePageSettingsChange}
                    onEditorChange={handleEditorChange}
                    onHtmlChange={handleHtmlChange}
                    onVariablesChange={handleVariablesChange}
                    onPreviewModeChange={setPreviewMode}
                    globalCssAssetsEditor={
                        <div className="flex h-full flex-col gap-4 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-sm font-medium">Global CSS Editor</Label>
                                <div className="flex items-center gap-2 text-xs">
                                    <label className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={cssAutoSync}
                                            onChange={(event) => setCssAutoSync(event.target.checked)}
                                            disabled={cssAssetsInTemplate.length === 0}
                                        />
                                        Auto sync
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void syncAssetContent('css')}
                                        disabled={
                                            cssAssetsInTemplate.length === 0 ||
                                            !selectedCssAssetSrc ||
                                            cssSyncStatus === 'syncing'
                                        }
                                    >
                                        {cssSyncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                                    </Button>
                                </div>
                            </div>

                            <Select
                                value={selectedCssAssetSrc}
                                onValueChange={(value) => setSelectedCssAssetSrc(value || '')}
                            >
                                <SelectTrigger disabled={cssAssetsInTemplate.length === 0}>
                                    <SelectValue placeholder="Select CSS asset from template attrs" />
                                </SelectTrigger>
                                <SelectContent>
                                    {cssAssetsInTemplate.map((asset) => (
                                        <SelectItem key={asset.src} value={asset.src}>
                                            {asset.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex-1 overflow-hidden rounded border border-border">
                                <Editor
                                    height="100%"
                                    defaultLanguage="css"
                                    language="css"
                                    value={cssEditorContent}
                                    onChange={(value) => {
                                        setCssEditorContent(value || '')
                                        setCssDirty(true)
                                    }}
                                    theme={editorTheme}
                                    options={{
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        fontSize: 13,
                                        lineNumbers: 'on',
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                        readOnly: cssAssetsInTemplate.length === 0 || !selectedCssAssetSrc,
                                    }}
                                />
                            </div>

                            {cssAssetsInTemplate.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    No CSS global assets referenced in template attributes.
                                </p>
                            ) : (
                                cssSyncMessage && (
                                    <p
                                        className={`text-xs ${
                                            cssSyncStatus === 'error'
                                                ? 'text-destructive'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        {cssSyncMessage}
                                    </p>
                                )
                            )}
                        </div>
                    }
                    globalJsAssetsEditor={
                        <div className="flex h-full flex-col gap-4 p-4">
                            <div className="flex items-center justify-between gap-2">
                                <Label className="text-sm font-medium">Global JavaScript Editor</Label>
                                <div className="flex items-center gap-2 text-xs">
                                    <label className="flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={jsAutoSync}
                                            onChange={(event) => setJsAutoSync(event.target.checked)}
                                            disabled={jsAssetsInTemplate.length === 0}
                                        />
                                        Auto sync
                                    </label>
                                    <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => void syncAssetContent('js')}
                                        disabled={
                                            jsAssetsInTemplate.length === 0 ||
                                            !selectedJsAssetSrc ||
                                            jsSyncStatus === 'syncing'
                                        }
                                    >
                                        {jsSyncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                                    </Button>
                                </div>
                            </div>

                            <Select
                                value={selectedJsAssetSrc}
                                onValueChange={(value) => setSelectedJsAssetSrc(value || '')}
                            >
                                <SelectTrigger disabled={jsAssetsInTemplate.length === 0}>
                                    <SelectValue placeholder="Select JavaScript asset from template attrs" />
                                </SelectTrigger>
                                <SelectContent>
                                    {jsAssetsInTemplate.map((asset) => (
                                        <SelectItem key={asset.src} value={asset.src}>
                                            {asset.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <div className="flex-1 overflow-hidden rounded border border-border">
                                <Editor
                                    height="100%"
                                    defaultLanguage="javascript"
                                    language="javascript"
                                    value={jsEditorContent}
                                    onChange={(value) => {
                                        setJsEditorContent(value || '')
                                        setJsDirty(true)
                                    }}
                                    theme={editorTheme}
                                    options={{
                                        minimap: { enabled: false },
                                        scrollBeyondLastLine: false,
                                        fontSize: 13,
                                        lineNumbers: 'on',
                                        wordWrap: 'on',
                                        automaticLayout: true,
                                        readOnly: jsAssetsInTemplate.length === 0 || !selectedJsAssetSrc,
                                    }}
                                />
                            </div>

                            {jsAssetsInTemplate.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    No JavaScript global assets referenced in template attributes.
                                </p>
                            ) : (
                                jsSyncMessage && (
                                    <p
                                        className={`text-xs ${
                                            jsSyncStatus === 'error'
                                                ? 'text-destructive'
                                                : 'text-muted-foreground'
                                        }`}
                                    >
                                        {jsSyncMessage}
                                    </p>
                                )
                            )}
                        </div>
                    }
                />
            </div>
        </main>
    )
}
