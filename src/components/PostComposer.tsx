import { ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { compressImageFile, getMedia } from '../lib/media'
import { imageCount, MAX_POST_IMAGES, normalizeBody } from '../lib/postBody'
import { uid } from '../lib/utils'
import type { PostBody } from '../types'
import { useToast } from './Toast'

type Props = {
  value: PostBody
  onChange: (body: PostBody) => void
  onBusyChange?: (busy: boolean) => void
  placeholder?: string
}

function signature(body: PostBody) {
  return body.map((block) => (block.type === 'text' ? `t:${block.text}` : `i:${block.url}`)).join('\n')
}

function serializeEditor(root: HTMLElement): PostBody {
  const blocks: PostBody = []
  let text = ''

  const flushText = () => {
    const next = text.replace(/\n+$/g, '')
    if (next) blocks.push({ id: uid('blk'), type: 'text', text: next })
    text = ''
  }

  const walk = (node: Node) => {
    if (node instanceof HTMLElement && node.dataset.editorImage === '1') {
      flushText()
      const url = node.dataset.url || ''
      if (url) blocks.push({ id: node.dataset.id || uid('blk'), type: 'image', url })
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ''
      return
    }
    if (node instanceof HTMLElement && node.tagName === 'BR') {
      text += '\n'
      return
    }
    if (node instanceof HTMLElement && (node.tagName === 'DIV' || node.tagName === 'P')) {
      if (text.length > 0 && !text.endsWith('\n')) text += '\n'
      Array.from(node.childNodes).forEach(walk)
      if (!text.endsWith('\n')) text += '\n'
      return
    }
    Array.from(node.childNodes).forEach(walk)
  }

  Array.from(root.childNodes).forEach(walk)
  flushText()
  return normalizeBody(blocks)
}

function placeCaretAfter(node: Node) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function caretIn(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.commonAncestorContainer)) return null
  return range
}

export function PostComposer({ value, onChange, onBusyChange, placeholder = 'Write your post...' }: Props) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const emitted = useRef(signature(value))
  const [busy, setBusy] = useState(false)
  const [empty, setEmpty] = useState(true)

  const setBusyState = (next: boolean) => {
    setBusy(next)
    onBusyChange?.(next)
  }

  const markEmpty = (editor: HTMLElement) => {
    setEmpty(!editor.textContent?.trim() && editor.querySelectorAll('[data-editor-image]').length === 0)
  }

  const emitFromDom = () => {
    const editor = editorRef.current
    if (!editor) return
    const body = serializeEditor(editor)
    emitted.current = signature(body)
    markEmpty(editor)
    onChange(body)
  }

  const makeFigure = (id: string, url: string, src: string) => {
    const figure = document.createElement('figure')
    figure.className = 'xf-editor-figure'
    figure.contentEditable = 'false'
    figure.dataset.editorImage = '1'
    figure.dataset.id = id
    figure.dataset.url = url

    const img = document.createElement('img')
    img.src = src
    img.alt = ''
    figure.appendChild(img)

    const remove = document.createElement('button')
    remove.type = 'button'
    remove.className = 'xf-editor-remove'
    remove.setAttribute('aria-label', 'Remove image')
    remove.dataset.remove = '1'
    remove.textContent = '×'
    figure.appendChild(remove)
    return figure
  }

  const paint = async (body: PostBody) => {
    const editor = editorRef.current
    if (!editor) return
    editor.innerHTML = ''
    const meaningful = body.filter((block, index) => {
      if (block.type === 'image') return Boolean(block.url)
      if (!block.text) return index > 0 && index < body.length - 1
      return true
    })
    for (const block of meaningful) {
      if (block.type === 'text') {
        const lines = block.text.split('\n')
        for (const line of lines) {
          const div = document.createElement('div')
          if (line) div.textContent = line
          else div.appendChild(document.createElement('br'))
          editor.appendChild(div)
        }
      } else {
        const src = block.url.startsWith('idb:') ? (await getMedia(block.url.slice(4))) || '' : block.url
        if (!src) continue
        editor.appendChild(makeFigure(block.id, block.url, src))
      }
    }
    markEmpty(editor)
  }

  useEffect(() => {
    const editor = editorRef.current
    if (signature(value) === emitted.current && editor && editor.childNodes.length > 0) return
    emitted.current = signature(value)
    void paint(value)
  }, [value])

  const insertImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file.')
      return
    }
    const editor = editorRef.current
    if (!editor) return
    const currentImages = editor.querySelectorAll('[data-editor-image]').length
    if (currentImages >= MAX_POST_IMAGES) {
      toast(`You can add up to ${MAX_POST_IMAGES} images.`)
      return
    }
    setBusyState(true)
    try {
      const url = await compressImageFile(file)
      const figure = makeFigure(uid('blk'), url, url)
      editor.focus()
      const range = caretIn(editor)
      if (range) {
        range.deleteContents()
        range.insertNode(figure)
      } else {
        editor.appendChild(figure)
      }
      const spacer = document.createElement('div')
      spacer.appendChild(document.createElement('br'))
      figure.after(spacer)
      placeCaretAfter(figure)
      emitFromDom()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusyState(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const used = imageCount(value)

  return (
    <div
      className="xf-editor"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void insertImage(e.dataTransfer.files?.[0])
      }}
    >
      <div className="xf-editor-toolbar">
        <button
          type="button"
          className="xf-tool"
          disabled={busy || used >= MAX_POST_IMAGES}
          onClick={() => fileRef.current?.click()}
        >
          <ImagePlus size={13} />
          {busy ? 'Uploading…' : 'Image'}
        </button>
        <span className="xf-editor-meta">{used}/{MAX_POST_IMAGES}</span>
        <span className="xf-editor-hint">Inserts at the cursor</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void insertImage(e.target.files?.[0])}
      />
      <div
        ref={editorRef}
        className={`xf-editor-surface${empty ? ' is-empty' : ''}`}
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder}
        data-placeholder={placeholder}
        suppressContentEditableWarning
        onInput={emitFromDom}
        onClick={(e) => {
          const target = e.target as HTMLElement
          if (!target.closest('[data-remove]')) return
          e.preventDefault()
          target.closest('[data-editor-image]')?.remove()
          emitFromDom()
        }}
        onPaste={(e) => {
          const file = [...(e.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
          if (!file) return
          e.preventDefault()
          void insertImage(file)
        }}
      />
    </div>
  )
}
