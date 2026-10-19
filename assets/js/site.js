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

  /* ────────── Unidades: mini-mapa, modal e escolha do local ────────── */

  // Copia o funcionamento do mapa da SoproLife (sl-units-map.js, M26.11):
  // mini-mapa travado no card de agendamento; clicar nele abre o modal com a
  // lista das unidades e o mapa grande, com zoom, arrasto e popup. Escolher
  // uma unidade em qualquer lugar (pino, lista ou campo "Local") sincroniza
  // tudo. Nenhuma requisição, nenhum armazenamento, nenhum horário reservado.
  //
  // Sem este trecho a seção continua útil: a lista e o mapa aparecem lado a
  // lado, com os endereços em texto e os links de rota e WhatsApp.
  var secaoUnidades = document.getElementById('unidades');

  if (secaoUnidades) {
    var semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
    var escolhas = secaoUnidades.querySelectorAll('.unidade__escolher[data-unidade]');
    var cartoes = secaoUnidades.querySelectorAll('[data-unidade-cartao]');
    var aviso = secaoUnidades.querySelector('.unidades__status');
    var campoLocal = document.getElementById('agendar-local');
    var selecionada = null;
    var aoMudarSelecao = null;

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

    /* ── Um mapa: zoom, enquadramento e (no grande) arrasto e pinça ──
       A camada (desenho + pinos) recebe translate + scale; o quadro recorta.
       Os pinos compensam a escala (--z no CSS) e ficam sempre do mesmo
       tamanho, presos à coordenada. */
    var ZOOM_MAX = 6;
    var ZOOM_UNIDADE = 3.2; // "zoom de bairro", como o nível 14 da SoproLife

    var criarMapa = function (figura) {
      var quadro = figura.querySelector('.mapa__quadro');
      var camada = figura.querySelector('[data-mapa-camada]');
      var pinos = figura.querySelectorAll('.mapa__pino[data-unidade]');
      var vista = { z: 1, x: 0, y: 0 };

      var pinoDe = function (id) {
        for (var i = 0; i < pinos.length; i += 1) {
          if (pinos[i].getAttribute('data-unidade') === id) return pinos[i];
        }
        return null;
      };

      var posicao = function (pino) {
        return {
          x: parseFloat(pino.style.left) / 100,
          y: parseFloat(pino.style.top) / 100
        };
      };

      var aplicar = function () {
        var largura = quadro.clientWidth;
        var altura = quadro.clientHeight;
        vista.z = Math.min(ZOOM_MAX, Math.max(1, vista.z));
        vista.x = Math.min(0, Math.max(largura - largura * vista.z, vista.x));
        vista.y = Math.min(0, Math.max(altura - altura * vista.z, vista.y));
        camada.style.transform =
          'translate(' + vista.x + 'px,' + vista.y + 'px) scale(' + vista.z + ')';
        quadro.style.setProperty('--z', String(vista.z));
        quadro.classList.toggle('is-zoom', vista.z > 1.01);
      };

      // Aproxima mantendo parado o ponto (px, py) do quadro.
      var zoomEm = function (novoZ, px, py) {
        var z = Math.min(ZOOM_MAX, Math.max(1, novoZ));
        vista.x = px - ((px - vista.x) / vista.z) * z;
        vista.y = py - ((py - vista.y) / vista.z) * z;
        vista.z = z;
        aplicar();
      };

      var centrar = function (fx, fy, z) {
        vista.z = z;
        vista.x = quadro.clientWidth / 2 - fx * quadro.clientWidth * z;
        vista.y = quadro.clientHeight / 2 - fy * quadro.clientHeight * z;
        aplicar();
      };

      // Sem escolha: enquadra todas as unidades com folga, como o fitBounds.
      var enquadrarTodas = function () {
        if (!pinos.length) return centrar(0.5, 0.5, 1);
        var xs = [], ys = [];
        Array.prototype.forEach.call(pinos, function (pino) {
          var p = posicao(pino);
          xs.push(p.x); ys.push(p.y);
        });
        var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
        var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
        var folga = 0.7; // as unidades ocupam ~70% do quadro
        var z = Math.min(folga / Math.max(maxX - minX, 0.01), folga / Math.max(maxY - minY, 0.01));
        centrar((minX + maxX) / 2, (minY + maxY) / 2, Math.min(Math.max(z, 1), ZOOM_UNIDADE));
      };

      var enquadrar = function (id) {
        var pino = id && pinoDe(id);
        if (pino) {
          var p = posicao(pino);
          centrar(p.x, p.y, Math.max(vista.z, ZOOM_UNIDADE));
        } else {
          enquadrarTodas();
        }
      };

      var marcar = function (id) {
        Array.prototype.forEach.call(pinos, function (pino) {
          pino.setAttribute('aria-pressed', String(pino.getAttribute('data-unidade') === id));
        });
      };

      var relativo = function (evento) {
        var r = quadro.getBoundingClientRect();
        return { x: evento.clientX - r.left, y: evento.clientY - r.top };
      };

      /* Interação completa, só no mapa grande (no mini, como na SoproLife,
         o mapa fica travado e o clique abre o modal). Um dedo ou o mouse
         arrastam; dois dedos pinçam; roda do mouse e duplo clique aproximam. */
      var interativo = function () {
        var ponteiros = {};
        var inicio = null;

        var lista = function () {
          return Object.keys(ponteiros).map(function (k) { return ponteiros[k]; });
        };

        quadro.addEventListener('pointerdown', function (evento) {
          if (evento.target.closest('button, a, .mapa__popup')) return;
          ponteiros[evento.pointerId] = relativo(evento);
          var atuais = lista();
          inicio = atuais.length === 2
            ? { dist: Math.hypot(atuais[0].x - atuais[1].x, atuais[0].y - atuais[1].y), z: vista.z }
            : { x: atuais[0].x, y: atuais[0].y, vx: vista.x, vy: vista.y };
          quadro.setPointerCapture(evento.pointerId);
        });

        quadro.addEventListener('pointermove', function (evento) {
          if (!(evento.pointerId in ponteiros) || !inicio) return;
          ponteiros[evento.pointerId] = relativo(evento);
          var atuais = lista();
          quadro.classList.add('is-arrastando');
          if (atuais.length === 2 && inicio.dist) {
            var dist = Math.hypot(atuais[0].x - atuais[1].x, atuais[0].y - atuais[1].y);
            zoomEm(inicio.z * (dist / inicio.dist),
              (atuais[0].x + atuais[1].x) / 2, (atuais[0].y + atuais[1].y) / 2);
          } else if (atuais.length === 1 && inicio.x !== undefined) {
            vista.x = inicio.vx + atuais[0].x - inicio.x;
            vista.y = inicio.vy + atuais[0].y - inicio.y;
            aplicar();
          }
        });

        var soltar = function (evento) {
          delete ponteiros[evento.pointerId];
          if (!lista().length) {
            inicio = null;
            quadro.classList.remove('is-arrastando');
          }
        };
        quadro.addEventListener('pointerup', soltar);
        quadro.addEventListener('pointercancel', soltar);

        quadro.addEventListener('wheel', function (evento) {
          evento.preventDefault();
          var p = relativo(evento);
          zoomEm(vista.z * (evento.deltaY < 0 ? 1.25 : 0.8), p.x, p.y);
        }, { passive: false });

        quadro.addEventListener('dblclick', function (evento) {
          if (evento.target.closest('button, a, .mapa__popup')) return;
          var p = relativo(evento);
          zoomEm(vista.z * 1.8, p.x, p.y);
        });

        var controles = figura.querySelector('[data-mapa-controles]');
        controles.hidden = false;
        controles.addEventListener('click', function (evento) {
          var botao = evento.target.closest('[data-mapa-zoom]');
          if (!botao) return;
          var fator = botao.getAttribute('data-mapa-zoom') === 'mais' ? 1.6 : 1 / 1.6;
          zoomEm(vista.z * fator, quadro.clientWidth / 2, quadro.clientHeight / 2);
        });
      };

      return {
        figura: figura,
        quadro: quadro,
        pinos: pinos,
        pinoDe: pinoDe,
        aplicar: aplicar,
        enquadrar: enquadrar,
        marcar: marcar,
        interativo: interativo
      };
    };

    var figuraMini = secaoUnidades.querySelector('[data-mapa="mini"]');
    var figuraGrande = secaoUnidades.querySelector('[data-mapa="grande"]');
    var mini = figuraMini ? criarMapa(figuraMini) : null;
    var grande = figuraGrande ? criarMapa(figuraGrande) : null;
    var mapas = [mini, grande].filter(Boolean);

    /* ── Popup no pino do mapa grande: nome, endereço, rota e WhatsApp ──
       O conteúdo é copiado do cartão da unidade, que é a fonte (e o que
       funciona sem script). */
    var popup = grande && grande.figura.querySelector('[data-mapa-popup]');
    var mostrarPopup = function (id) {
      if (!popup) return;
      var pino = id && grande.pinoDe(id);
      var cartao = id && cartaoDe(id);
      if (!pino || !cartao) {
        popup.hidden = true;
        return;
      }
      popup.replaceChildren();
      var titulo = document.createElement('strong');
      titulo.className = 'mapa__popup-titulo';
      titulo.textContent = nomeDe(id);
      popup.appendChild(titulo);
      var endereco = cartao.querySelector('.unidade__endereco');
      if (endereco) {
        var texto = document.createElement('p');
        texto.textContent = endereco.textContent.trim();
        popup.appendChild(texto);
      }
      var links = document.createElement('div');
      links.className = 'mapa__popup-links';
      Array.prototype.forEach.call(cartao.querySelectorAll('.unidade__acao'), function (link) {
        var copia = link.cloneNode(true);
        copia.removeAttribute('data-eeg-cta');
        if (copia.classList.contains('unidade__acao--wa')) copia.textContent = 'WhatsApp';
        links.appendChild(copia);
      });
      popup.appendChild(links);
      popup.style.left = pino.style.left;
      popup.style.top = pino.style.top;
      popup.hidden = false;
    };

    /* ── Seleção: pinos, lista e campo "Local" andam juntos ── */
    var selecionar = function (id, origem) {
      selecionada = id || null;
      var temPino = !!(selecionada && grande && grande.pinoDe(selecionada));

      Array.prototype.forEach.call(escolhas, function (botao) {
        botao.setAttribute('aria-pressed', String(botao.getAttribute('data-unidade') === selecionada));
      });
      Array.prototype.forEach.call(cartoes, function (cartao) {
        if (cartao.getAttribute('data-unidade-cartao') === selecionada) {
          cartao.setAttribute('data-selecionada', 'true');
        } else {
          cartao.removeAttribute('data-selecionada');
        }
      });
      mapas.forEach(function (m) {
        m.marcar(selecionada);
        m.enquadrar(temPino ? selecionada : null);
      });
      mostrarPopup(origem === 'mapa' && temPino ? selecionada : null);

      if (aviso) {
        aviso.textContent = selecionada
          ? nomeDe(selecionada) + (temPino ? ' em destaque no mapa.' : ' escolhido.')
          : 'Todas as unidades no mapa.';
      }
      if (campoLocal && origem !== 'campo') campoLocal.value = selecionada || '';

      // Quem clicou no pino está olhando o mapa: leva o cartão até ele.
      var cartaoAtual = selecionada && origem === 'mapa' && cartaoDe(selecionada);
      if (cartaoAtual && cartaoAtual.scrollIntoView) {
        cartaoAtual.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      if (aoMudarSelecao) aoMudarSelecao();
    };

    // Escolher a unidade já destacada desfaz a seleção e volta à visão geral.
    var alternar = function (id, origem) {
      selecionar(selecionada === id ? null : id, origem);
    };

    if (grande) {
      grande.interativo();
      Array.prototype.forEach.call(grande.pinos, function (pino) {
        pino.addEventListener('click', function () {
          selecionar(pino.getAttribute('data-unidade'), 'mapa');
        });
      });
    }

    Array.prototype.forEach.call(escolhas, function (botao) {
      botao.addEventListener('click', function () {
        alternar(botao.getAttribute('data-unidade'), 'lista');
      });
    });

    if (campoLocal) {
      campoLocal.addEventListener('change', function () {
        selecionar(campoLocal.value, 'campo');
      });
    }

    /* ── O modal ── */
    var modal = secaoUnidades.querySelector('[data-mapa-modal]');
    var janela = modal && modal.querySelector('.mapa-modal__janela');
    var ultimoFoco = null;

    var abrirModal = function () {
      ultimoFoco = document.activeElement;
      modal.classList.add('is-aberto');
      document.documentElement.classList.add('mapa-modal-aberto');
      // O quadro só tem tamanho depois de visível: reenquadra.
      window.requestAnimationFrame(function () {
        grande.enquadrar(selecionada);
        mostrarPopup(null);
        modal.querySelector('.mapa-modal__botao--fechar').focus();
      });
    };

    var fecharModal = function () {
      modal.classList.remove('is-aberto');
      document.documentElement.classList.remove('mapa-modal-aberto');
      if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
    };

    var modalAberto = function () {
      return modal && modal.classList.contains('is-aberto');
    };

    if (modal && janela && grande) {
      // Como na SoproLife: o modal vai para o <body> e escapa de qualquer
      // contêiner que quebre o position: fixed.
      document.body.appendChild(modal);
      modal.classList.add('is-modal');
      janela.setAttribute('role', 'dialog');
      janela.setAttribute('aria-modal', 'true');
      modal.querySelector('[data-mapa-modal-botoes]').hidden = false;

      Array.prototype.forEach.call(modal.querySelectorAll('[data-mapa-fechar]'), function (el) {
        el.addEventListener('click', fecharModal);
      });
      modal.querySelector('.mapa-modal__botoes [data-mapa-zoom="todas"]')
        .addEventListener('click', function () { selecionar(null); });

      // Foco preso na janela enquanto o modal está aberto.
      modal.addEventListener('keydown', function (evento) {
        if (evento.key !== 'Tab') return;
        var focaveis = janela.querySelectorAll('button:not([hidden]), a[href], select, input');
        var visiveis = Array.prototype.filter.call(focaveis, function (el) {
          return el.offsetParent !== null;
        });
        if (!visiveis.length) return;
        var primeiro = visiveis[0];
        var ultimo = visiveis[visiveis.length - 1];
        if (evento.shiftKey && document.activeElement === primeiro) {
          evento.preventDefault();
          ultimo.focus();
        } else if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primeiro.focus();
        }
      });

      if (mini) {
        // Como na SoproLife: o fundo do mini-mapa e o botão abrem o modal.
        mini.quadro.addEventListener('click', abrirModal);
        mini.quadro.setAttribute('title', 'Ampliar mapa das unidades');
        Array.prototype.forEach.call(mini.pinos, function (pino) {
          pino.tabIndex = -1; // o botão "Ampliar mapa" é o caminho pelo teclado
        });
      }
    }

    document.addEventListener('keydown', function (evento) {
      if (evento.key !== 'Escape') return;
      if (modalAberto()) fecharModal();
      else if (selecionada) selecionar(null);
    });

    window.addEventListener('resize', function () {
      mapas.forEach(function (m) { m.enquadrar(selecionada); });
    });
    mapas.forEach(function (m) { m.enquadrar(null); });

    /* ── Formulário de preferência → mensagem de WhatsApp ──
       Monta o texto a cada escolha e reescreve o link. Não envia nada, não
       guarda nada: quem envia é o paciente, pelo próprio WhatsApp. */
    var agendar = secaoUnidades.querySelector('[data-agendar]');

    if (agendar) {
      agendar.hidden = false;
      // O card mostra o mini-mapa; o enquadramento só vale depois de visível.
      if (mini) mini.enquadrar(null);
      var campoExame = document.getElementById('agendar-exame');
      var campoData = document.getElementById('agendar-data');
      var campoBairro = document.getElementById('agendar-bairro');
      var blocoBairro = agendar.querySelector('[data-agendar-bairro]');
      var enviar = agendar.querySelector('[data-agendar-enviar]');
      var numero = agendar.getAttribute('data-agendar-numero');

      var isoLocal = function (data) {
        var d = new Date(data.getTime() - data.getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 10);
      };
      var hoje = new Date();
      var limite = new Date(hoje);
      limite.setDate(limite.getDate() + (Number(agendar.getAttribute('data-agendar-dias')) || 60));
      campoData.min = isoLocal(hoje);
      campoData.max = isoLocal(limite);

      var DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
        'quinta-feira', 'sexta-feira', 'sábado'];
      var dataPorExtenso = function (iso) {
        var p = iso.split('-');
        if (p.length !== 3) return '';
        var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        return DIAS[d.getDay()] + ', ' + p[2] + '/' + p[1] + '/' + p[0];
      };

      var textoDe = function (campo) {
        var opcao = campo.options[campo.selectedIndex];
        return campo.value && opcao ? opcao.textContent.trim() : '';
      };

      var montar = function () {
        var domiciliar = campoLocal.value === 'domiciliar';
        blocoBairro.hidden = !domiciliar;

        var horario = agendar.querySelector('input[name="agendar-horario"]:checked:not(:disabled)');
        var local = textoDe(campoLocal);
        if (domiciliar && campoBairro.value.trim()) {
          local += ' — bairro: ' + campoBairro.value.trim();
        }
        var linhas = [
          agendar.getAttribute('data-agendar-abertura'),
          '',
          'Exame: ' + (textoDe(campoExame) || 'a conferir pelo pedido médico'),
          'Local: ' + (local || 'a combinar')
        ];
        // Campos desativados (preferenciaDataHorarioAtiva) não entram no texto.
        if (!campoData.disabled) {
          linhas.push(
            'Data de preferência: ' + (campoData.value ? dataPorExtenso(campoData.value) : 'a combinar'),
            'Horário de preferência: ' + (horario && horario.value ? horario.value : 'qualquer horário')
          );
        }
        linhas.push('', agendar.getAttribute('data-agendar-fecho'));
        enviar.href = 'https://wa.me/' + numero + '?text=' +
          encodeURIComponent(linhas.join('\n'));
      };

      aoMudarSelecao = montar;
      agendar.addEventListener('change', montar);
      agendar.addEventListener('input', montar);
      montar();

      // Os cartões de exame trazem o paciente para cá com o exame escolhido.
      document.addEventListener('click', function (evento) {
        var link = evento.target.closest('[data-agendar-exame]');
        if (!link) return;
        campoExame.value = link.getAttribute('data-agendar-exame');
        montar();
        // Foca depois da rolagem do link, para o teclado seguir daqui.
        window.setTimeout(function () {
          campoExame.focus({ preventScroll: true });
        }, semMovimento.matches ? 0 : 450);
      });
    }
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
