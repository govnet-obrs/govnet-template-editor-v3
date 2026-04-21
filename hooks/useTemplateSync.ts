'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import {
    prepareSyncPayload,
    getTemplateById,
    isTemplateEligibleForSync,
} from '@/lib/template-sync-worker'
import { EDITOR_STORAGE_KEY } from './useEditorStorage'
import { EditorConfig } from '@/lib/editor-types'
import { updateDocifyTemplate, updateDocifyTemplateVariable, updateNotifyTemplate } from '@/lib/editor-api'

interface SyncStatus {
    status: 'idle' | 'syncing' | 'success' | 'error'
    message: string
    progress: number
    totalTemplates: number
    syncedTemplates: number
    error: string | null
}

interface UseSyncTemplatesReturn {
    syncStatus: SyncStatus
    triggerSync: (options?: { source?: 'manual' | 'auto' }) => Promise<void>
    getSyncPayload: () => unknown
    getTemplateCount: () => number
    autoSyncEnabled: boolean
    setAutoSyncEnabled: (value: boolean) => void
}

interface SyncPayload {
    templates: Array<{
        templateId: string
        name: string
        editorId: string
    }>
    timestamp: string
    count: number
}

/**
 * Hook for managing template synchronization
 * Finds all templates in localStorage and prepares them for syncing
 */
