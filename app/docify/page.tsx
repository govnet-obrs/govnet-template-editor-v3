'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Plus, ChevronLeft } from 'lucide-react'
import { useEditorStorage } from '@/hooks/useEditorStorage'
import { toast } from 'sonner'
import type { EditorConfig } from '@/lib/editor-types'
import type { ManifestAsset } from '@/lib/docify-global-assets'

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

interface TemplatesResponse {
  data?: PdfTemplate[]
}

interface GlobalAssetsManifestResponse {
  version: string
  assets: Array<ManifestAsset & { url: string }>
}

type AssetSyncStatus = 'idle' | 'syncing' | 'saved' | 'error'

const ITEMS_PER_PAGE_OPTIONS = [24, 48, 96, 192]

export default function DocifyPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editorId = searchParams.get('editorId')
  const { getEditor, isLoaded } = useEditorStorage()

  const [editor, setEditor] = useState<EditorConfig | null>(null)
  const [templates, setTemplates] = useState<PdfTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<PdfTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE_OPTIONS[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'templates' | 'global-assets'>('templates')
  const [manifestAssets, setManifestAssets] = useState<
    Array<ManifestAsset & { url: string }>
  >([])
  const [isLoadingManifestAssets, setIsLoadingManifestAssets] = useState(false)
  const [manifestAssetsError, setManifestAssetsError] = useState<string | null>(null)
  const [assetTypeFilter, setAssetTypeFilter] = useState<'all' | 'css' | 'js' | 'binary'>('all')
  const [selectedCssAssetSrc, setSelectedCssAssetSrc] = useState('')
  const [selectedJsAssetSrc, setSelectedJsAssetSrc] = useState('')
  const [cssEditorContent, setCssEditorContent] = useState('')
  const [jsEditorContent, setJsEditorContent] = useState('')
  const [cssAutoSync, setCssAutoSync] = useState(false)
  const [jsAutoSync, setJsAutoSync] = useState(false)
  const [cssSyncStatus, setCssSyncStatus] = useState<AssetSyncStatus>('idle')
  const [jsSyncStatus, setJsSyncStatus] = useState<AssetSyncStatus>('idle')
  const [cssSyncMessage, setCssSyncMessage] = useState('')
  const [jsSyncMessage, setJsSyncMessage] = useState('')
  const [cssDirty, setCssDirty] = useState(false)
  const [jsDirty, setJsDirty] = useState(false)

  useEffect(() => {
    if (isLoaded && editorId) {
      const editorConfig = getEditor(editorId)
      if (editorConfig) {
        setEditor(editorConfig)
      } else {
        setError('Editor not found. Please select a valid editor.')
        setLoading(false)
      }
    } else if (isLoaded && !editorId) {
      setError('No editor ID provided. Please select an editor from the home page.')
      setLoading(false)
    }
  }, [isLoaded, editorId, getEditor])

  useEffect(() => {
    const fetchManifestAssets = async () => {
      setIsLoadingManifestAssets(true)
      setManifestAssetsError(null)
      try {
        const response = await fetch('/api/global-assets/manifest', {
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error('Failed to load global assets manifest')
        }
        const payload = (await response.json()) as GlobalAssetsManifestResponse
        setManifestAssets(payload.assets || [])
      } catch (err) {
        setManifestAssetsError(
          err instanceof Error ? err.message : 'Failed to load global assets manifest'
        )
        setManifestAssets([])
      } finally {
        setIsLoadingManifestAssets(false)
      }
    }

    fetchManifestAssets()
  }, [])

  const cssAssets = manifestAssets.filter((asset) => asset.type === 'css')
  const jsAssets = manifestAssets.filter((asset) => asset.type === 'js')

  useEffect(() => {
    if (!selectedCssAssetSrc && cssAssets.length > 0) {
      setSelectedCssAssetSrc(cssAssets[0].src)
    }
  }, [cssAssets, selectedCssAssetSrc])

  useEffect(() => {
    if (!selectedJsAssetSrc && jsAssets.length > 0) {
      setSelectedJsAssetSrc(jsAssets[0].src)
    }
  }, [jsAssets, selectedJsAssetSrc])

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
        if (type === 'css') {
          setCssEditorContent('')
          setCssDirty(false)
        } else {
          setJsEditorContent('')
          setJsDirty(false)
        }
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
          setCssSyncStatus('idle')
          setCssSyncMessage('')
        } else {
          setJsEditorContent(content)
          setJsDirty(false)
          setJsSyncStatus('idle')
          setJsSyncMessage('')
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
      loadAssetEditorContent(selectedCssAssetSrc, 'css')
    }
  }, [selectedCssAssetSrc, loadAssetEditorContent])

  useEffect(() => {
    if (selectedJsAssetSrc) {
      loadAssetEditorContent(selectedJsAssetSrc, 'js')
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
          body: JSON.stringify({
            src: selectedSrc,
            type,
            content,
          }),
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

  const buildAuthHeaders = useCallback(
    (editorConfig: EditorConfig, includeJson: boolean = true): HeadersInit => {
      const headers: HeadersInit = {}

      if (includeJson) {
        headers['Content-Type'] = 'application/json'
      }

      if (
        editorConfig.syncMode === 'online' &&
        editorConfig.credentials.length > 0
      ) {
        if (editorConfig.credentialsType === 'header') {
          editorConfig.credentials.forEach((cred) => {
            if (cred.key && cred.value) {
              headers[cred.key] = cred.value
            }
          })
        }
      }

      return headers
    },
    []
  )

  const appendQueryCredentials = (
    url: string,
    editorConfig: EditorConfig
  ): string => {
    if (
      editorConfig.syncMode === 'online' &&
      editorConfig.credentialsType === 'query'
    ) {
      const pairs = editorConfig.credentials
        .filter((cred) => cred.key && cred.value)
        .map(
          (cred) =>
            `${encodeURIComponent(cred.key)}=${encodeURIComponent(cred.value)}`
        )

      if (pairs.length > 0) {
        const separator = url.includes('?') ? '&' : '?'
        return `${url}${separator}${pairs.join('&')}`
      }
    }

    return url
  }

  const buildUrl = useCallback(
    (baseUrl: string, editorConfig: EditorConfig): string => {
      let url = `${baseUrl}/templates`

      return appendQueryCredentials(url, editorConfig)
    },
    []
  )

  const buildDocumentGeneratorUrl = useCallback(
    (baseUrl: string, editorConfig: EditorConfig): string => {
      const url = `${baseUrl}templates`
      return appendQueryCredentials(url, editorConfig)
    },
    []
  )

  const fetchTemplates = useCallback(
    async (editorConfig: EditorConfig) => {
      if (!editorConfig.apiUrl) {
        setError('API URL not configured for this editor.')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const headers = buildAuthHeaders(editorConfig)
        const url = buildUrl(editorConfig.apiUrl, editorConfig)

        const response = await fetch(url, { headers })

        if (!response.ok) {
          throw new Error('Failed to fetch templates')
        }

        const data: TemplatesResponse = await response.json()
        setTemplates(data.data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
        setTemplates([])
      } finally {
        setLoading(false)
      }
    },
    [buildAuthHeaders, buildUrl]
  )

  useEffect(() => {
    if (editor) {
      fetchTemplates(editor)
    }
  }, [editor, fetchTemplates])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTemplates(templates)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredTemplates(
        templates.filter((template) =>
          [
            template.name,
            template.refNumber,
            template.fileName,
            template.folderName,
            template.sampleJsonData,
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(query))
        )
      )
    }
  }, [searchQuery, templates])

  useEffect(() => {
    const nextTotalPages = Math.max(
      1,
      Math.ceil(filteredTemplates.length / itemsPerPage)
    )
    setTotalPages(nextTotalPages)
    setCurrentPage((prev) => Math.min(prev, nextTotalPages))
  }, [filteredTemplates, itemsPerPage])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, itemsPerPage])

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
  }

  const handleTemplateClick = (template: PdfTemplate, editorId: string) => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
    const data = {
      expiry,
      template,
      type: 'docify',
      lastOpened: Date.now(),
      editorId: editorId || '',
    }
    localStorage.setItem(`template-${template.id}`, JSON.stringify(data))
    router.push(`/docify/editor?editorId=${editorId || ''}&templateId=${template.id}`)
  }

  const toggleTemplateSelection = (templateId: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    )
  }

  const handleTemplateCardClick = (template: PdfTemplate) => {
    if (selectedTemplateIds.length > 0) {
      toggleTemplateSelection(template.id)
      return
    }

    handleTemplateClick(template, editorId || '')
  }

  const handleMoveTemplates = () => {
    if (!editorId) {
      toast.error('No editor selected')
      return
    }

    if (selectedTemplateIds.length === 0) {
      toast.info('No templates selected')
      return
    }

    // Save selected templates to localStorage before navigating
    selectedTemplateIds.forEach((templateId) => {
      const template = templates.find((t) => t.id === templateId)
      if (template) {
        const expiry = Date.now() + 24 * 60 * 60 * 1000
        const data = {
          expiry,
          template,
          type: 'docify',
          lastOpened: Date.now(),
          editorId: editorId,
        }
        localStorage.setItem(`template-${templateId}`, JSON.stringify(data))
      }
    })

    // Navigate to wizard
    router.push(
      `/docify/move?sourceEditorId=${editorId}&templateIds=${selectedTemplateIds.join(',')}`
    )
  }

  const handleCreateTemplate = async () => {
    if (!editor) {
      setCreateError('Editor not loaded yet.')
      return
    }

    if (!createName.trim()) {
      setCreateError('Template name is required.')
      return
    }

    try {
      setIsCreating(true)
      setCreateError(null)

      const sampleHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Sample Template</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      p { margin: 0 0 8px; }
    </style>
  </head>
  <body>
    <h1>Sample PDF Template</h1>
    <p>This is a placeholder HTML file for a new PDF template.</p>
    <p>Replace this content with your actual template markup.</p>
  </body>
</html>
`

      const file = new File([sampleHtml], 'sample-template.html', {
        type: 'text/html',
      })

      const formData = new FormData()
      formData.append('name', createName.trim())
      formData.append('file', file)
      formData.append('folderName', '')
      formData.append('tags', JSON.stringify([]))
      formData.append(
        'pageSettings',
        JSON.stringify({
          pageSize: 'A4',
          orientation: 'portrait',
          marginTop: 15,
          marginBottom: 15,
          marginLeft: 15,
          marginRight: 15,
        })
      )
      formData.append('sampleJsonData', JSON.stringify({}))

      const headers = buildAuthHeaders(editor, false)
      const url = buildDocumentGeneratorUrl(editor.apiUrl, editor)

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Failed to create template')
      }

      setIsCreateOpen(false)
      setCreateName('')
      await fetchTemplates(editor)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsCreating(false)
    }
  }

  const truncateContent = (content: string, length: number = 100) => {
    if (content.length <= length) return content
    return content.substring(0, length) + '...'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTemplateTitle = (template: PdfTemplate): string => {
    const title = template.name || template.fileName || 'Untitled'
    return title.split('_').join(' ') ;
  }

  const getTemplateContent = (template: PdfTemplate): string => {
    return template.sampleJsonData || ''
  }

  const getTemplatePageSettings = (template: PdfTemplate): string => {
    const pageSize = template.pageSettings?.pageSize
    const orientation = template.pageSettings?.orientation
    if (pageSize && orientation) {
      return `${pageSize} • ${orientation}`
    }
    return pageSize || orientation || ''
  }

  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const getPaginationRange = () => {
    const maxPagesToShow = 5
    let start = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2))
    let end = start + maxPagesToShow - 1

    if (end > totalPages) {
      end = totalPages
      start = Math.max(1, end - maxPagesToShow + 1)
    }

    return { start, end }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <Link href="/" className="flex gap-2 items-center text-sm">
            <ChevronLeft className="h-4 w-4" />
            Back to editors
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">PDF Management</h1>
          <p className="mt-2 text-muted-foreground">
            Manage your PDF document templates and global assets
          </p>
        </div>

        {/* Tabs Section */}
        <div className="mb-6 flex items-center gap-3 border-b border-border pb-4">
          <Button
            variant={activeTab === 'templates' ? 'default' : 'ghost'}
            className="gap-2"
            onClick={() => setActiveTab('templates')}
          >
            📋 Templates
          </Button>
          <Button
            variant={activeTab === 'global-assets' ? 'default' : 'ghost'}
            className="gap-2"
            onClick={() => setActiveTab('global-assets')}
          >
            🌐 Global Assets
          </Button>
        </div>

        {/* PDF Templates Section */}
        {activeTab === 'templates' && (
        <div className="mb-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">PDF Templates</h2>
              <p className="text-sm text-muted-foreground">
                Create and manage your PDF document templates
              </p>
            </div>
            <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New PDF Template
            </Button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search PDF templates..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full max-w-sm rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Error State */}
          {error && (
            <Card className="border-destructive/50 bg-destructive/5 mb-6">
              <CardContent className="pt-6">
                <p className="text-sm text-destructive">{error}</p>
              </CardContent>
            </Card>
          )}

          {/* Loading State */}
          {loading && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">
                  Loading templates...
                </p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!loading && filteredTemplates.length === 0 && !error && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-sm text-muted-foreground">
                  {searchQuery
                    ? 'No templates match your search. Try a different query.'
                    : 'No templates found. Create your first PDF template to get started.'}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Templates Grid */}
          {!loading && filteredTemplates.length > 0 && (
            <>
              <div className="flex items-center justify-between border-t border-border pt-6 mb-6">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-muted-foreground">
                    Items per page
                  </label>
                  <select
                    className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                    value={itemsPerPage}
                    onChange={(event) => setItemsPerPage(Number(event.target.value))}
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handlePreviousPage()
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>

                    {getPaginationRange().start > 1 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              setCurrentPage(1)
                            }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      </>
                    )}

                    {Array.from(
                      { length: getPaginationRange().end - getPaginationRange().start + 1 },
                      (_, index) => getPaginationRange().start + index
                    ).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
                          onClick={(event) => {
                            event.preventDefault()
                            setCurrentPage(page)
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {getPaginationRange().end < totalPages && (
                      <>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              setCurrentPage(totalPages)
                            }}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handleNextPage()
                        }}
                        className={
                          currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {paginatedTemplates.map((template) => (
                  <Card
                    key={template.id}
                    className="cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-ring/50"
                    onClick={() => handleTemplateCardClick(template)}
                  >
                    <CardHeader>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg truncate wrap-break-word">
                            {getTemplateTitle(template)}
                          </CardTitle>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-primary"
                            checked={selectedTemplateIds.includes(template.id)}
                            onChange={() => toggleTemplateSelection(template.id)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={`Select ${getTemplateTitle(template)}`}
                          />
                        </div>
                        <CardDescription className="text-xs">
                          {formatDate(template.createdAt)}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Content Preview */}
                      <div className="rounded-sm bg-muted/30 p-3 font-mono text-xs text-muted-foreground max-h-24 overflow-hidden">
                        <code>{truncateContent(getTemplateContent(template))}</code>
                      </div>

                      {/* Stats */}
                      <div className="flex flex-wrap gap-2">
                        {template.refNumber && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          >
                            {template.refNumber}
                          </Badge>
                        )}
                        {getTemplatePageSettings(template) && (
                          <Badge
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400"
                          >
                            {getTemplatePageSettings(template)}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t border-border pt-6">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </div>
                <Pagination className="mx-0 w-auto">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handlePreviousPage()
                        }}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>

                    {getPaginationRange().start > 1 && (
                      <>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              setCurrentPage(1)
                            }}
                          >
                            1
                          </PaginationLink>
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      </>
                    )}

                    {Array.from(
                      { length: getPaginationRange().end - getPaginationRange().start + 1 },
                      (_, index) => getPaginationRange().start + index
                    ).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          isActive={page === currentPage}
                          onClick={(event) => {
                            event.preventDefault()
                            setCurrentPage(page)
                          }}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {getPaginationRange().end < totalPages && (
                      <>
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              setCurrentPage(totalPages)
                            }}
                          >
                            {totalPages}
                          </PaginationLink>
                        </PaginationItem>
                      </>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          handleNextPage()
                        }}
                        className={
                          currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''
                        }
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          )}
        </div>
        )}

        {/* Global Assets Section */}
        {activeTab === 'global-assets' && (
        <div className="mb-8">
          <div className="mb-6">
            <div>
              <h2 className="text-2xl font-bold">Global Assets</h2>
              <p className="text-sm text-muted-foreground">
                Listed from global-assets manifest and loaded through local API routes
              </p>
            </div>
          </div>

          <div className="space-y-4 rounded-md border border-border p-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Filter:</Label>
              <div className="flex flex-wrap gap-2">
                {(['all', 'css', 'js', 'binary'] as const).map((filter) => (
                  <Button
                    key={filter}
                    variant={assetTypeFilter === filter ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAssetTypeFilter(filter)}
                  >
                    {filter === 'all' ? 'All' : filter === 'css' ? 'CSS' : filter === 'js' ? 'JS' : 'Binary'}
                  </Button>
                ))}
              </div>
            </div>

            {manifestAssetsError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-4">
                  <p className="text-sm text-destructive">{manifestAssetsError}</p>
                </CardContent>
              </Card>
            )}

            {isLoadingManifestAssets && (
              <p className="text-sm text-muted-foreground">Loading manifest assets...</p>
            )}

            {!isLoadingManifestAssets &&
              manifestAssets.filter(
                (asset) => assetTypeFilter === 'all' || asset.type === assetTypeFilter
              ).length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No assets found in global-assets manifest for this filter.
                  </p>
                </div>
              )}

            <div className="space-y-2">
              {manifestAssets
                .filter((asset) => assetTypeFilter === 'all' || asset.type === assetTypeFilter)
                .map((asset) => {
                  const canPreviewImage =
                    asset.type === 'binary' &&
                    /\.(png|jpe?g|gif|webp|svg)$/i.test(asset.src)

                  return (
                    <div key={asset.src} className="rounded border border-border px-3 py-3 text-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{asset.name}</p>
                          <p className="text-xs text-muted-foreground">{asset.src}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {asset.type === 'js' ? 'JavaScript' : asset.type === 'css' ? 'CSS' : 'Binary'}
                        </Badge>
                      </div>

                      {asset.description && (
                        <p className="mb-2 text-xs text-muted-foreground">{asset.description}</p>
                      )}

                      {canPreviewImage ? (
                        <img
                          src={asset.url}
                          alt={asset.name}
                          className="max-h-36 rounded border border-border object-contain"
                        />
                      ) : asset.type === 'binary' ? (
                        <p className="text-xs text-muted-foreground">
                          Preview not available for this binary asset type in browser.
                        </p>
                      ) : (
                        <a
                          href={asset.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary underline"
                        >
                          Open file
                        </a>
                      )}
                    </div>
                  )
                })}
            </div>

            <div className="mt-6 grid gap-4 border-t border-border pt-4 lg:grid-cols-2">
              <div className="space-y-3 rounded border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Global CSS Editor</Label>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={cssAutoSync}
                        onChange={(event) => setCssAutoSync(event.target.checked)}
                      />
                      Auto sync
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void syncAssetContent('css')}
                      disabled={!selectedCssAssetSrc || cssSyncStatus === 'syncing'}
                    >
                      {cssSyncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                    </Button>
                  </div>
                </div>

                <Select
                  value={selectedCssAssetSrc}
                  onValueChange={(value) => setSelectedCssAssetSrc(value || '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select CSS asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {cssAssets.map((asset) => (
                      <SelectItem key={asset.src} value={asset.src}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  value={cssEditorContent}
                  onChange={(event) => {
                    setCssEditorContent(event.target.value)
                    setCssDirty(true)
                    if (cssSyncStatus !== 'syncing') {
                      setCssSyncStatus('idle')
                      setCssSyncMessage('')
                    }
                  }}
                  className="min-h-56 font-mono text-xs"
                  placeholder="CSS asset content"
                />
                {cssSyncMessage && (
                  <p
                    className={`text-xs ${
                      cssSyncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {cssSyncMessage}
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Global JavaScript Editor</Label>
                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={jsAutoSync}
                        onChange={(event) => setJsAutoSync(event.target.checked)}
                      />
                      Auto sync
                    </label>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void syncAssetContent('js')}
                      disabled={!selectedJsAssetSrc || jsSyncStatus === 'syncing'}
                    >
                      {jsSyncStatus === 'syncing' ? 'Syncing...' : 'Sync'}
                    </Button>
                  </div>
                </div>

                <Select
                  value={selectedJsAssetSrc}
                  onValueChange={(value) => setSelectedJsAssetSrc(value || '')}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select JavaScript asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {jsAssets.map((asset) => (
                      <SelectItem key={asset.src} value={asset.src}>
                        {asset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Textarea
                  value={jsEditorContent}
                  onChange={(event) => {
                    setJsEditorContent(event.target.value)
                    setJsDirty(true)
                    if (jsSyncStatus !== 'syncing') {
                      setJsSyncStatus('idle')
                      setJsSyncMessage('')
                    }
                  }}
                  className="min-h-56 font-mono text-xs"
                  placeholder="JavaScript asset content"
                />
                {jsSyncMessage && (
                  <p
                    className={`text-xs ${
                      jsSyncStatus === 'error' ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    {jsSyncMessage}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
        )}

      {selectedTemplateIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border border-border bg-background p-3 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {selectedTemplateIds.length} selected
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setSelectedTemplateIds([])}>
                Clear
              </Button>
              <Button onClick={handleMoveTemplates}>Move</Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Create New PDF Template
            </DialogTitle>
            <DialogDescription>
              Enter a name for your new PDF template to get started.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., MY_NEW_INVOICE"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              This will be used as the template name (all caps, alphanumeric, or
              underscores).
            </p>
          </div>

          {createError && (
            <p className="text-xs text-destructive">{createError}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTemplate}
              disabled={!editor || isCreating}
              className="gap-2"
            >
              {isCreating ? 'Creating...' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </main>
  )
}
