'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ArrowRight } from 'lucide-react'
import { useEditorStorage } from '@/hooks/useEditorStorage'
import { toast } from 'sonner'
import {
  createDocifyTemplate,
  updateDocifyTemplate,
  updateDocifyTemplateVariable,
} from '@/lib/editor-api'
import { decodeBase64Utf8 } from '@/lib/base64'
import type { EditorConfig } from '@/lib/editor-types'

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

interface TemplateWithHtml extends PdfTemplate {
  htmlContent: string
}

interface LinkEdit {
  original: string
  updated: string
  type: 'img' | 'href'
  templateId: string
  templateName: string
}

type WizardStep = 'select-editor' | 'review-links' | 'summary'

export default function DocifyMovePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sourceEditorId = searchParams.get('sourceEditorId')
  const templateIds = searchParams.get('templateIds')?.split(',') || []

  const { getEditor, editors } = useEditorStorage()

  const [currentStep, setCurrentStep] = useState<WizardStep>('select-editor')
  const [sourceEditor, setSourceEditor] = useState<EditorConfig | null>(null)
  const [targetEditorId, setTargetEditorId] = useState('')
  const [targetEditor, setTargetEditor] = useState<EditorConfig | null>(null)
  const [sourceTemplates, setSourceTemplates] = useState<PdfTemplate[]>([])
  const [sourceTemplatesWithHtml, setSourceTemplatesWithHtml] = useState<TemplateWithHtml[]>([])
  const [targetTemplates, setTargetTemplates] = useState<PdfTemplate[]>([])
  const [linkEdits, setLinkEdits] = useState<LinkEdit[]>([])
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    if (sourceEditorId) {
      const editor = getEditor(sourceEditorId)
      if (editor) {
        setSourceEditor(editor)
      }
    }
  }, [sourceEditorId, getEditor])

  useEffect(() => {
    if (templateIds.length === 0) return

    const templates: PdfTemplate[] = []
    templateIds.forEach((id) => {
      const stored = localStorage.getItem(`template-${id}`)
      if (stored) {
        try {
          const { template } = JSON.parse(stored)
          if (template) {
            templates.push(template)
          }
        } catch (err) {
          console.error(`Failed to load template ${id}:`, err)
        }
      }
    })
    setSourceTemplates(templates)
  }, [templateIds.length])

  const buildAuthHeaders = useCallback(
    (editorConfig: EditorConfig): HeadersInit => {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
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

  const fetchTargetTemplates = async (editor: EditorConfig) => {
    if (!editor.apiUrl) {
      toast.error('Target editor has no API URL')
      return
    }

    setLoading(true)
    try {
      const headers = buildAuthHeaders(editor)
      const url = appendQueryCredentials(`${editor.apiUrl}/templates`, editor)

      const response = await fetch(url, { headers })
      if (!response.ok) {
        throw new Error('Failed to fetch target templates')
      }

      const data = await response.json()
      setTargetTemplates(data.data || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to fetch templates')
      setTargetTemplates([])
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplateHtml = async (template: PdfTemplate, editor: EditorConfig): Promise<string> => {
    if (!editor.apiUrl) return ''

    try {
      const headers = buildAuthHeaders(editor)
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
      if (!response.ok) return ''

      const jsonData = await response.json()
      if (jsonData.data) {
        const decodedHtml = decodeBase64Utf8(jsonData.data)
        return decodedHtml
      }
      return ''
    } catch (err) {
      console.error(`Failed to fetch HTML for template ${template.id}:`, err)
      return ''
    }
  }

  const extractLinksFromHtml = (html: string): { url: string; type: 'img' | 'href' }[] => {
    const links: { url: string; type: 'img' | 'href' }[] = []
    const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi
    const hrefRegex = /<a[^>]+href=["']([^"']+)["']/gi

    let match: RegExpExecArray | null

    while ((match = imgRegex.exec(html)) !== null) {
      const url = match[1]
      if (url.startsWith('http://') || url.startsWith('https://')) {
        links.push({ url, type: 'img' })
      }
    }

    while ((match = hrefRegex.exec(html)) !== null) {
      const url = match[1]
      if (url.startsWith('http://') || url.startsWith('https://')) {
        links.push({ url, type: 'href' })
      }
    }

    return links
  }

  const handleSelectEditor = async () => {
    if (!targetEditorId) {
      toast.error('Select a target editor')
      return
    }

    const editor = getEditor(targetEditorId)
    if (!editor || !sourceEditor) {
      toast.error('Editor not found')
      return
    }

    setTargetEditor(editor)
    setLoading(true)

    try {
      await fetchTargetTemplates(editor)

      const templatesWithHtml: TemplateWithHtml[] = []
      for (const template of sourceTemplates) {
        const html = await fetchTemplateHtml(template, sourceEditor)
        templatesWithHtml.push({ ...template, htmlContent: html })
      }
      setSourceTemplatesWithHtml(templatesWithHtml)

      const edits: LinkEdit[] = []
      templatesWithHtml.forEach((template) => {
        const html = template.htmlContent || ''
        const links = extractLinksFromHtml(html)
        links.forEach((link) => {
          edits.push({
            original: link.url,
            updated: link.url,
            type: link.type,
            templateId: template.id,
            templateName: template.name || template.fileName || template.id,
          })
        })
      })

      setLinkEdits(edits)
      setCurrentStep('review-links')
    } catch (err) {
      toast.error('Failed to load templates')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleBackStep = () => {
    if (currentStep === 'review-links') {
      setCurrentStep('select-editor')
    } else if (currentStep === 'summary') {
      setCurrentStep('review-links')
    }
  }

  const handleReviewLinks = () => {
    setCurrentStep('summary')
  }

  const updateLinkEdit = (index: number, newValue: string) => {
    setLinkEdits((prev) =>
      prev.map((edit, i) => (i === index ? { ...edit, updated: newValue } : edit))
    )
  }

  const handleExecute = async () => {
    if (!sourceEditor || !targetEditor) {
      toast.error('Missing editor configuration')
      return
    }

    setExecuting(true)
    try {
      const updatedTemplates = sourceTemplatesWithHtml.map((template) => {
        let html = template.htmlContent || ''
        const templateEdits = linkEdits.filter((edit) => edit.templateId === template.id)

        templateEdits.forEach((edit) => {
          if (edit.original !== edit.updated) {
            html = html.replaceAll(edit.original, edit.updated)
          }
        })

        return { ...template, htmlContent: html }
      })

      for (const template of updatedTemplates) {
        const existingTarget = targetTemplates.find(
          (t) => t.name === template.name || t.fileName === template.fileName
        )

        if (existingTarget) {
          const targetPayload = {
            ...template,
            id: existingTarget.id,
            name:
              template.name ||
              existingTarget.name ||
              existingTarget.fileName ||
              template.fileName,
          }
          await updateDocifyTemplateVariable(targetPayload, targetEditor)
          await updateDocifyTemplate(targetPayload, targetEditor)
          toast.success(`Updated: ${template.name}`)
        } else {
          await createDocifyTemplate(template, targetEditor)
          toast.success(`Created: ${template.name}`)
        }
      }

      for (const id of templateIds)  {
        await localStorage.removeItem(`template-${id}`)
      }

      toast.success('Move completed')
      router.push(`/docify?editorId=${targetEditorId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setExecuting(false)
    }
  }

  const getOperationType = (templateName: string): 'create' | 'update' => {
    return targetTemplates.some(
      (t) => t.name === templateName || t.fileName === templateName
    )
      ? 'update'
      : 'create'
  }

  const handleCancel = async () => {
    // Clear all templates from localStorage
    for (const id of templateIds) {
      await localStorage.removeItem(`template-${id}`)
    }
    router.push(`/docify?editorId=${sourceEditorId}`)
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <button
            onClick={handleCancel}
            className="flex gap-2 items-center text-sm mb-4 hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Cancel and Go Back
          </button>
          <h1 className="text-3xl font-bold tracking-tight">Move Templates</h1>
          <p className="mt-2 text-muted-foreground">
            Moving {sourceTemplates.length} template(s) to another editor
          </p>
        </div>

        <div className="mb-8 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                currentStep === 'select-editor'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              1
            </div>
            <span className="text-sm">Select Editor</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                currentStep === 'review-links'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <span className="text-sm">Review Links</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center gap-2">
            <div
              className={`h-8 w-8 rounded-full flex items-center justify-center ${
                currentStep === 'summary'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              3
            </div>
            <span className="text-sm">Summary</span>
          </div>
        </div>

        {currentStep === 'select-editor' && (
          <Card>
            <CardHeader>
              <CardTitle>Select Destination Editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="target-editor">Target Editor</Label>
                <Select
                  value={targetEditorId}
                  onValueChange={(value) => setTargetEditorId(value || '')}
                >
                  <SelectTrigger id="target-editor">
                    <SelectValue placeholder="Choose editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {editors
                      .filter(
                        (editor) =>
                          editor.type === 'docify' && editor.id !== sourceEditorId
                      )
                      .map((editor) => (
                        <SelectItem key={editor.id} value={editor.id}>
                          {editor.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  onClick={handleSelectEditor}
                  disabled={!targetEditorId || loading}
                >
                  {loading ? 'Loading...' : 'Next'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'review-links' && (
          <Card>
            <CardHeader>
              <CardTitle>Review Link Edits</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {linkEdits.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No links found in templates
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-auto">
                  {linkEdits.map((edit, index) => (
                    <div key={index} className="space-y-2 p-3 border rounded-md">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {edit.templateName}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-muted rounded">
                          {edit.type}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Original</Label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                          value={edit.original}
                          disabled
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Updated</Label>
                        <input
                          type="text"
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={edit.updated}
                          onChange={(e) => updateLinkEdit(index, e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handleBackStep}>
                  Back
                </Button>
                <Button onClick={handleReviewLinks}>Next</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'summary' && (
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm">
                  <strong>Source:</strong> {sourceEditor?.name}
                </p>
                <p className="text-sm">
                  <strong>Target:</strong> {targetEditor?.name}
                </p>
                <p className="text-sm">
                  <strong>Templates:</strong> {sourceTemplates.length}
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Operations</h3>
                <ul className="space-y-1">
                  {sourceTemplates.map((template) => {
                    const op = getOperationType(template.name || template.fileName || '')
                    return (
                      <li key={template.id} className="text-sm flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            op === 'create'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {op}
                        </span>
                        {template.name || template.fileName}
                      </li>
                    )
                  })}
                </ul>
              </div>

              {linkEdits.some((edit) => edit.original !== edit.updated) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Link Changes</h3>
                  <p className="text-xs text-muted-foreground">
                    {linkEdits.filter((edit) => edit.original !== edit.updated).length} link(s)
                    will be updated
                  </p>
                </div>
              )}

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handleBackStep}>
                  Back
                </Button>
                <Button onClick={handleExecute} disabled={executing}>
                  {executing ? 'Executing...' : 'Execute Move'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
