# Eutopia Backend

## Image size configuration

`fetchVerifiedImage` uses Google Places photos. You can control the size of returned images via environment variables or function parameters:

- `PLACES_MAX_WIDTH_PX` (default `1200`)
- `PLACES_MAX_HEIGHT_PX` (default `800`)

Recommended values are **1200x800**. These defaults are applied unless overridden by passing `maxWidthPx` and `maxHeightPx` to the function.

