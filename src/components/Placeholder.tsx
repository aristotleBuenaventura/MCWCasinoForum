export function Placeholder({
  label = 'Image',
  className = '',
  ratio,
}: {
  label?: string
  className?: string
  ratio?: string
}) {
  return (
    <div className={`placeholder-box overflow-hidden ${className}`} style={ratio ? { aspectRatio: ratio } : undefined}>
      {label}
    </div>
  )
}

export function MediaOrPlaceholder({
  src,
  alt,
  label,
  className = '',
  fit = 'cover',
}: {
  src?: string | null
  alt?: string
  label?: string
  className?: string
  fit?: 'cover' | 'contain'
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt || label || ''}
        className={`${fit === 'contain' ? 'object-contain bg-[var(--color-panel-2)]' : 'object-cover'} ${className}`}
      />
    )
  }
  return <Placeholder label={label || 'Image'} className={className} />
}
