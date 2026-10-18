/* ============================================================================
   EEGLife — comportamento do site.

   Princípios:
     · O site funciona inteiro sem JavaScript. Este arquivo só melhora o que já
       funciona: a navegação já está no HTML e as perguntas frequentes já abrem,
       porque usam <details>.
     · Nenhum rastreamento, nenhuma requisição a terceiros, nenhum cookie.
       A política de privacidade afirma isso — este arquivo precisa continuar
       cumprindo.
     · Sem dependências.
   ========================================================================= */

(function () {
  'use strict';

  /* ───────────────── Navegação no celular ───────────────── */

  var cabecalho = document.querySelector('[data-cabecalho]');
  var nav = cabecalho && cabecalho.querySelector('#nav-principal');
  var toggle = cabecalho && cabecalho.querySelector('[data-nav-toggle]');

  if (cabecalho && nav && toggle) {
    var abrir = function (estado) {
      cabecalho.classList.toggle('is-aberto', estado);
      toggle.setAttribute('aria-expanded', String(estado));
      toggle.querySelector('[data-nav-rotulo]').textContent = estado
        ? 'Fechar'
        : 'Menu';
    };

    toggle.addEventListener('click', function () {
      abrir(!cabecalho.classList.contains('is-aberto'));
    });

    // Navegar fecha o painel (links internos na mesma página não recarregam).
    nav.addEventListener('click', function (evento) {
      if (evento.target.closest('a')) abrir(false);
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && cabecalho.classList.contains('is-aberto')) {
        abrir(false);
        toggle.focus();
      }
    });

    // Clique fora fecha.
    document.addEventListener('click', function (evento) {
      if (
        cabecalho.classList.contains('is-aberto') &&
        !cabecalho.contains(evento.target)
      ) {
        abrir(false);
      }
    });

    // Voltar ao desktop com o painel aberto não deve deixar estado preso.
    var larga = window.matchMedia('(min-width: 1001px)');
    var aoMudar = function (consulta) {
      if (consulta.matches) abrir(false);
    };
    if (larga.addEventListener) larga.addEventListener('change', aoMudar);
    else if (larga.addListener) larga.addListener(aoMudar);
  }

  /* ──────────── Pergunta aberta por link direto ──────────── */

  // Permite compartilhar o link de uma dúvida específica: /perguntas-frequentes/#faq-...
  var abrirPorHash = function () {
    var hash = window.location.hash;
    if (!hash || hash.length < 2) return;
    var alvo;
    try {
      alvo = document.querySelector(hash);
    } catch (erro) {
      return; // hash que não é seletor válido
    }
    if (!alvo) return;
    var item = alvo.closest ? alvo.closest('details') : null;
    if (item) item.open = true;
  };

  abrirPorHash();
  window.addEventListener('hashchange', abrirPorHash);

  /* ───────── Indica a seção atual na navegação ──────────── */

  // Na home, destaca o item do menu correspondente à seção visível. É um
  // detalhe de orientação; se o navegador não suportar, nada acontece.
  if (
    'IntersectionObserver' in window &&
    document.body.classList.contains('pagina-home')
  ) {
    var secoes = Array.prototype.slice.call(
      document.querySelectorAll('main section[id]')
    );
    if (secoes.length) {
      var observador = new IntersectionObserver(
        function (entradas) {
          entradas.forEach(function (entrada) {
            if (!entrada.isIntersecting) return;
            var id = entrada.target.id;
            document
              .querySelectorAll('#nav-principal a[href^="/#"]')
              .forEach(function (link) {
                var atual = link.getAttribute('href') === '/#' + id;
                if (atual) link.setAttribute('aria-current', 'true');
                else if (link.getAttribute('aria-current') === 'true')
                  link.removeAttribute('aria-current');
              });
          });
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      secoes.forEach(function (secao) {
        observador.observe(secao);
      });
    }
  }
})();
