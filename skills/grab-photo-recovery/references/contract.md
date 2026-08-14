# Grab photo recovery contract

## Accepted sources

Use sources owned or explicitly supplied by the merchant, in this order:

1. A copied JSON response body from the authenticated GrabMerchant catalogue.
2. An official GrabFood Partner API menu payload.
3. A Chrome `Export HAR (sanitized)` file when a response body cannot be copied.

Never scrape the consumer GrabFood storefront. Never read, export, replay, or store portal
cookies, passwords, OTPs, authorization headers, request bodies, or browser profile data.

## Official menu shape

Treat `categories[].items[]` as the authoritative subtree. An item may contain:

```json
{
  "id": "THITE...",
  "name": "Dish name",
  "photos": ["https://merchant-cdn.example/image.webp"],
  "availableStatus": "AVAILABLE"
}
```

Allow ordinary response wrappers such as `data`, `result`, and `menu`. Do not collect URLs
from arbitrary JSON strings. The documented Partner API currently supports one photo per item.

## HAR handling

Accept only JSON response bodies from successful GET requests. Support raw and base64-encoded
`response.content.text`. Reject the whole HAR when it contains `Cookie`, `Set-Cookie`, or
`Authorization` fields. Do not replay captured requests. Ignore headers, cookies, query-string
records, and post bodies.

## URL and file safety

- Discover exact image hosts before downloading; do not assume a Grab CDN hostname.
- Require explicit approval for every exact host. Do not accept wildcard hosts.
- Allow HTTPS only. Reject IP literals, localhost, private, loopback, and link-local targets.
- Revalidate the host after every redirect and permit no more than three redirects.
- Do not print or persist signed URL query strings.
- Accept JPEG, PNG, or WebP only. Verify Content-Type, file magic, decoded dimensions, and size.
- Keep recovered bytes outside `public/` and Git until review is complete.

## Mapping and provenance

Map a photo only through `scripts/data/grab-item-map.json.items[grabItemId]`. Never fall back to
names, OCR, visual similarity, or array order. Quarantine duplicates, missing IDs, unmapped IDs,
and ambiguous primary images.

Record the source hash, decoded MIME and dimensions, ItemID, dish filename, and owner visual
confirmation. If ChatGPT generated the pixels, record `ai-generated`; do not claim
`owner-original` and do not present the image as a photograph of the served dish. Presence in the
merchant's Grab account proves storage provenance, not that the image depicts the real dish.

As between the ChatGPT user and OpenAI, current OpenAI terms assign Output to the user to the
extent permitted by law, but the user remains responsible for the output and third-party rights.
This does not turn generated pixels into documentary food photography.

## Approval boundary

Discovery and recovery may write only to the connector's ignored staging directory. Publishing
requires a separate explicit decision, owner confirmation of exact ItemID-to-image identity,
provenance label, rights and people/consent review, and a patch that changes only the target
dish's `images` array plus approved derivatives in `public/uploads/dishes/`. The site schema
supports visibly labelled `ai-generated` dish illustrations, but support in the schema is not
publication permission. Preserve all editorial fields and the ItemID map byte-for-byte.
