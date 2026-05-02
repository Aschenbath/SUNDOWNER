### 2026-05-02 01:24 Asia/Shanghai

- Finished the standard `Add to album` modal data wiring in `js/media-library/app.js`. The redesigned modal UI was already rendering correctly, but the non-preview render path still passed plain album-name arrays (`getDialogAlbumNames(...)` / `getAvailableAlbumNames(...)`) into `AlbumDialog(...)`, while the new sheet expects richer entry objects (`name`, `itemCount`, `coverUrl`, `scope`, `selected`). That mismatch produced the live `No items` rows instead of real albums.
- Both standard modal render call sites now pass `getDialogAlbumEntries(...)`, so the non-preview sheet receives the same album-entry structure as the preview drawer and can render real covers + counts.
- Bumped `index.html` media-library cache bust from `app.js?v=176` to `app.js?v=177` so the corrected dialog data flow is visible immediately after refresh.
- **Validation**: `D:\DevTools\nvm\v24.11.1\node.exe --check js\media-library\app.js`; `D:\DevTools\nvm\v24.11.1\node.exe --check js\media-library\components.js`; `D:\DevTools\nvm\v24.11.1\node.exe --check test\previewActions.test.js`; `D:\DevTools\nvm\v22.14.0\node.exe .\node_modules\mocha\bin\mocha.js .\test\previewActions.test.js` (`70 passing`).

