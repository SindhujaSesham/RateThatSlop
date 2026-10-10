# Privacy

RateThatSlop performs image analysis locally in the browser. Images discovered
by the Etsy content script are sent only to the extension's local service
worker and offscreen document for inference; they are not uploaded to a
RateThatSlop server.

The extension reads image URLs, and optionally the listing title, seller,
price, and page URL, only from Etsy pages where its content script runs. The
popup can request this data to display a current-page scan. The current
implementation does not create an account, use an analytics service, or send
listing data to a remote service.

On listing pages, three bounded scrapers can collect listing identity, product
details, reviews, ratings, and product image URLs for local processing.
Scraping is controlled by the `scrapingEnabled` extension-storage setting and
repeats are prevented by the Etsy listing ID. The local post record stores only
compact identity fields, SHA-256 image-byte hashes, timestamps, and an
optional structured AI rating. Raw description and review text is not stored by
this workflow. No post data is sent to a server by the current implementation.

Completed local inference results are cached in Chrome extension storage as
compact result metadata keyed by a SHA-256 hash of the fetched image bytes.
The cache does not store downloaded image bytes or full pasted-image data
URLs. Page scans hash candidate images and check cached results before
starting new local inference.

The backend supports authenticated report submission and retrieval, stored
listing score snapshots, per-image analysis metadata, and description
evaluation. The extension reads a fresh stored listing score only when a user
has a valid session. It matches stored image results by locally computed
SHA-256 image-byte hashes, skips local inference for matching results, and
locally analyzes only missing or stale results. A user who is not signed in
cannot access any server feature or description evaluation but can still use
local image detection.

Server synchronization is authenticated. The extension sends only listing
metadata, scores, and image hashes/optional URLs for explicit score
submission; it does not upload image bytes. Server-provided results are
marked separately from fresh local inference. Retention, account deletion
behavior, report moderation, and any future remote image-processing feature
must be documented before release.

Results are automated estimates of AI-image likelihood. They are not proof
that an image or seller is deceptive, fraudulent, or low quality. Etsy DOM
changes, inaccessible images, and model limitations can produce unavailable
or incorrect results.

The bundled model is based on the Sieve image detector project. Its version,
calibration, threshold, and provenance are recorded in
[`extension/model_manifest.json`](./extension/model_manifest.json).
