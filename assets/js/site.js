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

  /* ────────── Unidades: escolher uma e vê-la no mapa ────────── */

  // Sem este trecho a seção continua inteira: o mapa já está desenhado, os
  // endereços estão em texto e os links de rota e de WhatsApp funcionam. O que
  // se acrescenta aqui é só o destaque — nenhuma requisição, nenhum
  // armazenamento, nenhum horário reservável.
  var secaoUnidades = document.getElementById('unidades');

  if (secaoUnidades) {
    var pinos = secaoUnidades.querySelectorAll('.mapa__pino[data-unidade]');
    var escolhas = secaoUnidades.querySelectorAll('.unidade__escolher[data-unidade]');
    var cartoes = secaoUnidades.querySelectorAll('[data-unidade-cartao]');
    var aviso = secaoUnidades.querySelector('.unidades__status');
    var selecionada = null;

    var cartaoDe = function (id) {
      for (var i = 0; i < cartoes.length; i += 1) {
        if (cartoes[i].getAttribute('data-unidade-cartao') === id) return cartoes[i];
      }
      return null;
    };

    var nomeDe = function (id) {
      var cartao = cartaoDe(id);
      var nome = cartao && cartao.querySelector('.unidade__nome');
      return nome ? nome.textContent.trim() : '';
    };

    var marcar = function (lista) {
      Array.prototype.forEach.call(lista, function (elemento) {
        var alvo = elemento.getAttribute('data-unidade');
        elemento.setAttribute('aria-pressed', String(alvo === selecionada));
      });
    };

    var destacar = function (id, vindoDoMapa) {
      // Escolher a unidade já destacada desfaz a seleção e volta à visão geral.
      selecionada = selecionada === id ? null : id;

      marcar(pinos);
      marcar(escolhas);
      Array.prototype.forEach.call(cartoes, function (cartao) {
        var alvo = cartao.getAttribute('data-unidade-cartao');
        if (alvo === selecionada) cartao.setAttribute('data-selecionada', 'true');
        else cartao.removeAttribute('data-selecionada');
      });

      if (aviso) {
        aviso.textContent = selecionada
          ? nomeDe(selecionada) + ' em destaque no mapa.'
          : '';
      }

      // Quem clicou no pino está olhando o mapa: leva o cartão até ele.
      if (selecionada && vindoDoMapa) {
        var cartao = cartaoDe(selecionada);
        if (cartao && cartao.scrollIntoView) {
          cartao.scrollIntoView({
            block: 'nearest',
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
          });
        }
      }
    };

    Array.prototype.forEach.call(pinos, function (pino) {
      pino.addEventListener('click', function () {
        destacar(pino.getAttribute('data-unidade'), true);
      });
    });

    Array.prototype.forEach.call(escolhas, function (botao) {
      botao.addEventListener('click', function () {
        destacar(botao.getAttribute('data-unidade'), false);
      });
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && selecionada) destacar(selecionada, false);
    });
  }

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
