# Pakistan Bill Calculator — README

Static HTML + CSS + vanilla JavaScript. No build step, no framework, no database.

## What is in the ZIP / folder
- `site/` — the complete website. Upload this folder's **contents** to your host.
- `build.py` — the generator that built `site/` from the templates in this file. Re-run `python3 build.py` after editing templates.
- `CONTENT-CHECKLIST.md`, `KEYWORDS.md` — launch checklists.

## IMPORTANT — before launch: fill the tariff rates
Every rate in `site/data/tariffs.json` is currently `"VERIFY_RATE"` on purpose.
No official number has been invented. Until you fill them, company calculators
show the slab structure and **no total** — that is intentional.

1. Get the current official tariff for a company from NEPRA / OGRA or the
   company's official tariff page (not from a blog).
2. Open `site/data/tariffs.json`, find the company, and replace each
   `"VERIFY_RATE"` with a number (PKR, no commas, no currency symbol).
   Example: `"rate": 28.5` — not `"rate": "Rs 28.5"`.
3. Update that company's `last_updated` to today's date and check its
   `source_url`.
4. Add a row to the Tariff Update Log page (`site/tariff-update-log/index.html`)
   with the date, company and official source.
5. Redeploy. The calculator reads `tariffs.json`, so no JavaScript change is needed.
6. Only after a company's rates are numeric should you describe its total as a
   verified estimate. Keep the disclaimer on every page regardless.

The optional "my own rate" field lets a visitor estimate from a rate on their
own bill. That result is always labelled user-entered, never official.

## How to add a new company page (e.g. PTCL, Phase 2)
1. Add the company to `build.py`'s `COMPANIES` list (id, names, region, official
   and bill-check URLs, keywords) and to `build_tariffs()` with its categories.
2. Add its page path to the hub it belongs to (create a new hub in `HUBS` if needed).
3. Run `python3 build.py` — sitemap, llms.txt and related-calculator links regenerate.
4. Write or review its FAQs: do not copy another company's FAQs word for word.
5. Fill its rates from an official source (see above) and log the update.

## Deploy
### Cloudflare Pages
1. Cloudflare Dashboard → Pages → Create → Upload assets (or connect Git).
2. Upload the **contents of `site/`** (not the `site` folder itself).
3. Set the custom domain, then replace `SITE_URL` in `build.py` with that domain,
   re-run `python3 build.py`, and redeploy so sitemap/canonical URLs are correct.

### Netlify
1. Netlify → Add new site → Deploy manually → drag the `site/` folder contents.
   Or connect Git and set Publish directory to `site/` (no build command).
2. Add the custom domain in Netlify, then update `SITE_URL` as above and redeploy.

### Any static host / cPanel
Upload the contents of `site/` to `public_html/` (or the host's web root).
No server code is needed. Serve over https. If you open files with `file://`,
`fetch('/data/tariffs.json')` will fail — always test over http(s).

## Submit the sitemap to Google Search Console
1. In Search Console, add the property in the format you use for every site:
   `https://www.<your-domain>/` (www URL-prefix format).
2. Verify ownership by the method Search Console offers (DNS or HTML file).
3. Go to Sitemaps → enter `sitemap.xml` → Submit.
4. Use URL Inspection to request indexing for the home page and one company page
   first, then let Google discover the rest from the sitemap and internal links.
5. Check Coverage / Core Web Vitals after a few days, and fix any page it flags.
   Re-submit the sitemap after every tariff or content update that changes URLs.

## Performance notes
- One small CSS file, one small JS file, system fonts, no external requests.
- Images: none by default, so there is no image weight. If you add images, use
  small WebP files with width/height attributes and `loading="lazy"`.
- Do not add a heavy framework, chat widget or popups without re-testing
  Lighthouse on mobile — the 95+ target depends on keeping the page light.

## Urdu / Roman Urdu versions (future)
The HTML is structured for translation: add a parallel folder per language
(e.g. `/ur/...`) with the same page paths, add `hreflang` link tags in the
`<head>` of each version, and list both versions in `sitemap.xml`. Do not
machine-translate tariff terms without a human check.
