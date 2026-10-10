/**
 * The lazy Mermaid engine chunk. The card imports this module dynamically, so
 * the build emits one self-contained bundle the client module system fetches
 * through `require.async` when the first diagram is drawn.
 *
 * The engine is bundled with its internal dynamic imports inlined: the module
 * loader materializes a package-local chunk as one closure and cannot answer a
 * synchronous sibling `require`, so Mermaid's own diagram splitting cannot
 * survive the trip.
 */
import mermaid from 'mermaid';
export default mermaid;
