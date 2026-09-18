// music ITs 도구 공통 머리말 — 로고·도구 이름 링크와 오른쪽 단추 묶음.
//
// 단일 HTML 로 만든 도구(폰 목업 스튜디오 · 매거진 커버 메이커 · 사진기능사)가
// 이 파일 하나를 불러 씁니다. 도구가 늘거나 이름이 바뀌면 여기만 고치면 됩니다.
// 코덱 매치는 React 로 같은 것을 그리므로 이 파일을 부르지 않습니다.
//
//   <meta name="musicits-tool" content="phone-mockup-studio">
//   <script src="/shared/topbar.js" defer></script>
(() => {
  const HUB = 'https://tools.musicits.com/'
  const BLOG = 'https://blog.naver.com/musicits'

  const TOOLS = [
    { id: 'codec-match', name: '코덱 매치',
      tagline: '내 폰과 이어폰은 어떤 코덱으로 연결될까',
      url: HUB + 'codec-match/', icon: 'codec' },
    { id: 'phone-mockup-studio', name: '폰 목업 스튜디오',
      tagline: '스크린샷을 아이폰·갤럭시 목업에 넣어 PNG 로',
      url: HUB + 'phone-mockup-studio/', icon: 'phone' },
    { id: 'magazine-cover-maker', name: '매거진 커버 메이커',
      tagline: '사진을 끌어다 놓으면 바로 잡지 표지로',
      url: HUB + 'magazine-cover-maker/', icon: 'cover' },
    { id: 'photo-exam', name: '사진기능사 필기 예상문제',
      tagline: '예상문제 398문항 · 60분 모의고사',
      url: HUB + 'photo-exam/', icon: 'exam' },
  ]

  const ICONS = {
    codec: '<path d="M4 12h3l2.5-6 3 12 2.5-6H20"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 5h3"/>',
    cover: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h5"/>',
    exam: '<rect x="4.5" y="3.5" width="15" height="17" rx="2.5"/><path d="m8.5 11.5 2 2 4.5-4.5"/>',
  }

  const line = (body) =>
    `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none"
      stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`

  const header = document.querySelector('header')
  if (!header || header.querySelector('.toolswitch')) return

  const self = document.querySelector('meta[name="musicits-tool"]')?.content ?? ''
  const me = TOOLS.find((tool) => tool.id === self)

  // 1) 로고 → 도구 모음 첫 화면
  const logo = header.querySelector('img')
  if (logo && !logo.closest('a')) {
    const link = document.createElement('a')
    link.className = 'logo-link'
    link.href = HUB
    link.setAttribute('aria-label', 'music ITs 도구 모음')
    logo.replaceWith(link)
    link.append(logo)
  }

  // 2) 도구 이름 → 그 도구 첫 화면
  const title = header.querySelector('h1, .name')
  if (me && title && !title.querySelector('a')) {
    title.innerHTML = `<a href="${me.url}">${title.textContent.trim()}</a>`
  }

  // 3) 오른쪽 묶음 — 없으면 만들고, 이미 있던 단추(테마·도움말)는 그대로 오른쪽에 둡니다
  let right = header.querySelector('.right, .topbar__right')
  if (!right) {
    right = document.createElement('div')
    right.className = 'topbar__right'
    const keep = [...header.children].filter((el) => el.tagName === 'BUTTON' || el.id === 'theme')
    header.append(right)
    keep.forEach((el) => right.append(el))
    header.querySelectorAll('.sp').forEach((el) => el.remove())
  }

  const blog = document.createElement('a')
  blog.className = 'topbar__blog'
  blog.href = BLOG
  blog.target = '_blank'
  // rel 에 noreferrer 를 넣지 않습니다 — 블로그 유입 통계에 출처가 안 잡힙니다
  blog.rel = 'author noopener'
  blog.textContent = '블로그'

  const box = document.createElement('div')
  box.className = 'toolswitch'
  box.innerHTML = `
    <button type="button" class="toolswitch__btn" aria-expanded="false" aria-haspopup="menu">
      <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor">
        <circle cx="6" cy="6" r="1.7"/><circle cx="12" cy="6" r="1.7"/><circle cx="18" cy="6" r="1.7"/>
        <circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>
        <circle cx="6" cy="18" r="1.7"/><circle cx="12" cy="18" r="1.7"/><circle cx="18" cy="18" r="1.7"/>
      </svg>
      도구
    </button>`

  const menu = document.createElement('div')
  menu.className = 'toolswitch__menu'
  menu.setAttribute('role', 'menu')
  menu.innerHTML =
    `<p class="toolswitch__label">music ITs 도구<span>${TOOLS.length}</span></p>` +
    TOOLS.map((tool) => {
      const here = tool.id === self
      return `<a href="${tool.url}" class="toolswitch__item${here ? ' on' : ''}" role="menuitem"
        ${here ? 'aria-current="page"' : ''}>${line(ICONS[tool.icon])}
        <span><b>${tool.name}</b><em>${tool.tagline}</em></span>
        ${here ? '<span class="toolswitch__here">지금 보는 중</span>' : ''}</a>`
    }).join('') +
    `<a href="${HUB}" class="toolswitch__home" role="menuitem">
      ${line('<path d="M4 10.5 12 4l8 6.5"/><path d="M6 10v9.5h12V10"/>')}도구 모음 첫 화면</a>`

  right.prepend(box)
  right.prepend(blog)

  const btn = box.querySelector('.toolswitch__btn')
  const close = () => { menu.remove(); btn.setAttribute('aria-expanded', 'false') }
  btn.addEventListener('click', () => {
    if (menu.isConnected) { close(); return }
    box.append(menu)
    btn.setAttribute('aria-expanded', 'true')
  })
  document.addEventListener('pointerdown', (event) => {
    if (menu.isConnected && !box.contains(event.target)) close()
  })
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close() })
})()
