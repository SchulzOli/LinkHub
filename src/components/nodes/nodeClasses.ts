import styles from './NodeChrome.module.css'
import surfaceStyles from './NodeSurface.module.css'

/**
 * Class for a node root that uses the shared chrome (action bar, resize
 * handles). The root must carry `data-mode` and `data-selected`.
 */
export const NODE_CHROME_HOST = styles.host

/**
 * Shell of free-floating content nodes (pictures, charts, feeds): border,
 * radius, fill, shadow, selection and hover. Combine with NODE_CHROME_HOST.
 */
export const NODE_SURFACE = surfaceStyles.surface
