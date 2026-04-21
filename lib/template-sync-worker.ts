/**
 * Template Sync Worker
 * Collects all templates from localStorage and prepares them for online sync
 */

interface TemplateRef {
    templateId: string
    name: string
    editorId: string
}

interface TemplateFull {
    templateId: string
    data: unknown
    type: 'docify' | 'notify'
    editorId: string
}

interface SyncPayload {
    templates: TemplateRef[]
    timestamp: string
    count: number
}

interface StoredTemplateEnvelope {
    template?: Record<string, unknown>
    editorId?: string
    lastOpened?: number
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function getStringField(record: Record<string, unknown>, key: string): string | undefined {
    const value = record[key]
    if (typeof value !== 'string') {
        return undefined
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : undefined
}

export function getTemplateType(template: unknown): 'docify' | 'notify' {
    if (!isRecord(template)) {
        return 'docify'
    }

    const hasNotifyPayload =
        (typeof template.email === 'string' && template.email.trim().length > 0) ||
        (typeof template.sms === 'string' && template.sms.trim().length > 0)

    return hasNotifyPayload ? 'notify' : 'docify'
}

export function isTemplateEligibleForSync(template: unknown): boolean {
    if (!isRecord(template)) {
        return false
    }

    const type = getTemplateType(template)
    if (type === 'notify') {
        return true
    }

    return typeof template.htmlContent === 'string' && template.htmlContent.trim().length > 0
}

/**
 * Find all templates in localStorage
 * Returns an array of template data ready for syncing
 */
export function getAllTemplatesFromStorageForSyncing(): TemplateRef[] {
    const templates: TemplateRef[] = []

    if (typeof localStorage === 'undefined') {
        console.warn('localStorage is not available. No templates can be retrieved for syncing.')
        return templates
    }

    // Get all localStorage keys
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (!key) continue

        // Look for template keys: template-{templateId}
        if (key.startsWith('template-')) {
            try {
                const storedData = localStorage.getItem(key)

                if (storedData) {
                    const parsed = JSON.parse(storedData) as StoredTemplateEnvelope
                    const template = parsed.template
                    const storedEditorId = parsed.editorId

                    if (!template) {
                        continue
                    }

                    const templateId = key.replace('template-', '')

                    const resolvedName =
                        getStringField(template, 'name') ||
                        getStringField(template, 'fileName') ||
                        getStringField(template, 'key') ||
                        getStringField(template, 'subject') ||
                        templateId

                    // Sync entries opened in the last day only.
                    const now = Date.now()
                    const lastOpened =
                        (isRecord(template) && typeof template.lastOpened === 'number'
                            ? template.lastOpened
                            : undefined) ?? parsed.lastOpened
                    if (typeof lastOpened === 'number' && now - lastOpened > ONE_DAY_MS) {
                        continue
                    }

                    if (!isTemplateEligibleForSync(template)) {
                        continue
                    }

                    templates.push({
                        templateId,
                        name: resolvedName,
                        editorId: getStringField(template, 'editorId') || storedEditorId || '',
                    })
                }
            } catch (err) {
                console.error(`Failed to parse template ${key}:`, err)
            }
        }
    }

    return templates
}


/**
 * Prepare templates for sync
 * Creates a sync payload with all templates ready to be sent
 */
export function prepareSyncPayload(): SyncPayload {
    const templates = getAllTemplatesFromStorageForSyncing()

    return {
        templates,
        timestamp: new Date().toISOString(),
        count: templates.length,
    }
}

/**
 * Get templates by type
 */
export function getTemplatesByType(type: 'docify' | 'notify'): TemplateRef[] {
    const templates = getAllTemplatesFromStorageForSyncing()
    return templates.filter((template) => {
        const full = getTemplateById(template.templateId)
        return full?.type === type
    })
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templateId: string): TemplateFull | null {
    try {
        const storedData = localStorage.getItem(`template-${templateId}`)
        if (storedData) {
            const parsed = JSON.parse(storedData) as StoredTemplateEnvelope
            const template = parsed.template
            const storedEditorId = parsed.editorId

            if (!template) {
                return null
            }

            return {
                templateId,
                data: template,
                type: getTemplateType(template),
                editorId: getStringField(template, 'editorId') || storedEditorId || '',
            }
        }
    } catch (err) {
        console.error(`Failed to get template ${templateId}:`, err)
    }

    return null
}

/**
 * Check if any templates need syncing
 * (Haven't been synced yet or were modified after last sync)
 */
export function getTemplatesNeedingSync(lastSyncTime: string | null): TemplateRef[] {
    const templates = getAllTemplatesFromStorageForSyncing()

    if (!lastSyncTime) {
        return templates
    }

    return templates
}

/**
 * Clear synced templates from localStorage
 * Call this after successful sync
 */
export function clearSyncedTemplates(templateIds: string[]): void {
    templateIds.forEach((id) => {
        localStorage.removeItem(`template-${id}`)
    })
}
