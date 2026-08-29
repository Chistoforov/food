import { useEffect, useRef } from 'react'

type Entry = {
  markClosedByPop: () => void
  close: () => void
}

const overlayStack: Entry[] = []
let programmaticPopCount = 0

export function useOverlayBackClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    let closedByPop = false
    const entry: Entry = {
      markClosedByPop: () => {
        closedByPop = true
      },
      close: () => onCloseRef.current(),
    }
    overlayStack.push(entry)
    window.history.pushState({ __overlay: true }, '')

    const handlePop = () => {
      if (programmaticPopCount > 0) {
        programmaticPopCount--
        return
      }
      const top = overlayStack[overlayStack.length - 1]
      if (top === entry) {
        top.markClosedByPop()
        top.close()
      }
    }
    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      const idx = overlayStack.lastIndexOf(entry)
      if (idx !== -1) overlayStack.splice(idx, 1)
      if (!closedByPop) {
        programmaticPopCount++
        window.history.back()
      }
    }
  }, [open])
}
