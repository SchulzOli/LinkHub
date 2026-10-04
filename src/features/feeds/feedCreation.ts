import {
  DEFAULT_FEED_PROXY_URL,
  DEFAULT_FEED_SETTINGS,
  DEFAULT_FEED_SIZE,
  type FeedNode,
  type FeedSource,
} from '../../contracts/feedNode'
import { createId } from '../../utils/id'

/** A new feed starts empty; the user adds feed URLs in its options. */
export function createFeedNode(input: {
  position: { x: number; y: number }
  sources?: FeedSource[]
}): FeedNode {
  const now = new Date().toISOString()

  return {
    id: createId(),
    type: 'feed',
    sources: input.sources ?? [],
    proxyUrl: DEFAULT_FEED_PROXY_URL,
    settings: { ...DEFAULT_FEED_SETTINGS, hiddenSources: [] },
    positionX: input.position.x,
    positionY: input.position.y,
    size: DEFAULT_FEED_SIZE,
    createdAt: now,
    updatedAt: now,
  }
}
