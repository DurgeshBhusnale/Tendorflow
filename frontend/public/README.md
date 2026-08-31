# `public/`

Files here are served from the site root and copied verbatim into `dist/` at build
time. Use it only for assets that must keep a stable URL; anything imported from
`src/` should live in `src/` so Vite can hash and bundle it.

## `login-bg.svg`

The brand artwork behind the editorial half of the sign-in page. Referenced by the
`.login-backdrop` rule in `src/index.css` as `/login-bg.svg`.

That rule also paints a navy gradient underneath matching the artwork's own wash, so
if the file is ever missing the panel degrades to the gradient rather than showing a
broken image.
