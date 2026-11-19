'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { buildDownloadUrl, getFileIcon } from '@/lib/download'

interface DownloadButtonProps {
  fileUrl: string
  fileName: string
  label?: string
  variant?: 'link' | 'button' | 'icon'
  className?: string
  size?: 'sm' | 'md'
}

export default function DownloadButton ({
  fileUrl,
  fileName,
  label,
  variant = 'link',
  className = '',
  size = 'md'
}: DownloadButtonProps) {
  const [loading, setLoading] = useState(false)

  if (!fileUrl) return null

  const href = buildDownloadUrl(fileUrl, fileName)
  const displayLabel = label ?? fileName
  const icon = getFileIcon(fileName)
  const iconSize = size === 'sm' ? 11 : 14

  function handleClick () {
    setLoading(true)
    setTimeout(() => setLoading(false), 2500)
  }

  if (variant === 'icon') {
    return (
      <a
        href={href}
        download={fileName}
        onClick={handleClick}
        title={`Download ${fileName}`}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg
          hover:bg-accent transition-colors text-muted-foreground hover:text-foreground
          ${className}`}
      >
        {loading ? (
          <Loader2 size={iconSize} className='animate-spin' />
        ) : (
          <Download size={iconSize} />
        )}
      </a>
    )
  }

  if (variant === 'button') {
    return (
      <a
        href={href}
        download={fileName}
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl
          border border-border bg-card hover:bg-accent
          text-sm font-semibold text-foreground transition-colors
          ${className}`}
      >
        {loading ? (
          <Loader2 size={iconSize} className='animate-spin text-[#FFB800]' />
        ) : (
          <Download
            size={iconSize}
            className='text-[#1B2A8A] dark:text-blue-400'
          />
        )}
        <span className='truncate max-w-[200px]'>{displayLabel}</span>
      </a>
    )
  }

  return (
    <a
      href={href}
      download={fileName}
      onClick={handleClick}
      title={`Download ${fileName}`}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold
        text-[#1B2A8A] dark:text-blue-400 hover:underline
        group transition-colors
        ${className}`}
    >
      <span className='text-sm flex-shrink-0'>{icon}</span>
      <span className='truncate max-w-[180px] group-hover:text-[#121E6B]'>
        {displayLabel}
      </span>
      {loading ? (
        <Loader2 size={iconSize} className='animate-spin flex-shrink-0' />
      ) : (
        <Download size={iconSize} className='flex-shrink-0 opacity-60' />
      )}
    </a>
  )
}
