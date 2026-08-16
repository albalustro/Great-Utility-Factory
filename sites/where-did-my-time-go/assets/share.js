/*
 * share.js — the share section: canvas card generation, captions, native share,
 * download fallback.
 *
 * The cards are drawn straight onto a canvas at their final export size
 * (1080x1350 or 1080x1920), never captured from the DOM, so the PNG is the same
 * resolution on every device. The canvas shown on the page IS the export — what
 * you preview is exactly what gets shared.
 */
(function () {
  'use strict';

  var W = (window.WDMTG = window.WDMTG || {});

  /* ------------------------------------------------------------------ *
   * Copy
   * ------------------------------------------------------------------ */

  var SHARE_STRINGS = {
    en: {
      title: 'My life in numbers',
      lead: 'A card built from the numbers you entered. Nothing else about you is on it.',
      cardLife: 'My life so far',
      cardReclaim: 'What I could reclaim',
      chooseCard: 'Which card?',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      share: 'Share',
      copyLink: 'Copy link',
      download: 'Download image',
      copyCaption: 'Copy caption',
      captionLabel: 'Caption',
      feed: 'Feed · 4:5',
      story: 'Story · 9:16',
      instagramChoice: 'Feed or Story?',
      previewNote: 'Preview at full export resolution ({w} × {h}).',
      ready: 'Your post is ready. Save the image and open Instagram or TikTok to publish it.',
      preparing: 'Preparing your image…',
      linkCopied: 'Link copied.',
      captionCopied: 'Caption copied.',
      copyFailed: 'Copy did not work — select the text and copy it by hand.',
      downloaded: 'Image saved to your downloads.',
      shareOpened: 'Your share menu is open — finish there if you want to publish it.',
      shareFailed: 'Sharing is not available in this browser. The image has been downloaded instead.',
      renderFailed: 'The image could not be generated in this browser.',
      reclaimMissing: 'Choose a reduction above to build this card.',
      viralCta: 'Make someone question where their time went.',
      altLife: 'Share card: {age} years alive, broken down into years spent on each activity.',
      altReclaim: 'Share card: reclaiming {amount} a day gives back {years} years of waking life by age {age}.',
      cardEyebrow: 'WHERE DID MY TIME GO?',
      cardYearsAlive: 'YEARS ALIVE',
      cardFooter: 'WHERE DID YOUR TIME GO?',
      cardIfISpend: 'IF I SPEND',
      cardLess: 'LESS',
      cardOn: 'ON',
      cardEveryDay: 'EVERY DAY',
      cardIGetBack: 'I GET BACK',
      cardWakingLife: 'OF WAKING LIFE',
      cardByAge: 'BY AGE {age}',
      cardYears: 'YEARS',
      cardYear: 'YEAR',
      fileName: 'where-did-my-time-go',
      rowLabels: {
        sleep: 'sleeping',
        work: 'working',
        commute: 'commuting',
        phone: 'on your phone',
        tv: 'watching TV'
      },
      rowCustom: 'on {name}'
    },

    'pt-BR': {
      title: 'Minha vida em números',
      lead: 'Um card feito com os números que você informou. Nada mais sobre você aparece nele.',
      cardLife: 'Minha vida até aqui',
      cardReclaim: 'O que eu poderia recuperar',
      chooseCard: 'Qual card?',
      instagram: 'Instagram',
      tiktok: 'TikTok',
      share: 'Compartilhar',
      copyLink: 'Copiar link',
      download: 'Baixar imagem',
      copyCaption: 'Copiar legenda',
      captionLabel: 'Legenda',
      feed: 'Feed · 4:5',
      story: 'Story · 9:16',
      instagramChoice: 'Feed ou Story?',
      previewNote: 'Prévia na resolução final ({w} × {h}).',
      ready: 'Seu post está pronto. Salve a imagem e abra o Instagram ou TikTok para publicar.',
      preparing: 'Preparando sua imagem…',
      linkCopied: 'Link copiado.',
      captionCopied: 'Legenda copiada.',
      copyFailed: 'A cópia não funcionou — selecione o texto e copie manualmente.',
      downloaded: 'Imagem salva nos seus downloads.',
      shareOpened: 'O menu de compartilhamento está aberto — conclua por lá se quiser publicar.',
      shareFailed: 'O compartilhamento não está disponível neste navegador. A imagem foi baixada.',
      renderFailed: 'Não foi possível gerar a imagem neste navegador.',
      reclaimMissing: 'Escolha uma redução acima para montar este card.',
      viralCta: 'Faça alguém se perguntar para onde foi o próprio tempo.',
      altLife: 'Card de compartilhamento: {age} anos vividos, divididos em anos por atividade.',
      altReclaim: 'Card de compartilhamento: recuperar {amount} por dia devolve {years} anos de vida acordado até os {age}.',
      cardEyebrow: 'PARA ONDE FOI MEU TEMPO?',
      cardYearsAlive: 'ANOS VIVIDOS',
      cardFooter: 'PARA ONDE FOI O SEU TEMPO?',
      cardIfISpend: 'SE EU PASSAR',
      cardLess: 'A MENOS',
      cardOn: 'EM',
      cardEveryDay: 'TODO DIA',
      cardIGetBack: 'EU RECUPERO',
      cardWakingLife: 'DE VIDA ACORDADO',
      cardByAge: 'ATÉ OS {age}',
      cardYears: 'ANOS',
      cardYear: 'ANO',
      fileName: 'para-onde-foi-meu-tempo',
      rowLabels: {
        sleep: 'dormindo',
        work: 'trabalhando',
        commute: 'no deslocamento',
        phone: 'no celular',
        tv: 'assistindo TV'
      },
      rowCustom: 'em {name}'
    }
  };

  var CAPTIONS = {
    en: {
      life:
        "I've lived {age} years.\n" +
        'About {sleepYears} of them were spent sleeping, {workYears} working and {screenYears} on screens.\n' +
        'Where did your time go?\n{url}\n#WhereDidMyTimeGo',
      reclaim:
        'If I reclaim just {minutes} minutes a day from {category}, I get back about {wakingYears} years of waking life by age {targetAge}.\n' +
        'How much could you get back?\n{url}\n#WhereDidMyTimeGo'
    },
    'pt-BR': {
      life:
        'Já vivi {age} anos.\n' +
        'Cerca de {sleepYears} deles foram dormindo, {workYears} trabalhando e {screenYears} em telas.\n' +
        'Para onde foi o seu tempo?\n{url}\n#WhereDidMyTimeGo',
      reclaim:
        'Se eu recuperar apenas {minutes} minutos por dia de {category}, ganho de volta cerca de {wakingYears} anos de vida acordado até os {targetAge}.\n' +
        'Quanto tempo você poderia recuperar?\n{url}\n#WhereDidMyTimeGo'
    }
  };

  /* ------------------------------------------------------------------ *
   * Card design tokens
   * ------------------------------------------------------------------ */

  var CARD = {
    bgTop: '#0B0B10',
    bgBottom: '#17151E',
    glow: 'rgba(255, 106, 61, 0.20)',
    paper: '#F4F1EA',
    muted: '#9A94A8',
    accent: '#FF6A3D',
    hairline: 'rgba(244, 241, 234, 0.10)'
  };

  var FONT_STACK = '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif';
  var EMOJI_STACK = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", ' + FONT_STACK;

  var FORMATS = {
    feed: { width: 1080, height: 1350, label: 'feed' },
    story: { width: 1080, height: 1920, label: 'story' },
    tiktok: { width: 1080, height: 1920, label: 'tiktok' }
  };

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function $$(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var lang = W.lang || 'en';
  var s = SHARE_STRINGS[lang] || SHARE_STRINGS.en;
  var captions = CAPTIONS[lang] || CAPTIONS.en;

  function fmt() {
    return W.format;
  }

  function template(str, values) {
    return String(str).replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  function track(name, payload) {
    if (typeof W.trackEvent === 'function') W.trackEvent(name, payload);
  }

  function font(weight, size) {
    return weight + ' ' + Math.round(size) + 'px ' + FONT_STACK;
  }

  /** Canvas has no reliable letter-spacing, so tracked text is drawn per glyph. */
  function drawTracked(ctx, text, x, y, spacing, align) {
    var chars = String(text).split('');
    var total = 0;
    var i;
    for (i = 0; i < chars.length; i++) {
      total += ctx.measureText(chars[i]).width + spacing;
    }
    total -= spacing;

    var cursor = x;
    if (align === 'center') cursor = x - total / 2;
    if (align === 'right') cursor = x - total;

    for (i = 0; i < chars.length; i++) {
      ctx.fillText(chars[i], cursor, y);
      cursor += ctx.measureText(chars[i]).width + spacing;
    }
    return total;
  }

  function trackedWidth(ctx, text, spacing) {
    var chars = String(text).split('');
    var total = 0;
    for (var i = 0; i < chars.length; i++) total += ctx.measureText(chars[i]).width + spacing;
    return Math.max(0, total - spacing);
  }

  /** Shrink a font size until the line fits the available width. */
  function fitSize(ctx, text, maxWidth, size, weight, spacing) {
    var current = size;
    while (current > 12) {
      ctx.font = font(weight, current);
      var width = spacing ? trackedWidth(ctx, text, spacing * (current / size)) : ctx.measureText(text).width;
      if (width <= maxWidth) break;
      current -= 2;
    }
    return current;
  }

  function wrapText(ctx, text, maxWidth, size, weight) {
    ctx.font = font(weight, size);
    var words = String(text).split(/\s+/);
    var lines = [];
    var line = '';
    for (var i = 0; i < words.length; i++) {
      var candidate = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(candidate).width > maxWidth && line) {
        lines.push(line);
        line = words[i];
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function roundRect(ctx, x, y, w, h, r) {
    var radius = Math.min(r, h / 2, w / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function paintBackground(ctx, width, height) {
    var gradient = ctx.createLinearGradient(0, 0, width * 0.3, height);
    gradient.addColorStop(0, CARD.bgTop);
    gradient.addColorStop(1, CARD.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    var glow = ctx.createRadialGradient(
      width * 0.85, height * 0.08, 0,
      width * 0.85, height * 0.08, width * 0.9
    );
    glow.addColorStop(0, CARD.glow);
    glow.addColorStop(1, 'rgba(255, 106, 61, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // A very faint grain keeps large flat areas from banding.
    ctx.save();
    ctx.globalAlpha = 0.035;
    ctx.fillStyle = CARD.paper;
    for (var i = 0; i < 900; i++) {
      var x = Math.random() * width;
      var y = Math.random() * height;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ *
   * Card: my life so far
   * ------------------------------------------------------------------ */

  function rowLabelFor(segment) {
    if (s.rowLabels[segment.key]) return s.rowLabels[segment.key];
    return template(s.rowCustom, { name: segment.label });
  }

  function drawLifeCard(ctx, width, height, data) {
    var tall = height / width > 1.4;
    var pad = tall ? 96 : 88;
    var inner = width - pad * 2;

    paintBackground(ctx, width, height);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    // Eyebrow
    var eyebrowSize = tall ? 34 : 30;
    var eyebrowY = tall ? 230 : 150;
    ctx.fillStyle = CARD.accent;
    ctx.font = font(700, eyebrowSize);
    var eyebrowFit = fitSize(ctx, s.cardEyebrow, inner, eyebrowSize, 700, 0.28);
    ctx.font = font(700, eyebrowFit);
    drawTracked(ctx, s.cardEyebrow, pad, eyebrowY, eyebrowFit * 0.28, 'left');

    // The age, as big as it can honestly be
    var ageText = fmt().int(data.age);
    var ageSize = tall ? 420 : 320;
    ageSize = fitSize(ctx, ageText, inner, ageSize, 800);
    var ageBaseline = eyebrowY + ageSize * (tall ? 1.05 : 1.0);
    ctx.fillStyle = CARD.paper;
    ctx.font = font(800, ageSize);
    ctx.fillText(ageText, pad - ageSize * 0.02, ageBaseline);

    // "YEARS ALIVE"
    var aliveSize = tall ? 62 : 52;
    aliveSize = fitSize(ctx, s.cardYearsAlive, inner, aliveSize, 700, 0.2);
    ctx.font = font(700, aliveSize);
    ctx.fillStyle = CARD.paper;
    var aliveBaseline = ageBaseline + aliveSize * 1.35;
    drawTracked(ctx, s.cardYearsAlive, pad, aliveBaseline, aliveSize * 0.2, 'left');

    // Mini life bar
    var segments = data.categories.slice();
    if (data.unaccounted && data.unaccounted.hours > 0) segments.push(data.unaccounted);
    var scale = data.overlap ? data.accountedHours : data.lifetimeHours;

    var barH = tall ? 22 : 18;
    var barY = aliveBaseline + (tall ? 78 : 62);
    ctx.save();
    roundRect(ctx, pad, barY, inner, barH, barH / 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(244,241,234,0.08)';
    ctx.fillRect(pad, barY, inner, barH);
    var cursor = pad;
    segments.forEach(function (segment) {
      var segWidth = scale > 0 ? (segment.hours / scale) * inner : 0;
      ctx.fillStyle = segment.color;
      ctx.fillRect(cursor, barY, segWidth, barH);
      cursor += segWidth;
    });
    ctx.restore();

    // Footer, anchored to the bottom
    var footerSize = tall ? 46 : 40;
    var domainSize = tall ? 32 : 28;
    var domainBaseline = height - pad;
    var footerBaseline = domainBaseline - domainSize * 1.9;

    ctx.fillStyle = CARD.paper;
    var footerFit = fitSize(ctx, s.cardFooter, inner, footerSize, 800, 0.14);
    ctx.font = font(800, footerFit);
    drawTracked(ctx, s.cardFooter, pad, footerBaseline, footerFit * 0.14, 'left');

    ctx.fillStyle = CARD.accent;
    ctx.font = font(600, domainSize);
    drawTracked(ctx, W.siteDomain(), pad, domainBaseline, domainSize * 0.12, 'left');

    // Rows: the five biggest categories
    var rows = data.categories
      .slice()
      .sort(function (a, b) {
        return b.hours - a.hours;
      })
      .slice(0, 5);

    var rowsTop = barY + barH + (tall ? 86 : 62);
    var rowsBottom = footerBaseline - (tall ? 96 : 74);
    var available = rowsBottom - rowsTop;
    var rowH = rows.length ? Math.min(tall ? 150 : 112, available / rows.length) : 0;

    var numSize = Math.min(tall ? 96 : 78, rowH * 0.62);
    var textSize = Math.min(tall ? 44 : 37, rowH * 0.3);
    var emojiSize = Math.min(tall ? 52 : 44, rowH * 0.36);

    rows.forEach(function (segment, index) {
      var baseline = rowsTop + rowH * index + rowH * 0.62;
      var x = pad;

      if (segment.emoji) {
        ctx.font = emojiSize + 'px ' + EMOJI_STACK;
        ctx.fillStyle = CARD.paper;
        ctx.fillText(segment.emoji, x, baseline);
        // Emoji advance widths vary a lot between platforms, so measure rather
        // than assume, or the number lands on top of the icon.
        x += ctx.measureText(segment.emoji).width + emojiSize * 0.4;
      } else {
        ctx.fillStyle = segment.color;
        roundRect(ctx, x, baseline - emojiSize * 0.72, emojiSize * 0.5, emojiSize * 0.75, 6);
        ctx.fill();
        x += emojiSize * 0.9;
      }

      var yearsText = fmt().years(segment.calendarYears);
      ctx.font = font(800, numSize);
      ctx.fillStyle = CARD.paper;
      ctx.fillText(yearsText, x, baseline);
      x += ctx.measureText(yearsText).width + numSize * 0.18;

      var tail = fmt().yearsWord(segment.calendarYears) + ' ' + rowLabelFor(segment);
      var tailSize = textSize;
      var room = width - pad - x;
      tailSize = fitSize(ctx, tail, room, tailSize, 500);
      ctx.font = font(500, tailSize);
      ctx.fillStyle = CARD.muted;
      ctx.fillText(tail, x, baseline);

      // hairline under every row but the last
      if (index < rows.length - 1) {
        ctx.fillStyle = CARD.hairline;
        ctx.fillRect(pad, baseline + rowH * 0.26, inner, 1.5);
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Card: what I could reclaim
   * ------------------------------------------------------------------ */

  function drawReclaimCard(ctx, width, height, data, reclaim) {
    var tall = height / width > 1.4;
    var pad = tall ? 110 : 96;
    var inner = width - pad * 2;
    var centre = width / 2;

    paintBackground(ctx, width, height);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    var scale = tall ? 1.34 : 1;
    // "ONE HOUR" + "LESS" → "ONE HOUR LESS"; in Portuguese "UMA HORA A MENOS".
    var amountPhrase = ((W.reductionAmountPhrase
      ? W.reductionAmountPhrase(reclaim.minutesPerDay)
      : reclaim.minutesPerDay + ' min') + ' ' + s.cardLess).toUpperCase();

    var wakingYears = reclaim.wakingYears;
    var wakingWord = fmt().isSingular(wakingYears, 1) ? s.cardYear : s.cardYears;

    // Lines are measured first, then centred as one block, so both aspect
    // ratios and long category names lay out sensibly.
    var lines = [
      { text: s.cardIfISpend, size: 44 * scale, weight: 600, color: CARD.muted, tracking: 0.24, gap: 30 },
      { text: amountPhrase, size: 118 * scale, weight: 800, color: CARD.paper, gap: 8, fit: true },
      { text: (s.cardOn + ' ' + reclaim.categoryLabel).toUpperCase(), size: 62 * scale, weight: 700, color: CARD.paper, gap: 26, wrap: true },
      { text: s.cardEveryDay, size: 44 * scale, weight: 600, color: CARD.muted, tracking: 0.24, gap: 0 },
      { rule: true, gap: 62, space: 62 },
      { text: s.cardIGetBack, size: 44 * scale, weight: 600, color: CARD.accent, tracking: 0.24, gap: 24 },
      { text: fmt().years(wakingYears) + ' ' + wakingWord, size: 150 * scale, weight: 800, color: CARD.paper, gap: 14, fit: true },
      { text: s.cardWakingLife, size: 56 * scale, weight: 700, color: CARD.paper, gap: 28, wrap: true },
      { text: template(s.cardByAge, { age: fmt().int(reclaim.targetAge) }), size: 44 * scale, weight: 600, color: CARD.muted, tracking: 0.24, gap: 0 }
    ];

    // Measure
    var total = 0;
    lines.forEach(function (line) {
      if (line.rule) {
        line.height = line.space;
      } else if (line.wrap) {
        line.wrapped = wrapText(ctx, line.text, inner, line.size, line.weight);
        if (line.wrapped.length > 1) {
          line.size = fitSize(ctx, line.wrapped[0], inner, line.size, line.weight);
        }
        line.height = line.wrapped.length * line.size * 1.12;
      } else {
        if (line.fit) line.size = fitSize(ctx, line.text, inner, line.size, line.weight);
        line.height = line.size * 1.05;
      }
      total += line.height + line.gap;
    });

    // Centre the block, nudged down on 9:16 so it sits above the footer
    // rather than floating in the middle of a very tall frame.
    var y = Math.max(pad + 120 * scale, (height - total) / 2 + (tall ? height * 0.025 : 0));

    lines.forEach(function (line) {
      if (line.rule) {
        ctx.fillStyle = CARD.hairline;
        ctx.fillRect(centre - inner * 0.16, y + line.height / 2, inner * 0.32, 2);
        y += line.height + line.gap;
        return;
      }

      ctx.fillStyle = line.color;
      var texts = line.wrapped || [line.text];
      texts.forEach(function (text, index) {
        var baseline = y + line.size * 0.85 + index * line.size * 1.12;
        ctx.font = font(line.weight, line.size);
        if (line.tracking) {
          drawTracked(ctx, text, centre, baseline, line.size * line.tracking, 'center');
        } else {
          ctx.textAlign = 'center';
          ctx.fillText(text, centre, baseline);
          ctx.textAlign = 'left';
        }
      });
      y += line.height + line.gap;
    });

    // Footer
    var eyebrowSize = tall ? 30 : 27;
    ctx.fillStyle = CARD.muted;
    ctx.font = font(700, eyebrowSize);
    drawTracked(ctx, s.cardEyebrow, centre, height - pad - eyebrowSize * 1.9, eyebrowSize * 0.24, 'center');
    ctx.fillStyle = CARD.accent;
    ctx.font = font(600, eyebrowSize);
    drawTracked(ctx, W.siteDomain(), centre, height - pad, eyebrowSize * 0.14, 'center');
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  var currentCard = 'life';
  var currentFormat = 'feed';

  function canRenderReclaim() {
    return !!(W.reclaim && W.reclaim.wakingYears != null);
  }

  function renderTo(canvas, cardType, formatKey) {
    var format = FORMATS[formatKey] || FORMATS.feed;
    canvas.width = format.width;
    canvas.height = format.height;

    var ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.clearRect(0, 0, format.width, format.height);

    if (cardType === 'reclaim') {
      if (!canRenderReclaim()) return false;
      drawReclaimCard(ctx, format.width, format.height, W.results, W.reclaim);
    } else {
      if (!W.results) return false;
      drawLifeCard(ctx, format.width, format.height, W.results);
    }
    return true;
  }

  function offscreenRender(cardType, formatKey) {
    var canvas = document.createElement('canvas');
    return renderTo(canvas, cardType, formatKey) ? canvas : null;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (canvas.toBlob) {
        canvas.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error('toBlob returned null'));
        }, 'image/png');
      } else if (canvas.toDataURL) {
        try {
          var parts = canvas.toDataURL('image/png').split(',');
          var binary = atob(parts[1]);
          var bytes = new Uint8Array(binary.length);
          for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          resolve(new Blob([bytes], { type: 'image/png' }));
        } catch (err) {
          reject(err);
        }
      } else {
        reject(new Error('canvas export unsupported'));
      }
    });
  }

  function fileNameFor(cardType, formatKey) {
    return s.fileName + '-' + (cardType === 'reclaim' ? 'reclaim' : 'life') + '-' + formatKey + '.png';
  }

  /* ------------------------------------------------------------------ *
   * Captions
   * ------------------------------------------------------------------ */

  function categoryYears(key) {
    if (!W.results) return 0;
    var total = 0;
    W.results.categories.forEach(function (segment) {
      if (segment.key === key) total += segment.calendarYears;
    });
    return total;
  }

  function currentCaption() {
    var url = W.shareUrl();
    if (currentCard === 'reclaim' && canRenderReclaim()) {
      var reclaim = W.reclaim;
      return template(captions.reclaim, {
        minutes: fmt().int(reclaim.minutesPerDay),
        category: reclaim.categoryLabel.toLowerCase(),
        wakingYears: fmt().years(reclaim.wakingYears),
        targetAge: fmt().int(reclaim.targetAge),
        url: url
      });
    }
    if (!W.results) return url;
    return template(captions.life, {
      age: fmt().int(W.results.age),
      sleepYears: fmt().years(categoryYears('sleep')),
      workYears: fmt().years(categoryYears('work')),
      screenYears: fmt().years(categoryYears('phone') + categoryYears('tv')),
      url: url
    });
  }

  function currentAlt() {
    if (currentCard === 'reclaim' && canRenderReclaim()) {
      return template(s.altReclaim, {
        amount: W.reductionAmountPhrase(W.reclaim.minutesPerDay),
        years: fmt().years(W.reclaim.wakingYears),
        age: fmt().int(W.reclaim.targetAge)
      });
    }
    return template(s.altLife, { age: W.results ? fmt().int(W.results.age) : '' });
  }

  /* ------------------------------------------------------------------ *
   * Section markup
   * ------------------------------------------------------------------ */

  function render() {
    var root = $('#share');
    if (!root) return;

    root.innerHTML =
      '<div class="share-inner">' +
      '<h2 class="section-title" id="share-title">' + esc(s.title) + '</h2>' +
      '<p class="section-lead">' + esc(s.lead) + '</p>' +

      '<div class="share-tabs" role="tablist" aria-label="' + esc(s.chooseCard) + '">' +
      '<button type="button" class="share-tab is-active" role="tab" aria-selected="true" ' +
      'data-card="life" id="tab-life" aria-controls="share-preview">' + esc(s.cardLife) + '</button>' +
      '<button type="button" class="share-tab" role="tab" aria-selected="false" ' +
      'data-card="reclaim" id="tab-reclaim" aria-controls="share-preview">' + esc(s.cardReclaim) + '</button>' +
      '</div>' +

      '<div class="share-layout">' +
      '<figure class="share-preview" id="share-preview">' +
      '<canvas id="share-canvas" width="1080" height="1350" role="img" aria-label=""></canvas>' +
      '<figcaption class="share-preview-note" id="share-preview-note"></figcaption>' +
      '</figure>' +

      '<div class="share-controls">' +
      '<div class="share-buttons">' +
      '<button type="button" class="btn btn-primary" data-share="instagram" aria-expanded="false" ' +
      'aria-controls="instagram-choice">' + esc(s.instagram) + '</button>' +
      '<div class="share-choice" id="instagram-choice" hidden>' +
      '<p class="share-choice-title">' + esc(s.instagramChoice) + '</p>' +
      '<button type="button" class="btn btn-quiet" data-ig="feed">' + esc(s.feed) + '</button>' +
      '<button type="button" class="btn btn-quiet" data-ig="story">' + esc(s.story) + '</button>' +
      '</div>' +
      '<button type="button" class="btn btn-primary" data-share="tiktok">' + esc(s.tiktok) + '</button>' +
      '<button type="button" class="btn btn-solid" data-share="native">' + esc(s.share) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-share="download">' + esc(s.download) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-share="link">' + esc(s.copyLink) + '</button>' +
      '</div>' +

      '<p class="share-status" id="share-status" role="status" aria-live="polite"></p>' +

      '<div class="caption-block">' +
      '<label class="caption-label" for="share-caption">' + esc(s.captionLabel) + '</label>' +
      '<textarea id="share-caption" class="caption-text" rows="6" readonly></textarea>' +
      '<button type="button" class="btn btn-ghost" data-share="caption">' + esc(s.copyCaption) + '</button>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '<p class="viral-cta">' + esc(s.viralCta) + '</p>' +
      '</div>';

    // #share outlives every re-render (the visitor can edit their answers and
    // come back), so its delegated handler must only ever be bound once.
    if (!root.getAttribute('data-wired')) {
      root.setAttribute('data-wired', 'true');
      wire(root);
    }
    refresh();
  }

  function setStatus(message) {
    var el = $('#share-status');
    if (el) el.textContent = message || '';
  }

  function refresh() {
    var canvas = $('#share-canvas');
    if (!canvas) return;

    var tabReclaim = $('[data-card="reclaim"]');
    if (tabReclaim) tabReclaim.disabled = !canRenderReclaim();
    if (currentCard === 'reclaim' && !canRenderReclaim()) currentCard = 'life';

    $$('.share-tab').forEach(function (tab) {
      var active = tab.getAttribute('data-card') === currentCard;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    var ok = renderTo(canvas, currentCard, currentFormat);
    var format = FORMATS[currentFormat];
    canvas.setAttribute('aria-label', ok ? currentAlt() : '');
    canvas.classList.toggle('is-tall', format.height / format.width > 1.4);

    var note = $('#share-preview-note');
    if (note) {
      note.textContent = ok
        ? template(s.previewNote, { w: format.width, h: format.height })
        : s.reclaimMissing;
    }

    var caption = $('#share-caption');
    if (caption) caption.value = currentCaption();
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 4000);
    track('image_downloaded', { card: currentCard, format: currentFormat });
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(area);
      ok ? resolve() : reject(new Error('copy failed'));
    });
  }

  /**
   * Prepare the PNG and hand it to the operating system when the browser
   * supports file sharing; otherwise download it and say what to do next.
   * We never claim anything was posted — only the user knows that.
   */
  function shareImage(formatKey, source) {
    currentFormat = formatKey;
    refresh();
    setStatus(s.preparing);

    var canvas = offscreenRender(currentCard, formatKey);
    if (!canvas) {
      setStatus(s.renderFailed);
      return;
    }

    var filename = fileNameFor(currentCard, formatKey);
    var caption = currentCaption();

    canvasToBlob(canvas)
      .then(function (blob) {
        var file = null;
        try {
          file = new File([blob], filename, { type: 'image/png' });
        } catch (err) {
          file = null; // File constructor missing (older Safari)
        }

        var canShareFiles =
          !!file &&
          typeof navigator.share === 'function' &&
          typeof navigator.canShare === 'function' &&
          navigator.canShare({ files: [file] });

        if (!canShareFiles) {
          download(blob, filename);
          setStatus(s.ready);
          return;
        }

        return navigator
          .share({ files: [file], text: caption, url: W.shareUrl() })
          .then(function () {
            track('share_native', { card: currentCard, format: formatKey, source: source });
            // The share sheet closed. Whether anything was posted is unknown.
            setStatus(s.shareOpened);
          })
          .catch(function (error) {
            if (error && error.name === 'AbortError') {
              setStatus('');
              return;
            }
            download(blob, filename);
            setStatus(s.shareFailed);
          });
      })
      .catch(function () {
        setStatus(s.renderFailed);
      });
  }

  function wire(root) {
    root.addEventListener('click', function (event) {
      var target = event.target;

      var tab = target.closest ? target.closest('.share-tab') : null;
      if (tab && !tab.disabled) {
        currentCard = tab.getAttribute('data-card');
        setStatus('');
        refresh();
        return;
      }

      var ig = target.closest ? target.closest('[data-ig]') : null;
      if (ig) {
        var choice = ig.getAttribute('data-ig');
        $('#instagram-choice').hidden = true;
        $('[data-share="instagram"]').setAttribute('aria-expanded', 'false');
        track('share_instagram', { placement: choice, card: currentCard });
        shareImage(choice === 'story' ? 'story' : 'feed', 'instagram');
        return;
      }

      var action = target.closest ? target.closest('[data-share]') : null;
      if (!action) return;

      var name = action.getAttribute('data-share');
      track('share_clicked', { target: name, card: currentCard });

      if (name === 'instagram') {
        var panel = $('#instagram-choice');
        var open = !panel.hidden;
        panel.hidden = open;
        action.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (!open) {
          var first = $('[data-ig]', panel);
          if (first) first.focus();
        }
      } else if (name === 'tiktok') {
        track('share_tiktok', { card: currentCard });
        shareImage('tiktok', 'tiktok');
      } else if (name === 'native') {
        shareImage(currentFormat, 'native');
      } else if (name === 'download') {
        var canvas = offscreenRender(currentCard, currentFormat);
        if (!canvas) {
          setStatus(s.renderFailed);
          return;
        }
        canvasToBlob(canvas)
          .then(function (blob) {
            download(blob, fileNameFor(currentCard, currentFormat));
            setStatus(s.downloaded + ' ' + s.ready);
          })
          .catch(function () {
            setStatus(s.renderFailed);
          });
      } else if (name === 'link') {
        copyText(W.shareUrl())
          .then(function () {
            setStatus(s.linkCopied);
          })
          .catch(function () {
            setStatus(s.copyFailed);
          });
      } else if (name === 'caption') {
        copyText(currentCaption())
          .then(function () {
            setStatus(s.captionCopied);
          })
          .catch(function () {
            setStatus(s.copyFailed);
          });
      }
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  document.addEventListener('wdmtg:results', function () {
    render();
  });

  document.addEventListener('wdmtg:reclaim', function () {
    if ($('#share-canvas')) refresh();
  });

  // Exposed for manual testing in the console.
  W.share = {
    FORMATS: FORMATS,
    render: render,
    refresh: refresh,
    renderTo: renderTo,
    caption: currentCaption,
    setCard: function (card) {
      currentCard = card;
      refresh();
    },
    setFormat: function (format) {
      currentFormat = format;
      refresh();
    }
  };
})();
