'use client'

import { useState } from 'react'

/**
 * COMMS-V2-008: Shared MMS upload hook for both SendSmsDialog and CommsCompose.
 * Handles file selection (5MB limit), image preview generation, and upload to Cloud Storage.
 */

interface MmsUploadState {
  file: File | null
  preview: string | null
  uploading: boolean
}

export function useMmsUpload() {
  const [state, setState] = useState<MmsUploadState>({ file: null, preview: null, uploading: false })

  function selectFile(file: File | null): string | null {
    if (!file) {
      setState({ file: null, preview: null, uploading: false })
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      return 'File must be under 5MB for MMS'
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
    if (!allowed.includes(file.type)) {
      return 'Only JPEG, PNG, GIF, or PDF allowed'
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setState((s) => ({ ...s, file, preview: reader.result as string }))
      reader.readAsDataURL(file)
    } else {
      setState((s) => ({ ...s, file, preview: null }))
    }
    setState((s) => ({ ...s, file }))
    return null
  }

  function clear() {
    setState({ file: null, preview: null, uploading: false })
  }

  async function upload(clientId: string): Promise<string | null> {
    if (!state.file) return null
    setState((s) => ({ ...s, uploading: true }))
    try {
      const formData = new FormData()
      formData.append('file', state.file)
      formData.append('client_id', clientId)
      const res = await fetch('/api/comms/upload-media', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success && data.data?.url) {
        return data.data.url as string
      }
      return null
    } finally {
      setState((s) => ({ ...s, uploading: false }))
    }
  }

  return { file: state.file, preview: state.preview, uploading: state.uploading, selectFile, clear, upload }
}
