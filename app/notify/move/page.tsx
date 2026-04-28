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
  createNotifyTemplate,
  updateNotifyTemplate,
} from '@/lib/editor-api'
import type { EditorConfig } from '@/lib/editor-types'

interface NotificationTemplate {
  id: string
  key?: string
  subject?: string
  sender?: string
  sms?: string
  email?: string
  bcc?: string[]
  cc?: string[]
  data?: unknown
  createdAt: string
  updatedAt?: string
  type?: 'SMS' | 'EMAIL' | 'PUSH' | string
  channel?: string
}

type WizardStep = 'select-editor' | 'review-templates' | 'summary'

export default function NotifyMovePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sourceEditorId = searchParams.get('sourceEditorId')
  const templateIds = searchParams.get('templateIds')?.split(',') || []

  const { getEditor, editors } = useEditorStorage()

  const [currentStep, setCurrentStep] = useState<WizardStep>('select-editor')
  const [sourceEditor, setSourceEditor] = useState<EditorConfig | null>(null)
  const [targetEditorId, setTargetEditorId] = useState('')
  const [targetEditor, setTargetEditor] = useState<EditorConfig | null>(null)
  const [sourceTemplates, setSourceTemplates] = useState<NotificationTemplate[]>([])
  const [targetTemplates, setTargetTemplates] = useState<NotificationTemplate[]>([])
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

    const templates: NotificationTemplate[] = []
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
      const url = appendQueryCredentials(
        `${editor.apiUrl}/templates?page=1&limit=1000`,
        editor
      )

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
      setCurrentStep('review-templates')
    } catch (err) {
      toast.error('Failed to load templates')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const findMatchingTarget = (template: NotificationTemplate) => {
    return targetTemplates.find((target) => {
      if (template.key && target.key) {
        return target.key === template.key
      }
      if (template.subject && target.subject) {
        return target.subject === template.subject
      }
      return false
    })
  }

  const handleBackStep = () => {
    if (currentStep === 'review-templates') {
      setCurrentStep('select-editor')
    } else if (currentStep === 'summary') {
      setCurrentStep('review-templates')
    }
  }

  const handleReviewTemplates = () => {
    setCurrentStep('summary')
  }

  const handleExecute = async () => {
    if (!sourceEditor || !targetEditor) {
      toast.error('Missing editor configuration')
      return
    }

    setExecuting(true)
    try {
      for (const template of sourceTemplates) {
        const existingTarget = findMatchingTarget(template)

        if (existingTarget) {
          const targetPayload = {
            ...template,
            id: existingTarget.id,
            key: template.key || existingTarget.key,
            subject: template.subject || existingTarget.subject,
          }
          await updateNotifyTemplate(targetPayload as unknown as Record<string, unknown>, targetEditor)
          toast.success(`Updated: ${template.subject || template.key}`)
        } else {
          await createNotifyTemplate(template as unknown as Record<string, unknown>, targetEditor)
          toast.success(`Created: ${template.subject || template.key}`)
        }
      }

      templateIds.forEach((id) => {
        localStorage.removeItem(`template-${id}`)
      })

      toast.success('Move completed')
      router.push(`/notify?editorId=${targetEditorId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Move failed')
    } finally {
      setExecuting(false)
    }
  }

  const getOperationType = (template: NotificationTemplate): 'create' | 'update' => {
    return findMatchingTarget(template) ? 'update' : 'create'
  }

  const handleCancel = () => {
    templateIds.forEach((id) => {
      localStorage.removeItem(`template-${id}`)
    })
    router.push(`/notify?editorId=${sourceEditorId}`)
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
                currentStep === 'review-templates'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
            <span className="text-sm">Review Templates</span>
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
                          editor.type === 'notify' && editor.id !== sourceEditorId
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

        {currentStep === 'review-templates' && (
          <Card>
            <CardHeader>
              <CardTitle>Review Templates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sourceTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No templates found to move
                </p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-auto">
                  {sourceTemplates.map((template) => {
                    const op = getOperationType(template)
                    return (
                      <div key={template.id} className="flex items-center gap-2 p-3 border rounded-md">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            op === 'create'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }`}
                        >
                          {op}
                        </span>
                        <span className="text-sm">
                          {template.subject || template.key || template.id}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-4">
                <Button variant="outline" onClick={handleBackStep}>
                  Back
                </Button>
                <Button onClick={handleReviewTemplates}>Next</Button>
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
