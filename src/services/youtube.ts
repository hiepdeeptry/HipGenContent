export interface YouTubeInfo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  maxResThumbnailUrl: string;
}

export function extractYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Pattern matches:
  // - https://www.youtube.com/watch?v=ID
  // - https://youtu.be/ID
  // - https://www.youtube.com/embed/ID
  // - https://www.youtube.com/shorts/ID
  // - ID itself (11 characters)
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
  const match = trimmed.match(regex);
  if (match && match[1]) {
    return match[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function getYouTubeThumbnails(videoId: string) {
  return {
    maxRes: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    hq: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    mq: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    default: `https://img.youtube.com/vi/${videoId}/default.jpg`,
  };
}

export async function fetchYouTubeInfo(urlOrId: string): Promise<YouTubeInfo | null> {
  const videoId = extractYouTubeVideoId(urlOrId);
  if (!videoId) return null;

  const standardUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = '';

  // Try fetching from our proxy endpoint first
  try {
    const res = await fetch(`/api/youtube-info?url=${encodeURIComponent(standardUrl)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.title) {
        title = data.title;
      }
    }
  } catch (err) {
    console.warn('Backend youtube-info fetch failed, trying direct oembed:', err);
  }

  // Fallback to direct oEmbed if backend proxy didn't return title
  if (!title) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(standardUrl)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.title) {
          title = data.title;
        }
      }
    } catch (err) {
      console.warn('Direct oembed failed:', err);
    }
  }

  // If still no title, use fallback
  if (!title) {
    title = `YouTube Video (${videoId})`;
  }

  const thumbs = getYouTubeThumbnails(videoId);

  return {
    videoId,
    title,
    thumbnailUrl: thumbs.maxRes,
    maxResThumbnailUrl: thumbs.maxRes,
  };
}
