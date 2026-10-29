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
}: {
  src?: string | null
  alt?: string
  label?: string
  className?: string
}) {
  if (src) {
    return <img src={src} alt={alt || label || ''} className={`object-cover ${className}`} />
  }
  return <Placeholder label={label || 'Image'} className={className} />
}
