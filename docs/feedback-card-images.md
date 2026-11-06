# Community proposal cover images

20 decorative AI-generated placeholder covers, `assets/images/feedback/idea-01.webp` through `idea-20.webp`.

Generated with the built-in Imagegen tool on 2026-11-06. The original contact sheet is retained at `output/feedback-illustrations-contact-sheet.png`. Individual cells were extracted, with 2 pixels trimmed at each edge to remove grid seams, and encoded as WebP (quality 88). These are intentionally generic dummy illustrations, not medical content or category indicators.

## Generation prompt

Create a production asset contact sheet of EXACTLY 20 separate editorial illustrations, arranged in a precise edge-to-edge regular grid: 4 columns and 5 rows. Landscape individual tiles, entire canvas portrait 1536x1280 or similar 6:5 ratio so each tile ~384x256. Every tile fills its cell fully, no gutters, no frames, NO TEXT, no numbers, no labels. These are placeholder cover images for Long Covid Navigator community suggestion cards. Consistent sophisticated tactile cut paper / soft dimensional illustration style, soft cream backgrounds, muted medium blue, pale cyan and sage, small warm apricot accents. Calm friendly visual richness, subtle paper grain, gentle shadows, uncluttered, each central subject entirely within middle 70% of its cell for cropping. Absolutely no letters logos words or watermarks. Subjects row-major: 1 clipboard and receipt with blank lines, 2 magnifying glass over organic landscape, 3 two speech bubbles, 4 folded map with location pin; 5 open book, 6 calendar and small clock, 7 connected abstract nodes, 8 friendly lightbulb; 9 shield and checkmark, 10 sliders and adjustment controls, 11 compass, 12 stepping stone path; 13 document folders, 14 interlocking puzzle pieces, 15 small plant growing, 16 envelope with blank card; 17 abstract helping hands, 18 bookmark and stacked papers, 19 small bridge over flowing river, 20 diverse simple geometric shapes forming circle. Each tile is one complete standalone scene, distinct yet cohesive. No medical crosses, pills, clinical photography, or people faces. Precisely 4 columns x 5 rows.

## Assignment and display

`scripts/feedback.js` uses `((id - 1) % 20) + 1` to distribute covers cyclically. The same idea keeps its image when sorting or filtering. No timer, network image-generation service, database migration, or API key is needed. Images have empty alt text and their duplicate cover links are excluded from keyboard navigation; the text title remains the accessible link.

The generated sheet contains square cells; CSS crops these into 3:2 covers. Layout uses 3 columns above 1000px, 2 through 1000px, and 1 through 600px. Background matches general.css (#f8f9fa).

Validation: `node output/check-feedback-image-cards.cjs` checks cover loading, all 20 HTTP assets, stable assignment after sorting, neutral background, 3/2/1 columns and horizontal overflow. `node tests/feedback_community.cjs` checks existing composer behavior without persisting submissions.
