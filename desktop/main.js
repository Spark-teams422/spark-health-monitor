// Desktop wrapper: shows the same web build (../dist, copied into the package) in its own window. The web code is not changed.
const { app, BrowserWindow, protocol, net, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

// app:// instead of file:// so fetch() of hologram.json/.bin and localStorage work as on the website
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'dist')

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname) || '/'
    const file = path.normalize(path.join(ROOT, rel === '/' ? 'index.html' : rel))
    if (!file.startsWith(ROOT)) return new Response('Not found', { status: 404 }) // no path escape
    return net.fetch(pathToFileURL(file).toString())
  })
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1280, minHeight: 720,
    backgroundColor: '#05070a', title: 'Astronaut Health Monitor', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // links to other sites open in the normal browser, not inside the app
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' } })
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); shell.openExternal(url) } })
  win.loadURL('app://monitor/')
})
app.on('window-all-closed', () => app.quit())
