import { Rarity } from '@dcl/schemas'
import classNames from 'classnames'
import React, { useEffect, useRef, useState } from 'react'
import { loadWearable } from '../../lib/babylon'
import { useWearable } from '../../hooks/useWearable'
import { useWindowSize } from '../../hooks/useWindowSize'
import './Preview.css'

const Preview: React.FC = () => {
  const [previewError, setPreviewError] = useState('')
  const { width, height } = useWindowSize()
  const [style, setStyle] = useState<React.CSSProperties>({})
  const [isDragging, setIsDragging] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const params = new URLSearchParams(window.location.search)
  const contractAddress = params.get('contract')!
  const tokenId = params.get('token')
  const itemId = params.get('item')
  const [wearable, isLoadingWearable, wearableError] = useWearable({ contractAddress, tokenId, itemId })
  const [image, setImage] = useState('')
  const [is3D, setIs3D] = useState(true)

  const isLoading = isLoadingModel || isLoadingWearable
  const error = previewError || wearableError
  const showImage = !!image && (isLoading || !is3D)
  const showCanvas = is3D && !error

  useEffect(() => {
    if (canvasRef.current && wearable) {
      // rarity background
      const [light, dark] = Rarity.getGradient(wearable.rarity)
      const backgroundImage = `radial-gradient(${light}, ${dark})`
      setStyle({ backgroundImage, opacity: 1 })

      // set background image
      setImage(wearable.thumbnail)

      // load model or image (for texture only wearables)
      const representation = wearable.data.representations[0]
      if (representation.mainFile.endsWith('png')) {
        setIs3D(false)
        setIsLoadingModel(false)
        setIsLoaded(true)
      } else {
        // load model
        const content = representation.contents.find((content) => content.key === representation.mainFile)
        if (content) {
          loadWearable(canvasRef.current, content.url)
            .catch((error) => setPreviewError(error.message))
            .finally(() => {
              setIsLoadingModel(false)
              setIsLoaded(true)
            })
        } else {
          console.warn('Content not found for wearable', wearable)
          setPreviewError('Content not found')
        }
      }
    }
  }, [canvasRef.current, wearable])

  return (
    <div
      className={classNames('Preview', {
        'is-dragging': isDragging,
        'is-loading': isLoading,
        'is-loaded': isLoaded,
        'has-error': !!error,
      })}
      style={style}
    >
      {showImage && <img className="thumbnail" src={image} />}
      {showCanvas && (
        <canvas
          id="wearable-preview"
          width={width}
          height={height}
          ref={canvasRef}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => setIsDragging(false)}
        ></canvas>
      )}
      {error && <div className="error">{error}</div>}
    </div>
  )
}

export default React.memo(Preview)