export function useTemplateSync(activeEditorId?: string): UseSyncTemplatesReturn {

    const autoSyncStorageKey = 'docify-auto-sync-enabled'
    const [syncStatus, setSyncStatus] = useState<SyncStatus>({
        status: 'idle',
        message: 'Ready to sync',
        progress: 0,
        totalTemplates: 0,
        syncedTemplates: 0,
        error: null,
    })
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
    const syncInFlightRef = useRef(false)

    const getEditorsFromStorage = useCallback((): EditorConfig[] => {
        try {
            return JSON.parse(localStorage.getItem(EDITOR_STORAGE_KEY) || '[]')
        } catch (err) {
            console.error('Failed to read editor config from storage:', err)
            return []
        }
    }, [])

    const updateSyncProgress = useCallback((
        message: string,
        syncedTemplates: number,
        totalTemplates: number,
        status: SyncStatus['status'] = 'syncing',
        error: string | null = null
    ) => {
        const progress =
            totalTemplates === 0
                ? 0
                : Math.min(100, 10 + Math.round((syncedTemplates / totalTemplates) * 90))

        setSyncStatus({
            status,
            message,
            progress,
            totalTemplates,
            syncedTemplates,
            error,
        })
    }, [])

    const resolveEditorForTemplate = useCallback(
        (templateEditorId: string, templateRefEditorId: string, editors: EditorConfig[]): EditorConfig => {
            const editor = editors.find((candidate) => candidate.id === (templateEditorId || templateRefEditorId))
            if (!editor) {
                throw new Error('No editor configuration found for template')
            }
            if (!editor.apiUrl || editor.apiUrl.trim().length === 0) {
                throw new Error(`Editor "${editor.name}" is missing API URL`)
            }

            return editor
        },
        []
    )

    useEffect(() => {
        try {
            const storedValue = localStorage.getItem(autoSyncStorageKey)
            if (storedValue === 'false') {
                setAutoSyncEnabled(false)
            }
        } catch (err) {
            console.error('Failed to load auto sync preference:', err)
        }
    }, [])

    useEffect(() => {
        try {
            localStorage.setItem(autoSyncStorageKey, String(autoSyncEnabled))
        } catch (err) {
            console.error('Failed to save auto sync preference:', err)
        }
    }, [autoSyncEnabled])

    const getActiveEditorPayload = useCallback((): SyncPayload => {
        const payload = prepareSyncPayload() as SyncPayload
        if (!activeEditorId) {
            return payload
        }

        const templates = payload.templates.filter((templateRef) => {
            if (templateRef.editorId === activeEditorId) {
                return true
            }

            const template = getTemplateById(templateRef.templateId)
            return template?.editorId === activeEditorId
        })

        return {
            templates,
            timestamp: payload.timestamp,
            count: templates.length,
        }
    }, [activeEditorId])

    // Get total template count
    const getTemplateCount = useCallback(() => {
        return getActiveEditorPayload().count
    }, [getActiveEditorPayload])


    // Get sync payload
    const getSyncPayload = useCallback(() => {
        return getActiveEditorPayload()
    }, [getActiveEditorPayload])


    // Trigger sync
    const triggerSync = useCallback(async (options?: { source?: 'manual' | 'auto' }) => {
        const source = options?.source ?? 'manual'
        if (syncInFlightRef.current) {
            if (source === 'manual') {
                toast.info('Sync already running')
            }
            return
        }

        syncInFlightRef.current = true
        let toastId: string | number | undefined
        let syncedCount = 0
        let totalCount = 0
        try {
            const payload = getActiveEditorPayload()
            totalCount = payload.count
            const editors = getEditorsFromStorage()

            if (payload.count === 0) {
                setSyncStatus({
                    status: 'idle',
                    message: activeEditorId
                        ? 'No templates to sync for active editor'
                        : 'No templates to sync',
                    progress: 0,
                    totalTemplates: 0,
                    syncedTemplates: 0,
                    error: null,
                })
                if (source === 'manual') {
                    toast.info(
                        activeEditorId
                            ? 'No templates to sync for active editor'
                            : 'No templates to sync'
                    )
                }
                return
            }

            toastId = toast.loading(
                source === 'auto' ? 'Auto-syncing templates...' : 'Syncing templates...'
            )

            setSyncStatus({
                status: 'syncing',
                message: 'Preparing templates for sync...',
                progress: 10,
                totalTemplates: payload.count,
                syncedTemplates: 0,
                error: null,
            })

            for (let index = 0; index < payload.count; index++) {
                const templateRef = payload.templates[index]
                const template = getTemplateById(templateRef.templateId)

                if (!template) {
                    throw new Error(`Template ${templateRef.templateId} was not found in local storage`)
                }

                if (!isTemplateEligibleForSync(template.data)) {
                    throw new Error(`Template ${templateRef.templateId} is not eligible for sync`)
                }

                const editor = resolveEditorForTemplate(template.editorId, templateRef.editorId, editors)
                updateSyncProgress(
                    `Syncing ${index + 1} of ${payload.count}: ${templateRef.name}`,
                    syncedCount,
                    payload.count
                )

                if (template.type === 'docify') {
                    await updateDocifyTemplateVariable(template.data, editor)
                    await updateDocifyTemplate(template.data, editor)
                } else if (template.type === 'notify') {
                    await updateNotifyTemplate(template.data, editor)
                }

                syncedCount += 1
                updateSyncProgress(
                    `Synced ${syncedCount} of ${payload.count} template(s)`,
                    syncedCount,
                    payload.count
                )
            }

            setSyncStatus({
                status: 'success',
                message: `Synced ${payload.count} template(s)`,
                progress: 100,
                totalTemplates: payload.count,
                syncedTemplates: syncedCount,
                error: null,
            })
            toast.success(`Synced ${payload.count} template(s)`, { id: toastId })
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
            setSyncStatus({
                status: 'error',
                message: 'Failed to sync templates',
                progress: 0,
                totalTemplates: totalCount,
                syncedTemplates: syncedCount,
                error: errorMessage,
            })
            if (toastId) {
                toast.error(`Sync failed: ${errorMessage}`, { id: toastId })
            } else {
                toast.error(`Sync failed: ${errorMessage}`)
            }
            console.error('Sync error:', err)
        } finally {
            syncInFlightRef.current = false
        }
    }, [activeEditorId, getActiveEditorPayload, getEditorsFromStorage, resolveEditorForTemplate, updateSyncProgress])

    useEffect(() => {
        if (!autoSyncEnabled) {
            return
        }

        const interval = setInterval(() => {
            void triggerSync({ source: 'auto' })
        }, 30000)

        return () => clearInterval(interval)
    }, [triggerSync, autoSyncEnabled])

    return {
        syncStatus,
        triggerSync,
        getSyncPayload,
        getTemplateCount,
        autoSyncEnabled,
        setAutoSyncEnabled,
    }
}
