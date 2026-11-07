# Community proposal cover images

## Current set: nine themed covers

Built-in Imagegen produced the nine standalone illustrations below. They are served as 720 × 480 WebP files under `assets/images/feedback/motif-01.webp` through `motif-09.webp`. The form shows these nine and a “Kein Bild” option. Seeded example cards cycle through the same set. Images previously attached to proposals are stored separately.

Shared prompt:

> Use case: illustration-story. Create a single landscape cover image for a proposal card on a German health navigator website. Match a simple Cloudflare FLUX editorial paper-cut illustration: flat layered cut-paper shapes, matte muted powder blue and warm cream, tiny pale amber accents, a uniform pale blue or off-white background, minimal subtle shadow, restrained fine outlines where useful. Friendly and calm, spare and immediately readable at thumbnail size. Center all essential objects within the middle 65 percent for landscape cropping. Full bleed single scene, no border, text, letters, numbers, branding, framing card, plant decoration or unrelated objects.

Subjects appended in file order:

1. Two healthcare practitioners in simple blue and cream clothing beside a small stethoscope icon, diverse adults, friendly and professional.
2. A therapist guiding a seated adult through a gentle hand exercise, with a small therapy checklist nearby.
3. A simplified human silhouette next to a magnifying glass and a short symptom checklist with three dot markers.
4. A small modern healthcare practice building with a welcoming doorway and a restrained blue medical cross sign.
5. A cream invoice with a single euro symbol beside two small blue and warm amber coin stacks.
6. A folded pale blue map with two distinct location pins and a dotted route between them, representing travel distance.
7. A desktop monitor showing a healthcare practitioner's avatar in a video call, with a small video camera icon.
8. A desk calendar with one selected appointment square next to a small clock.
9. Two overlapping blue and cream speech bubbles above a small review card with three simple star icons, representing shared experiences.

## Previous placeholder set



20 decorative AI-generated placeholder covers, `assets/images/feedback/idea-01.webp` through `idea-20.webp`.

Generated with the built-in Imagegen tool on 2026-11-06. The original contact sheet is retained at `output/feedback-illustrations-contact-sheet.png`. Individual cells were extracted, with 2 pixels trimmed at each edge to remove grid seams, and encoded as WebP (quality 88). These are intentionally generic dummy illustrations, not medical content or category indicators.

## Generation prompt

Create a production asset contact sheet of EXACTLY 20 separate editorial illustrations, arranged in a precise edge-to-edge regular grid: 4 columns and 5 rows. Landscape individual tiles, entire canvas portrait 1536x1280 or similar 6:5 ratio so each tile ~384x256. Every tile fills its cell fully, no gutters, no frames, NO TEXT, no numbers, no labels. These are placeholder cover images for Long Covid Navigator community suggestion cards. Consistent sophisticated tactile cut paper / soft dimensional illustration style, soft cream backgrounds, muted medium blue, pale cyan and sage, small warm apricot accents. Calm friendly visual richness, subtle paper grain, gentle shadows, uncluttered, each central subject entirely within middle 70% of its cell for cropping. Absolutely no letters logos words or watermarks. Subjects row-major: 1 clipboard and receipt with blank lines, 2 magnifying glass over organic landscape, 3 two speech bubbles, 4 folded map with location pin; 5 open book, 6 calendar and small clock, 7 connected abstract nodes, 8 friendly lightbulb; 9 shield and checkmark, 10 sliders and adjustment controls, 11 compass, 12 stepping stone path; 13 document folders, 14 interlocking puzzle pieces, 15 small plant growing, 16 envelope with blank card; 17 abstract helping hands, 18 bookmark and stacked papers, 19 small bridge over flowing river, 20 diverse simple geometric shapes forming circle. Each tile is one complete standalone scene, distinct yet cohesive. No medical crosses, pills, clinical photography, or people faces. Precisely 4 columns x 5 rows.

## Assignment and display

`scripts/feedback.js` uses `((id - 1) % 20) + 1` to distribute covers cyclically. The same idea keeps its image when sorting or filtering. No timer, network image-generation service, database migration, or API key is needed. Images have empty alt text and their duplicate cover links are excluded from keyboard navigation; the text title remains the accessible link.

The generated sheet contains square cells; CSS crops these into 3:2 covers. Layout uses 3 columns above 1000px, 2 through 1000px, and 1 through 600px. Background matches general.css (#f8f9fa).

Validation: `node output/check-feedback-image-cards.cjs` checks cover loading, all 20 HTTP assets, stable assignment after sorting, neutral background, 3/2/1 columns and horizontal overflow. `node tests/feedback_community.cjs` checks existing composer behavior without persisting submissions.

