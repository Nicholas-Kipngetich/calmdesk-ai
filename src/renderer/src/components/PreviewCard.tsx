import { useEffect, useRef } from 'react'

interface PreviewCardProps {
  stream: MediaStream | null
}

/**
 * Live camera preview.
 * Deliberately visible while monitoring (Feature 6, consent through
 * transparency): the user always sees exactly what is captured, and the
 * card states plainly that nothing is recorded or stored.
 */
export function PreviewCard({ stream }: PreviewCardProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (stream) {
      video.srcObject = stream
      void video.play().catch(() => {
        /* autoplay guard */
      })
    } else {
      video.srcObject = null
    }
  }, [stream])

  return (
    <div className="card preview-card">
      <div className="metric-head">
        <span className="metric-label">Camera preview</span>
        <span className="preview-note muted">live · never recorded</span>
      </div>
      {stream ? (
        <video ref={videoRef} className="preview-video" muted playsInline />
      ) : (
        <div className="preview-placeholder muted">
          The camera preview appears once monitoring starts.
        </div>
      )}
    </div>
  )
}
