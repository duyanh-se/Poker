# Production assets: Secret Party

Generated using built-in `image_gen.imagegen`, with `design-concept.png` as style reference. No fallback CLI was used. Original PNGs copied into the project with alpha preserved; no creative processing outside imagegen.

| Asset                       | Saved path                              | Dimensions       |
| --------------------------- | --------------------------------------- | ---------------- |
| Neutral avatar atlas, 4 × 3 | `apps/web/public/white-hat/avatars.png` | 1448 × 1086 RGBA |
| White hat mascot            | `apps/web/public/white-hat/mascot.png`  | 1254 × 1254 RGBA |

Next Image handles runtime responsive image optimization. Avatars are assigned by public roster position, never role or word, and reuse the same atlas in board/history/chat.

## Local font

Nunito Sans variable font, Latin and Vietnamese subsets, is self-hosted in `apps/web/public/white-hat/nunito-latin.woff2` and `nunito-vietnamese.woff2`. CSS uses the isolated family `White Hat Nunito`; other games retain their fonts. The unmodified OFL license is saved as `apps/web/public/white-hat/NunitoSans-OFL.txt`.

Official sources: [font metadata](https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/METADATA.pb), [Google Fonts CSS](https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400..900&display=swap), [license](https://raw.githubusercontent.com/google/fonts/main/ofl/nunitosans/OFL.txt).

## avatars

```text
Use case: stylized-concept. Production game asset, not a UI mockup. Use the attached Secret Party design ONLY as a style reference for its charming polished 3D cartoon human portraits. Create a sprite atlas of EXACTLY TWELVE different friendly, expressive young-adult characters, head and shoulders, arranged in EXACTLY 4 equal columns by 3 equal rows. Target image aspect ratio 4:3 (2048x1536), each of the 12 cells square and exactly equal size, no gutters. Each character centered in their cell, with safe transparent padding; no portrait crosses its own cell boundary. Diverse hairstyles, glasses, accessories, colorful casual outfits: cobalt hoodie, sunny beanie, coral sweater, navy headphones, mint jacket, lavender cardigan, orange cap, round glasses, wavy hair, curly hair, short hair, tied hair. Warm natural skin tones, happy confident expressions, toy-like 3D volume, soft studio lighting, smooth material. All characters have the same rendering style and scale. Transparent background around each portrait; NO cell frames, borders, circles, backgrounds, shadows outside the portrait, UI, labels, letters, numbers, logos, role icons, spy masks, weapons, or wide-brim white hats. These are neutral player identities completely unrelated to hidden roles. Sharp clean cutout edges.
```

## mascot

```text
Use case: stylized-concept. Production game mascot cutout, not a UI mockup. Use the attached Secret Party design ONLY as a style reference. Create ONE adorable white-hat mascot: a round white toy-like face/body wearing an oversized soft white fedora with cobalt blue band, friendly large dark eyes, happy smile and rosy cheeks, small white mitten hands, one hand waving. Three-quarter front view, full mascot entirely visible including hat brim and arms, no cropping. A few tiny coral and sunny-yellow confetti pieces close beside it, but keep a clean simple silhouette. Polished charming 3D cartoon render, soft studio lighting, white porcelain/clay texture, rich cobalt blue accents, cheerful party-game feeling for a group of friends. Centered on truly transparent background, no cast floor shadow, no floor, no text, no UI, no logos, no other characters. Generous transparent margin, square composition.
```
