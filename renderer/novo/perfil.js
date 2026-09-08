// Perfil: nome, @usuário e foto. Vive em S.config (sincroniza com a conta) e
// aparece na barra lateral, no cabeçalho e nas Configurações.
(() => {
  const D = window.Dados; const S = D.S;
  const $ = (id) => document.getElementById(id);

  const nomeDe = () => (S.config.nome && S.config.nome !== 'você') ? S.config.nome : '';
  const usuarioDe = () => String(S.config.usuario || '').replace(/^@/, '');

  function pintarAvatar(el, nome) {
    if (!el) return;
    const foto = S.config.foto || '';
    el.classList.toggle('foto', !!foto);
    el.style.backgroundImage = foto ? `url(${foto})` : '';
    el.textContent = foto ? '' : (nome || 'v')[0].toUpperCase();
  }
  function render() {
    const nome = nomeDe(), user = usuarioDe();
    const conta = window.Conta && window.Conta.usuario;
    for (const el of document.querySelectorAll('.sb-usuario .avatar, .avatar-btn, #pfAvatar')) pintarAvatar(el, nome || (conta ? conta.email : ''));
    const b = document.querySelector('.sb-usuario-txt b'), s = document.querySelector('.sb-usuario-txt small');
    if (b) b.textContent = nome || (conta ? conta.email.split('@')[0] : 'você');
    if (s) s.textContent = conta ? conta.email : (user ? '@' + user : 'só neste PC');
    const marca = document.querySelector('.sb-marca-txt small');
    if (marca) marca.textContent = user ? '@' + user : (nome || 'seu espaço');
    if ($('pfNome') && document.activeElement !== $('pfNome')) $('pfNome').value = nome;
    if ($('pfUsuario') && document.activeElement !== $('pfUsuario')) $('pfUsuario').value = user ? '@' + user : '';
    if ($('pfFotoTirar')) $('pfFotoTirar').hidden = !S.config.foto;
  }

  // a foto fica pequena (192px, jpeg) pra caber no estado e na nuvem sem peso
  function reduzirFoto(dataURL, lado = 192) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const cv = document.createElement('canvas'); cv.width = cv.height = lado;
        const ctx = cv.getContext('2d');
        const escala = Math.max(lado / img.width, lado / img.height);
        const w = img.width * escala, h = img.height * escala;
        ctx.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h);
        resolve(cv.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => resolve('');
      img.src = dataURL;
    });
  }

  function montar() {
    $('pfNome').onchange = () => { S.config.nome = $('pfNome').value.trim() || 'você'; D.gravar(); render(); };
    $('pfUsuario').onchange = () => { const u = $('pfUsuario').value.trim().replace(/^@/, '').replace(/\s+/g, ''); S.config.usuario = u ? '@' + u : ''; D.gravar(); render(); };
    $('pfFoto').onchange = (e) => {
      const f = e.target.files[0]; e.target.value = ''; if (!f) return;
      const leitor = new FileReader();
      leitor.onload = async () => { const foto = await reduzirFoto(leitor.result); if (!foto) return; S.config.foto = foto; await D.gravar(); render(); };
      leitor.readAsDataURL(f);
    };
    $('pfFotoTirar').onclick = () => { S.config.foto = ''; D.gravar(); render(); };
    window.addEventListener('estado:trocou', render);
    render();
  }
  window.Perfil = { montar, render };
})();
