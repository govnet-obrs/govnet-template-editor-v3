import { EditorConfig } from "./editor-types"

const DEFAULT_TIMEOUT_MS = 15000
type TemplateInput = Record<string, unknown>

const buildAuthHeaders = (editor: EditorConfig): HeadersInit => {
    const headers: HeadersInit = {}
    if (editor.credentialsType === 'header') {
        editor.credentials.forEach((cred) => {
            if (cred.key && cred.value) {
                headers[cred.key] = cred.value
            }
        })
    }

    return headers
}

const appendQueryCredentials = (url: string, editor: EditorConfig): string => {
    if (editor.credentialsType === 'query') {
        const params = new URLSearchParams()
        editor.credentials.forEach((cred) => {
            if (cred.key && cred.value) {
                params.append(cred.key, cred.value)
            }
        })
        if (Array.from(params.keys()).length > 0) {
            const separator = url.includes('?') ? '&' : '?'
            return `${url}${separator}${params.toString()}`
        }
    }

    return url
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        })
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs}ms`)
        }
        throw err
    } finally {
        clearTimeout(timeoutId)
    }
}

const asError = (context: string, err: unknown): Error => {
    if (err instanceof Error) {
        return new Error(`${context}: ${err.message}`)
    }

    return new Error(context)
}

const getStringValue = (value: unknown, fallback = ''): string => {
    return typeof value === 'string' ? value : fallback
}

const getStringArray = (value: unknown): string[] => {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (typeof value === 'object' && value !== null) {
        return value as Record<string, unknown>
    }
    return undefined
}

const getTemplateId = (template: TemplateInput): string => {
    const nested = getRecord(template.data)
    const templateId = template.id || template.templateId || nested?.id
    if (!templateId) {
        throw new Error('Template id is missing')
    }
    return String(templateId)
}

export function updateDocifyTemplateVariable(template: TemplateInput, editor: EditorConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!editor.apiUrl) {
                throw new Error('Missing API URL for editor')
            }
            const templateId = getTemplateId(template)
           
            const jsonFormData = new FormData()
            jsonFormData.append("templateId", templateId)
            jsonFormData.append("name", getStringValue(template.name))
            jsonFormData.append("pageSettings", JSON.stringify(template.pageSettings || {}))
            jsonFormData.append("sampleJsonData", getStringValue(template.sampleJsonData))
            jsonFormData.append("folderName", getStringValue(template.folderName))
            jsonFormData.append("tags", JSON.stringify(template.tags || []))

            const headers = buildAuthHeaders(editor)
            const url = appendQueryCredentials(`${editor.apiUrl}/templates/edit-page-settings/${templateId}`, editor)

            const response = await fetchWithTimeout(url, {
                method: "PUT",
                body: jsonFormData,
                headers,
            })

            if (!response.ok) {
                throw new Error(`Failed to update template ${templateId}: ${response.status} ${response.statusText}`)
            }

            resolve(true)
        } catch (err) {
            const error = asError('Failed to update docify template metadata', err)
            console.error(error.message)
            reject(error)
        }
    })
}

export function updateDocifyTemplate(template: TemplateInput, editor: EditorConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!editor.apiUrl) {
                throw new Error('Missing API URL for editor')
            }
            const templateId = getTemplateId(template)

            const headers = buildAuthHeaders(editor)

            const htmlContent = getStringValue(template.htmlContent)
            const name = getStringValue(template.name, `template-${templateId}`)

            const formData = new FormData()
            const htmlBlob = new Blob([htmlContent], { type: "text/html" })
            formData.append("file", htmlBlob, `${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}.html`)
            formData.append("templateId", templateId)

            const url = appendQueryCredentials(`${editor.apiUrl}/templates/${templateId}`, editor)

            const response = await fetchWithTimeout(url, {
                method: "PUT",
                body: formData,
                headers,
            })

            if (!response.ok) {
                throw new Error(`Failed to update HTML content for template ${templateId}: ${response.status} ${response.statusText}`)
            }

            resolve(true)
        } catch (err) {
            const error = asError('Failed to update docify template HTML', err)
            console.error(error.message)
            reject(error)
        }
    })
}

export function createDocifyTemplate(template: TemplateInput, editor: EditorConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!editor.apiUrl) {
                throw new Error('Missing API URL for editor')
            }

            const headers = buildAuthHeaders(editor)

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

            const htmlContent = getStringValue(template.htmlContent, sampleHtml)
            const name =
                getStringValue(template.name) ||
                getStringValue(template.fileName) ||
                `template-${Date.now()}`
            const fileName = `${name.toUpperCase().replace(/[^A-Z0-9_]/g, '_')}.html`
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' })

            const formData = new FormData()
            formData.append('name', name)
            formData.append('file', htmlBlob, fileName)
            formData.append('folderName', getStringValue(template.folderName))
            formData.append('tags', JSON.stringify(template.tags || []))
            formData.append(
                'pageSettings',
                JSON.stringify(
                    template.pageSettings || {
                        pageSize: 'A4',
                        orientation: 'portrait',
                        marginTop: 15,
                        marginBottom: 15,
                        marginLeft: 15,
                        marginRight: 15,
                    }
                )
            )
            formData.append('sampleJsonData', getStringValue(template.sampleJsonData, JSON.stringify({})))

            const url = appendQueryCredentials(`${editor.apiUrl}templates`, editor)

            const response = await fetchWithTimeout(url, {
                method: 'POST',
                headers,
                body: formData,
            })

            if (!response.ok) {
                throw new Error(`Failed to create template: ${response.statusText}`)
            }

            resolve(true)
        } catch (err) {
            console.error('Failed to create docify template:', err)
            reject(err)
        }
    })
}

export interface EmailTemplatePayload {
  key: string
  sender: string
  subject: string
  email: string
  sms: string
  cc?: string[]
  bcc?: string[]
  data?: Record<string, string>
}


export function updateNotifyTemplate(template: TemplateInput, editor: EditorConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!editor.apiUrl) {
                throw new Error('Missing API URL for editor')
            }
            const templateId = getTemplateId(template)

            const headers = buildAuthHeaders(editor)

            const payload: EmailTemplatePayload = {
                key: getStringValue(template.key),
                sender: getStringValue(template.sender),
                subject: getStringValue(template.subject),
                email: getStringValue(template.email),
                sms: getStringValue(template.sms),
                cc: getStringArray(template.cc),
                bcc: getStringArray(template.bcc),
                data: getRecord(template.data) as Record<string, string> || {},
            }

            const url = appendQueryCredentials(`${editor.apiUrl}/templates/${templateId}`, editor)

            const response = await fetchWithTimeout(url, {
                method: "PUT",
                body: JSON.stringify(payload),
                headers: {
                    "Content-Type": "application/json",
                    ...headers,
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to update notify template ${templateId}: ${response.status} ${response.statusText}`)
            }

            resolve(true)
        } catch (err) {
            const error = asError('Failed to update notify template', err)
            console.error(error.message)
            reject(error)
        }
    })
}

export function createNotifyTemplate(template: TemplateInput, editor: EditorConfig) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!editor.apiUrl) {
                throw new Error('Missing API URL for editor')
            }

            const headers = buildAuthHeaders(editor)

            const payload: EmailTemplatePayload = {
                key: getStringValue(template.key) || getStringValue(template.subject),
                sender: getStringValue(template.sender),
                subject: getStringValue(template.subject) || getStringValue(template.key),
                email: getStringValue(template.email),
                sms: getStringValue(template.sms),
                cc: getStringArray(template.cc),
                bcc: getStringArray(template.bcc),
                data: getRecord(template.data) as Record<string, string> || {},
            }

            const url = appendQueryCredentials(`${editor.apiUrl}/templates`, editor)

            const response = await fetchWithTimeout(url, {
                method: 'POST',
                body: JSON.stringify(payload),
                headers: {
                    'Content-Type': 'application/json',
                    ...headers,
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to create notify template: ${response.statusText}`)
            }

            resolve(true)
        } catch (err) {
            console.error('Failed to create notify template:', err)
            reject(err)
        }
    })
}