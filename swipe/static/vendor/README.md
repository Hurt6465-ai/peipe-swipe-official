# Swiper files

Put these two files here before building NodeBB if you want fully local Swiper assets:

- `swiper-bundle.min.js`
- `swiper-bundle.min.css`

Public URLs after plugin install:

- `/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.js`
- `/plugins/nodebb-plugin-peipe-partners/swipe/vendor/swiper-bundle.min.css`

The client first tries local files. If they are missing, it tries the jsDelivr CDN. If both are unavailable, the page still falls back to native CSS scroll-snap, but the best touch experience requires Swiper.
