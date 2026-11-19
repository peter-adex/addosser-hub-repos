import React, { useEffect, useState } from 'react'

function LocalAttachmentsViewer ({
  attachmentsString
}: {
  attachmentsString: string | null
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!attachmentsString || !mounted) return null

  try {
    const parsedFiles = JSON.parse(attachmentsString)
    if (!Array.isArray(parsedFiles) || parsedFiles.length === 0) return null

    return (
      <div className='bg-card border border-border rounded-2xl p-5 mt-4'>
        <h2 className='font-bold text-foreground mb-3 text-sm flex items-center gap-2'>
          📎 Supporting Documents
          <span className='text-xs font-normal text-muted-foreground'>
            ({parsedFiles.length})
          </span>
        </h2>
        <div className='flex flex-wrap gap-2'>
          {parsedFiles.map(
            (
              file: { name: string; url: string; size?: number; type?: string },
              i: number
            ) => {
              const handleSecureDownload = async (
                e: React.MouseEvent<HTMLButtonElement>
              ) => {
                e.preventDefault()
                const isPdf = file.name.toLowerCase().endsWith('.pdf')

                if (
                  isPdf &&
                  file.url.includes('://cloudinary.com') &&
                  file.url.includes('/upload/')
                ) {
                  const cleanFileName = encodeURIComponent(file.name)
                  const forcedUrl = file.url.replace(
                    '/upload/',
                    `/upload/fl_attachment:${cleanFileName}/`
                  )
                  window.open(forcedUrl, '_blank', 'noopener,noreferrer')
                  return
                }

                try {
                  const response = await fetch(file.url)
                  const blob = await response.blob()
                  const blobUrl = window.URL.createObjectURL(blob)
                  const tempLink = document.createElement('a')

                  tempLink.href = blobUrl
                  tempLink.download = file.name || `Attachment-${i + 1}`

                  document.body.appendChild(tempLink)
                  tempLink.click()

                  document.body.removeChild(tempLink)
                  window.URL.revokeObjectURL(blobUrl)
                } catch (error) {
                  console.error(
                    'Local secure stream capture encountered an error, falling back to clean window redirect:',
                    error
                  )
                  window.open(file.url, '_blank', 'noopener,noreferrer')
                }
              }

              const nameLower = file.name?.toLowerCase() || ''
              let fileIcon = '📄'
              if (
                nameLower.endsWith('.xlsx') ||
                nameLower.endsWith('.xls') ||
                nameLower.endsWith('.csv')
              ) {
                fileIcon = '📊'
              } else if (
                nameLower.endsWith('.docx') ||
                nameLower.endsWith('.doc')
              ) {
                fileIcon = '📝'
              } else if (nameLower.endsWith('.pdf')) {
                fileIcon = '📕'
              } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(nameLower)) {
                fileIcon = '🖼️'
              }

              return (
                <button
                  key={file.url || i}
                  onClick={handleSecureDownload}
                  type='button'
                  className='px-4 py-2 rounded-xl border border-border bg-muted text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center gap-2 cursor-pointer shadow-sm'
                  title={`Download ${file.name}`}
                >
                  <span className='text-sm flex-shrink-0'>{fileIcon}</span>
                  <span className='text-left max-w-[200px] truncate'>
                    {file.name || `Document ${i + 1}`}
                  </span>
                </button>
              )
            }
          )}
        </div>
      </div>
    )
  } catch (e) {
    console.error(
      'Failed to safely decode text strings into arrays inside LocalAttachmentsViewer:',
      e
    )
    return null
  }
}
