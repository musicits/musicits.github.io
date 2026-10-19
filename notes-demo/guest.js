(() => {
  const PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';
  const G = window.__GUEST__;

  const cover = document.createElement('div');
  cover.id = 'guest-cover';
  cover.innerHTML = '<div><img src="logo-light.png" alt="music ITs"><p>게스트판을 준비하고 있어요</p><small>처음 한 번은 몇 초 걸려요</small></div>';
  const pill = document.createElement('div');
  pill.id = 'guest-pill';
  pill.innerHTML = '게스트판 · 저장 안 됨 <a href="https://tools.musicits.com/ai/">← 돌아가기</a>';
  const style = document.createElement('style');
  style.textContent = `
    #guest-cover{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#F3F0EA;color:#17130E;font:15px/1.5 "Pretendard Variable",system-ui,sans-serif;text-align:center}
    #guest-cover img{width:180px;margin-bottom:14px}
    #guest-cover p{margin:0;font-weight:700}
    #guest-cover small{color:#675E52}
    #guest-pill{position:fixed;left:max(12px,env(safe-area-inset-left,0px));bottom:max(12px,env(safe-area-inset-bottom,0px));z-index:9998;font:12px/1.4 "Pretendard Variable",system-ui,sans-serif;background:#14110E;color:#F2ECE2;padding:6px 12px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.18);opacity:.92;white-space:nowrap}
    #guest-pill a{color:#E6A94A;text-decoration:none;margin-left:8px}`;
  const mount = () => { document.head.append(style); document.body.append(cover, pill); };
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);

  const ready = (async () => {
    const py = await loadPyodide({indexURL: PYODIDE});
    for (const [path, text] of Object.entries(G.files)) {
      py.FS.mkdirTree(path.slice(0, path.lastIndexOf('/')));
      py.FS.writeFile(path, text);
    }
    py.runPython(G.router);
    return py.globals.get('handle');
  })();
  ready.then(() => cover.remove(), (e) => {
    cover.querySelector('p').textContent = '게스트판을 열지 못했어요';
    cover.querySelector('small').textContent = '새로고침해 보세요 (' + e.message + ')';
  });

  const realFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init);
    const handle = await ready;
    const method = (init.method || 'GET').toUpperCase();
    let body = null;
    if (typeof init.body === 'string') body = init.body;
    else if (init.body != null) {
      return new Response(JSON.stringify({error: '게스트판에서는 파일을 넣을 수 없어요'}), {status: 400, headers: {'Content-Type': 'application/json'}});
    }
    const dev = (init.headers && init.headers['X-Device']) || '';
    const out = JSON.parse(handle(method, url.pathname.slice(5), JSON.stringify(Object.fromEntries(url.searchParams)), body, dev));
    return new Response(JSON.stringify(out.data), {status: out.status, headers: {'Content-Type': 'application/json'}});
  };
})();
