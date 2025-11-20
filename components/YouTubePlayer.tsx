'use client'

import { useState } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'

interface YouTubePlayerProps {
  url: string
}

export default function YouTubePlayer({ url }: YouTubePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // YouTube URL에서 비디오 ID 추출
  const getVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const videoId = getVideoId(url)
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

  if (!videoId) {
    return (
      <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">유효하지 않은 유튜브 URL입니다</p>
      </div>
    )
  }

  return (
    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
      {isPlaying ? (
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${isMuted ? 1 : 0}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      ) : (
        <div className="relative w-full h-full">
          <img
            src={thumbnailUrl}
            alt="YouTube thumbnail"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <button
              onClick={() => setIsPlaying(true)}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full p-4 transition-colors duration-200"
            >
              <Play className="h-8 w-8 ml-1" />
            </button>
          </div>
        </div>
      )}
      
      {/* Controls */}
      <div className="absolute bottom-4 right-4 flex space-x-2">
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70 transition-colors duration-200"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

