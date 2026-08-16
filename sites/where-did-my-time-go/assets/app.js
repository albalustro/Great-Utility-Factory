/*
 * app.js — the whole calculator: copy, maths, form flow, results, reclaim.
 *
 * Shared verbatim by /en/ and /pt-br/. The page's <html lang> attribute selects
 * the string table; nothing else differs between the two languages.
 *
 * Everything runs in the browser. Nothing is sent anywhere, nothing is stored
 * except the language the visitor picks by hand (see language.js).
 */
(function () {
  'use strict';

  var W = (window.WDMTG = window.WDMTG || {});

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */

  var DAYS_PER_YEAR = 365.2425;
  var HOURS_PER_YEAR = DAYS_PER_YEAR * 24;
  var WEEKS_PER_YEAR = DAYS_PER_YEAR / 7; // for habits measured per week

  var DEFAULT_WORK_WEEKS_PER_YEAR = 48;
  var DEFAULT_TARGET_AGE = 80;
  var MIN_AGE = 13;
  var MAX_AGE = 100;

  // Used for branding on the share card and in captions when the site is opened
  // from the file system rather than served over http(s).
  var FALLBACK_DOMAIN = 'where-did-my-time-go.com';

  /* ------------------------------------------------------------------ *
   * Analytics seam — inert on purpose.
   *
   * No vendor, no network, no cookies. Events are queued in memory and
   * re-emitted as a DOM event so a real analytics tool can be attached later
   * without touching a single line of UI code.
   * ------------------------------------------------------------------ */

  var eventQueue = [];

  function trackEvent(name, payload) {
    var event = { name: name, payload: payload || {}, at: Date.now() };
    eventQueue.push(event);
    if (eventQueue.length > 200) eventQueue.shift();
    try {
      document.dispatchEvent(new CustomEvent('wdmtg:track', { detail: event }));
    } catch (err) {
      /* CustomEvent unsupported — analytics must never break the app */
    }
  }

  W.trackEvent = trackEvent;
  W.getTrackedEvents = function () {
    return eventQueue.slice();
  };

  /* ------------------------------------------------------------------ *
   * Categories
   * ------------------------------------------------------------------ */

  var CATEGORY_META = {
    sleep: { emoji: '😴', color: '#7C8CE8', pattern: 'p1' },
    work: { emoji: '💼', color: '#E8A33D', pattern: 'p2' },
    commute: { emoji: '🚗', color: '#4FB286', pattern: 'p3' },
    phone: { emoji: '📱', color: '#E85D6B', pattern: 'p4' },
    tv: { emoji: '📺', color: '#A879E6', pattern: 'p5' },
    unaccounted: { emoji: '', color: '#4A4A57', pattern: 'p6' }
  };

  var CUSTOM_COLORS = ['#4FC3E8', '#E8B9D0', '#B7D45C', '#F0855A', '#7FDBC4', '#D9A441'];
  var CUSTOM_PATTERNS = ['p2', 'p4', 'p1', 'p5', 'p3', 'p2'];

  var ACTIVITY_PRESETS = [
    { key: 'gaming', emoji: '🎮' },
    { key: 'studying', emoji: '📚' },
    { key: 'exercise', emoji: '🏃' },
    { key: 'housework', emoji: '🧹' },
    { key: 'cooking', emoji: '🍳' },
    { key: 'reading', emoji: '📖' },
    { key: 'custom', emoji: '✨' }
  ];

  /* ------------------------------------------------------------------ *
   * Copy
   * ------------------------------------------------------------------ */

  var STRINGS = {
    en: {
      locale: 'en-US',
      steps: ['You', 'Your time', 'Your life'],
      stepOf: 'Step {n} of 3',
      step1Title: 'How old are you?',
      step1Help: 'Everything below is measured against the time you have already lived.',
      ageLabel: 'Age',
      step2Title: 'Where does a normal day go?',
      step2Help: 'Rough averages are fine. Leave anything that does not apply to you empty.',
      panelDone: 'Continue',
      categories: {
        sleep: 'Sleep',
        work: 'Work',
        commute: 'Commuting',
        phone: 'Phone & social',
        tv: 'TV & streaming',
        unaccounted: 'Time not accounted for'
      },
      shareLabels: {
        sleep: 'sleeping',
        work: 'working',
        commute: 'commuting',
        phone: 'on your phone',
        tv: 'watching TV'
      },
      sleepQuestion: 'How many hours do you usually sleep per day?',
      sleepHelp: 'Sleep is counted across your whole life so far.',
      sleepHours: 'Hours of sleep per day',
      workQuestion: 'How much have you worked?',
      workYears: 'Years worked',
      workHours: 'Hours per week',
      workWeeks: 'Working weeks per year',
      workWeeksHelp: 'Default: 48 weeks — 52 weeks minus holidays. Change it if yours is different.',
      commuteQuestion: 'How much do you travel to work or study?',
      commuteYears: 'Years commuting regularly',
      commuteMinutes: 'Round-trip minutes per commuting day',
      commuteDays: 'Commuting days per week',
      commuteHelp: 'Your working weeks per year are used here too.',
      phoneQuestion: 'How much time goes to your phone and social media?',
      phoneHours: 'Hours per day',
      phoneYears: 'Years at roughly this pace',
      phoneHelp: 'Try to count only time that is not already inside another category, so the same hour is not counted twice.',
      tvQuestion: 'How much TV and streaming?',
      tvHours: 'Hours per day',
      tvYears: 'Years at roughly this pace',
      tvHelp: 'Again, only time that is not already counted somewhere else.',
      extrasTitle: 'Anything else?',
      addActivity: '+ Add another part of my life',
      addActivityHint: 'Pick one, or create your own.',
      activityNames: {
        gaming: 'Gaming',
        studying: 'Studying',
        exercise: 'Exercise',
        housework: 'Housework',
        cooking: 'Cooking',
        reading: 'Reading',
        custom: ''
      },
      activityNameLabel: 'Name',
      activityNamePlaceholder: 'Name this part of your life',
      activityAmount: 'Hours',
      activityUnit: 'Per',
      activityPerDay: 'day',
      activityPerWeek: 'week',
      activityYears: 'Years',
      removeActivity: 'Remove {name}',
      thisActivity: 'this activity',
      back: 'Back',
      continue: 'Continue',
      submit: 'Show me my life',
      editAnswers: 'Edit my answers',
      startOver: 'Start over',
      resultTitle: "You've been alive for {age} years.",
      resultSub: "That's about:",
      resultDays: 'days',
      resultHours: 'hours',
      lifeBarTitle: 'Your life so far',
      lifeBarHelp: 'Every hour you have lived, side by side. Select a segment for the detail.',
      lifeBarHint: 'Hover, tap or use the arrow keys on a segment to see its numbers.',
      lifeBarOverlapNote: 'Because your entries overlap, the segments below are shown relative to what you entered, not to your whole life.',
      cardsTitle: 'Where it went',
      ofYourLife: 'of your life',
      years: 'years',
      year: 'year',
      days: 'days',
      hours: 'hours',
      unaccountedTitle: 'Time not accounted for',
      unaccountedBody: "This includes everything you didn't enter: relationships, meals, hobbies, travel, childhood, rest and everything else that makes up a life.",
      unaccountedUnknown: 'Not reliably calculable until the overlap above is corrected.',
      overlapTitle: 'Some of your time is overlapping.',
      overlapBody: "Your activities add up to more hours than you've lived. Some things probably happen at the same time — like using your phone while watching TV.\nAdjust the values to get a cleaner picture.",
      overlapFix: 'Adjust my answers',
      reclaimTitle: 'What could you get back?',
      reclaimLead: 'Pick something you do every day and see what a smaller version of it adds up to.',
      reclaimCategory: 'Reduce',
      reclaimAmount: 'Reduce by',
      reclaimCustom: 'Custom',
      reclaimCustomLabel: 'Minutes per day',
      reclaimTargetAge: 'Until what age?',
      reclaimSomethingElse: 'Something else',
      minutesPerDay: '{n} min/day',
      oneHourPerDay: '1 hour/day',
      hoursPerDay: '{n} hours/day',
      reclaimHeadline: '{amount} less per day until you’re {age}',
      reclaimHours: 'hours',
      reclaimDays: 'full days',
      reclaimYears: 'calendar years',
      reclaimYearsSingular: 'calendar year',
      reclaimAnother: 'And another way to see it:',
      reclaimWaking: 'of waking life',
      reclaimWakingYears: 'years',
      reclaimWakingYear: 'year',
      reclaimNote: 'These are reclaimed waking hours, not extra lifespan. Nothing here makes anyone live longer — it only shows how much attention the habit is holding.',
      wakingTipTitle: 'What is a waking-life year?',
      wakingTipBody: 'A "waking-life year" measures those hours against the time you are normally awake, rather than against a full 24-hour day. With {sleep} hours of sleep a night, a waking-life year is about {hours} hours.',
      reclaimOverAmount: 'That is more than the {current} you entered for this activity. The maths still works, but the hours have to come from somewhere.',
      reduction15: '15 minutes/day',
      errors: {
        ageRequired: 'Enter your age to continue.',
        ageRange: 'Your age has to be between 13 and 100.',
        number: 'Enter a number.',
        negative: "This can't be a negative number.",
        sleepRequired: 'Enter how many hours you usually sleep.',
        sleepRange: 'Sleep has to be more than 0 and less than 24 hours a day.',
        workYears: "You can't have worked more years than you have lived.",
        workHours: 'There are only 168 hours in a week.',
        workWeeks: 'Working weeks have to be between 1 and 52.',
        commuteYears: "You can't have commuted for more years than you have lived.",
        commuteMinutes: 'A round trip has to be under 24 hours (1440 minutes).',
        commuteDays: 'Commuting days have to be between 0 and 7.',
        habitYears: "That's more years than you have lived.",
        hoursPerDay: 'Hours per day have to be under 24.',
        hoursPerWeek: 'Hours per week have to be under 168.',
        activityName: 'Give this part of your life a name.',
        targetAge: 'Pick an age between {min} and 100.',
        summary: 'Please check the highlighted answers.'
      }
    },

    'pt-BR': {
      locale: 'pt-BR',
      steps: ['Você', 'Seu tempo', 'Sua vida'],
      stepOf: 'Etapa {n} de 3',
      step1Title: 'Quantos anos você tem?',
      step1Help: 'Tudo o que vem depois é medido contra o tempo que você já viveu.',
      ageLabel: 'Idade',
      step2Title: 'Para onde vai um dia normal?',
      step2Help: 'Médias aproximadas já servem. Deixe em branco o que não se aplica a você.',
      panelDone: 'Continuar',
      categories: {
        sleep: 'Sono',
        work: 'Trabalho',
        commute: 'Deslocamento',
        phone: 'Celular e redes',
        tv: 'TV e streaming',
        unaccounted: 'Tempo não contabilizado'
      },
      shareLabels: {
        sleep: 'dormindo',
        work: 'trabalhando',
        commute: 'no deslocamento',
        phone: 'no celular',
        tv: 'assistindo TV'
      },
      sleepQuestion: 'Quantas horas você costuma dormir por dia?',
      sleepHelp: 'O sono é calculado ao longo de toda a sua vida até aqui.',
      sleepHours: 'Horas de sono por dia',
      workQuestion: 'Quanto você já trabalhou?',
      workYears: 'Anos trabalhados',
      workHours: 'Horas por semana',
      workWeeks: 'Semanas trabalhadas por ano',
      workWeeksHelp: 'Padrão: 48 semanas — 52 menos férias e feriados. Ajuste se o seu caso for diferente.',
      commuteQuestion: 'Quanto você se desloca para trabalhar ou estudar?',
      commuteYears: 'Anos com deslocamento regular',
      commuteMinutes: 'Minutos de ida e volta por dia',
      commuteDays: 'Dias de deslocamento por semana',
      commuteHelp: 'As suas semanas trabalhadas por ano também são usadas aqui.',
      phoneQuestion: 'Quanto tempo vai para o celular e as redes sociais?',
      phoneHours: 'Horas por dia',
      phoneYears: 'Anos aproximadamente nesse ritmo',
      phoneHelp: 'Tente considerar apenas o tempo que não está incluído em outra categoria, para não contar a mesma hora duas vezes.',
      tvQuestion: 'Quanto tempo de TV e streaming?',
      tvHours: 'Horas por dia',
      tvYears: 'Anos aproximadamente nesse ritmo',
      tvHelp: 'De novo: apenas o tempo que ainda não foi contado em outro lugar.',
      extrasTitle: 'Mais alguma coisa?',
      addActivity: '+ Adicionar outra parte da minha vida',
      addActivityHint: 'Escolha uma, ou crie a sua.',
      activityNames: {
        gaming: 'Jogos',
        studying: 'Estudos',
        exercise: 'Exercícios',
        housework: 'Tarefas domésticas',
        cooking: 'Cozinhar',
        reading: 'Leitura',
        custom: ''
      },
      activityNameLabel: 'Nome',
      activityNamePlaceholder: 'Dê um nome a essa parte da sua vida',
      activityAmount: 'Horas',
      activityUnit: 'Por',
      activityPerDay: 'dia',
      activityPerWeek: 'semana',
      activityYears: 'Anos',
      removeActivity: 'Remover {name}',
      thisActivity: 'esta atividade',
      back: 'Voltar',
      continue: 'Continuar',
      submit: 'Quero ver minha vida',
      editAnswers: 'Editar minhas respostas',
      startOver: 'Começar de novo',
      resultTitle: 'Você já viveu {age} anos.',
      resultSub: 'Isso representa aproximadamente:',
      resultDays: 'dias',
      resultHours: 'horas',
      lifeBarTitle: 'Sua vida até aqui',
      lifeBarHelp: 'Cada hora que você viveu, lado a lado. Selecione um trecho para ver os detalhes.',
      lifeBarHint: 'Passe o mouse, toque ou use as setas do teclado em um trecho para ver os números.',
      lifeBarOverlapNote: 'Como suas respostas se sobrepõem, os trechos abaixo são exibidos em relação ao que você informou, e não à sua vida inteira.',
      cardsTitle: 'Para onde foi',
      ofYourLife: 'da sua vida',
      years: 'anos',
      year: 'ano',
      days: 'dias',
      hours: 'horas',
      unaccountedTitle: 'Tempo não contabilizado',
      unaccountedBody: 'Isso inclui tudo que você não informou: relacionamentos, refeições, hobbies, viagens, infância, descanso e todo o resto que compõe uma vida.',
      unaccountedUnknown: 'Não é possível calcular com segurança enquanto a sobreposição acima não for corrigida.',
      overlapTitle: 'Parte do seu tempo está sendo contada duas vezes.',
      overlapBody: 'Suas atividades somam mais horas do que você já viveu. Algumas provavelmente acontecem ao mesmo tempo — como usar o celular enquanto assiste TV.\nAjuste os valores para obter uma estimativa melhor.',
      overlapFix: 'Ajustar minhas respostas',
      reclaimTitle: 'Quanto tempo você poderia recuperar?',
      reclaimLead: 'Escolha algo que você faz todos os dias e veja quanto uma versão menor disso soma.',
      reclaimCategory: 'Reduzir',
      reclaimAmount: 'Reduzir em',
      reclaimCustom: 'Personalizado',
      reclaimCustomLabel: 'Minutos por dia',
      reclaimTargetAge: 'Até que idade?',
      reclaimSomethingElse: 'Outra coisa',
      minutesPerDay: '{n} min/dia',
      oneHourPerDay: '1 hora/dia',
      hoursPerDay: '{n} horas/dia',
      reclaimHeadline: '{amount} a menos por dia até os {age}',
      reclaimHours: 'horas',
      reclaimDays: 'dias completos',
      reclaimYears: 'anos corridos',
      reclaimYearsSingular: 'ano corrido',
      reclaimAnother: 'E outra forma de enxergar:',
      reclaimWaking: 'de vida acordado',
      reclaimWakingYears: 'anos',
      reclaimWakingYear: 'ano',
      reclaimNote: 'São horas acordadas recuperadas, não expectativa de vida a mais. Nada aqui faz alguém viver mais tempo — só mostra quanta atenção o hábito está ocupando.',
      wakingTipTitle: 'O que é um ano de vida acordado?',
      wakingTipBody: 'Um "ano de vida acordado" compara essas horas apenas ao período em que você normalmente está acordado, e não às 24 horas completas de um dia. Com {sleep} horas de sono por noite, um ano de vida acordado tem cerca de {hours} horas.',
      reclaimOverAmount: 'Isso é mais do que os {current} que você informou para esta atividade. A conta continua válida, mas essas horas precisam sair de algum lugar.',
      reduction15: '15 minutos/dia',
      errors: {
        ageRequired: 'Informe sua idade para continuar.',
        ageRange: 'A idade precisa estar entre 13 e 100.',
        number: 'Digite um número.',
        negative: 'Este valor não pode ser negativo.',
        sleepRequired: 'Informe quantas horas você costuma dormir.',
        sleepRange: 'O sono precisa ser maior que 0 e menor que 24 horas por dia.',
        workYears: 'Você não pode ter trabalhado mais anos do que viveu.',
        workHours: 'Uma semana só tem 168 horas.',
        workWeeks: 'As semanas trabalhadas precisam estar entre 1 e 52.',
        commuteYears: 'Você não pode ter se deslocado por mais anos do que viveu.',
        commuteMinutes: 'A ida e volta precisa ser menor que 24 horas (1440 minutos).',
        commuteDays: 'Os dias de deslocamento precisam estar entre 0 e 7.',
        habitYears: 'São mais anos do que você já viveu.',
        hoursPerDay: 'As horas por dia precisam ser menores que 24.',
        hoursPerWeek: 'As horas por semana precisam ser menores que 168.',
        activityName: 'Dê um nome a essa parte da sua vida.',
        targetAge: 'Escolha uma idade entre {min} e 100.',
        summary: 'Confira as respostas destacadas.'
      }
    }
  };

  /* ------------------------------------------------------------------ *
   * Language + formatting
   * ------------------------------------------------------------------ */

  var lang = (function () {
    var attr = (document.documentElement.lang || '').toLowerCase();
    return attr.indexOf('pt') === 0 ? 'pt-BR' : 'en';
  })();

  var t = STRINGS[lang];
  var locale = t.locale;

  W.lang = lang;
  W.strings = function () {
    return t;
  };

  var formatterCache = {};

  function numberFormat(decimals) {
    if (!formatterCache[decimals]) {
      formatterCache[decimals] = new Intl.NumberFormat(locale, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
    return formatterCache[decimals];
  }

  /** Round only for display — never inside the maths. */
  function fmtInt(value) {
    return numberFormat(0).format(Math.round(value));
  }

  function fmtDec(value, decimals) {
    return numberFormat(decimals == null ? 1 : decimals).format(value);
  }

  function fmtYears(value) {
    return fmtDec(value, 1);
  }

  function fmtPct(value) {
    if (value > 0 && value < 0.05) return '<' + fmtDec(0.1, 1) + '%';
    return fmtDec(value, 1) + '%';
  }

  /**
   * "years" vs "year". English uses the singular only for exactly 1;
   * Portuguese uses it for anything below 2 (1,42 ano corrido).
   */
  function isSingular(value, decimals) {
    var rounded = Number(value.toFixed(decimals == null ? 1 : decimals));
    if (lang === 'pt-BR') return rounded >= 1 && rounded < 2;
    return rounded === 1;
  }

  function yearsWord(value, decimals) {
    return isSingular(value, decimals) ? t.year : t.years;
  }

  function template(str, values) {
    return String(str).replace(/\{(\w+)\}/g, function (match, key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
    });
  }

  W.format = {
    int: fmtInt,
    dec: fmtDec,
    years: fmtYears,
    pct: fmtPct,
    yearsWord: yearsWord,
    isSingular: isSingular,
    template: template,
    locale: locale
  };

  /* ------------------------------------------------------------------ *
   * URLs
   * ------------------------------------------------------------------ */

  function isWebOrigin() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  /** The link that goes into share captions — the real page when we have one. */
  function shareUrl() {
    if (isWebOrigin()) {
      return window.location.origin + window.location.pathname;
    }
    return 'https://' + FALLBACK_DOMAIN + '/' + (lang === 'pt-BR' ? 'pt-br/' : 'en/');
  }

  /** The discreet brand line on the share card. */
  function siteDomain() {
    if (isWebOrigin() && window.location.hostname && window.location.hostname !== 'localhost') {
      return window.location.host.replace(/^www\./, '');
    }
    return FALLBACK_DOMAIN;
  }

  W.shareUrl = shareUrl;
  W.siteDomain = siteDomain;

  /* ------------------------------------------------------------------ *
   * Small DOM helpers
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

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  W.prefersReducedMotion = prefersReducedMotion;

  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (err) {
      /* ignore */
    }
  }

  /**
   * Read a numeric input. Returns null for an empty field (which means
   * "not applicable"), NaN for something that is not a number.
   */
  function readNumber(input) {
    if (!input) return null;
    var raw = String(input.value).trim().replace(',', '.');
    if (raw === '') return null;
    var value = Number(raw);
    return isFinite(value) ? value : NaN;
  }

  function scrollToElement(el) {
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } catch (err) {
      el.scrollIntoView();
    }
  }

  function focusHeading(el) {
    if (!el) return;
    el.setAttribute('tabindex', '-1');
    try {
      el.focus({ preventScroll: true });
    } catch (err) {
      el.focus();
    }
  }

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  var state = {
    age: null,
    sleepHoursPerDay: null,
    work: { years: null, hoursPerWeek: null, weeksPerYear: DEFAULT_WORK_WEEKS_PER_YEAR },
    commute: { years: null, minutesRoundTrip: null, daysPerWeek: 5 },
    phone: { hoursPerDay: null, years: null },
    tv: { hoursPerDay: null, years: null },
    activities: [],
    reclaim: { categoryId: null, minutesPerDay: 60, targetAge: DEFAULT_TARGET_AGE }
  };

  var activitySeq = 0;

  /* ------------------------------------------------------------------ *
   * Maths
   *
   * Nothing here rounds. Rounding happens only where a number is printed.
   * ------------------------------------------------------------------ */

  function lifetimeHours(age) {
    return age * DAYS_PER_YEAR * 24;
  }

  function sleepHours(age, hoursPerDay) {
    return age * DAYS_PER_YEAR * hoursPerDay;
  }

  function workHours(years, weeksPerYear, hoursPerWeek) {
    return years * weeksPerYear * hoursPerWeek;
  }

  function commuteHours(years, weeksPerYear, daysPerWeek, minutesRoundTrip) {
    return years * weeksPerYear * daysPerWeek * (minutesRoundTrip / 60);
  }

  function dailyHabitHours(years, hoursPerDay) {
    return years * DAYS_PER_YEAR * hoursPerDay;
  }

  function weeklyHabitHours(years, hoursPerWeek, weeksPerYear) {
    return years * (weeksPerYear == null ? WEEKS_PER_YEAR : weeksPerYear) * hoursPerWeek;
  }

  function toCalendarYears(hours) {
    return hours / HOURS_PER_YEAR;
  }

  function toDays(hours) {
    return hours / 24;
  }

  function percentOfLife(hours, total) {
    return total > 0 ? (hours / total) * 100 : 0;
  }

  function num(value) {
    return typeof value === 'number' && isFinite(value) ? value : 0;
  }

  function activityHours(activity) {
    var years = num(activity.years);
    var amount = num(activity.amount);
    return activity.unit === 'week'
      ? weeklyHabitHours(years, amount)
      : dailyHabitHours(years, amount);
  }

  /** Everything the result page and the share cards need. */
  function computeResults() {
    var age = num(state.age);
    var total = lifetimeHours(age);

    var categories = [];

    function push(id, key, label, emoji, color, pattern, hours, meta) {
      if (!(hours > 0)) return;
      var entry = {
        id: id,
        key: key,
        label: label,
        emoji: emoji,
        color: color,
        pattern: pattern,
        hours: hours,
        days: toDays(hours),
        calendarYears: toCalendarYears(hours),
        percent: percentOfLife(hours, total)
      };
      if (meta) {
        for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) entry[k] = meta[k];
      }
      categories.push(entry);
    }

    var m;

    m = CATEGORY_META.sleep;
    push('sleep', 'sleep', t.categories.sleep, m.emoji, m.color, m.pattern,
      sleepHours(age, num(state.sleepHoursPerDay)),
      { hoursPerDay: num(state.sleepHoursPerDay) });

    m = CATEGORY_META.work;
    push('work', 'work', t.categories.work, m.emoji, m.color, m.pattern,
      workHours(num(state.work.years), num(state.work.weeksPerYear), num(state.work.hoursPerWeek)));

    m = CATEGORY_META.commute;
    push('commute', 'commute', t.categories.commute, m.emoji, m.color, m.pattern,
      commuteHours(num(state.commute.years), num(state.work.weeksPerYear),
        num(state.commute.daysPerWeek), num(state.commute.minutesRoundTrip)));

    m = CATEGORY_META.phone;
    push('phone', 'phone', t.categories.phone, m.emoji, m.color, m.pattern,
      dailyHabitHours(num(state.phone.years), num(state.phone.hoursPerDay)),
      { hoursPerDay: num(state.phone.hoursPerDay) });

    m = CATEGORY_META.tv;
    push('tv', 'tv', t.categories.tv, m.emoji, m.color, m.pattern,
      dailyHabitHours(num(state.tv.years), num(state.tv.hoursPerDay)),
      { hoursPerDay: num(state.tv.hoursPerDay) });

    state.activities.forEach(function (activity, index) {
      var color = CUSTOM_COLORS[index % CUSTOM_COLORS.length];
      var pattern = CUSTOM_PATTERNS[index % CUSTOM_PATTERNS.length];
      push(activity.id, 'custom', activity.name || t.thisActivity, activity.emoji, color, pattern,
        activityHours(activity),
        {
          hoursPerDay: activity.unit === 'week' ? num(activity.amount) / 7 : num(activity.amount)
        });
    });

    var accounted = categories.reduce(function (sum, c) {
      return sum + c.hours;
    }, 0);

    var overlap = accounted > total;
    var unaccountedHours = total - accounted;

    return {
      age: age,
      lifetimeHours: total,
      lifetimeDays: age * DAYS_PER_YEAR,
      sleepHoursPerDay: num(state.sleepHoursPerDay),
      categories: categories,
      accountedHours: accounted,
      overlap: overlap,
      unaccounted: overlap
        ? null
        : {
            id: 'unaccounted',
            key: 'unaccounted',
            label: t.categories.unaccounted,
            emoji: CATEGORY_META.unaccounted.emoji,
            color: CATEGORY_META.unaccounted.color,
            pattern: CATEGORY_META.unaccounted.pattern,
            hours: unaccountedHours,
            days: toDays(unaccountedHours),
            calendarYears: toCalendarYears(unaccountedHours),
            percent: percentOfLife(unaccountedHours, total)
          }
    };
  }

  /** The forward-looking half: what a daily reduction adds up to. */
  function computeReclaim(results) {
    var targetAge = num(state.reclaim.targetAge);
    var minutes = num(state.reclaim.minutesPerDay);
    var remainingYears = targetAge - results.age;
    if (remainingYears <= 0 || minutes <= 0) return null;

    var reductionHoursPerDay = minutes / 60;
    var reclaimedHours = remainingYears * DAYS_PER_YEAR * reductionHoursPerDay;
    var awakeHoursPerDay = 24 - results.sleepHoursPerDay;
    var wakingYearHours = awakeHoursPerDay * DAYS_PER_YEAR;

    var category = null;
    for (var i = 0; i < results.categories.length; i++) {
      if (results.categories[i].id === state.reclaim.categoryId) category = results.categories[i];
    }

    return {
      categoryId: state.reclaim.categoryId,
      categoryLabel: category ? category.label : t.reclaimSomethingElse,
      categoryEmoji: category ? category.emoji : '⏳',
      categoryHoursPerDay: category && category.hoursPerDay ? category.hoursPerDay : null,
      minutesPerDay: minutes,
      targetAge: targetAge,
      remainingYears: remainingYears,
      hours: reclaimedHours,
      days: toDays(reclaimedHours),
      calendarYears: toCalendarYears(reclaimedHours),
      awakeHoursPerDay: awakeHoursPerDay,
      wakingYearHours: wakingYearHours,
      wakingYears: wakingYearHours > 0 ? reclaimedHours / wakingYearHours : null
    };
  }

  W.math = {
    DAYS_PER_YEAR: DAYS_PER_YEAR,
    HOURS_PER_YEAR: HOURS_PER_YEAR,
    WEEKS_PER_YEAR: WEEKS_PER_YEAR,
    lifetimeHours: lifetimeHours,
    sleepHours: sleepHours,
    workHours: workHours,
    commuteHours: commuteHours,
    dailyHabitHours: dailyHabitHours,
    weeklyHabitHours: weeklyHabitHours,
    toCalendarYears: toCalendarYears,
    toDays: toDays,
    percentOfLife: percentOfLife,
    computeResults: computeResults,
    computeReclaim: computeReclaim
  };

  /* ------------------------------------------------------------------ *
   * Validation
   * ------------------------------------------------------------------ */

  var errors = {};

  function setError(inputId, message) {
    errors[inputId] = message;
  }

  function clearErrors() {
    errors = {};
  }

  function paintErrors() {
    $$('[data-error]').forEach(function (el) {
      var id = el.getAttribute('data-error');
      var input = document.getElementById(id);
      var message = errors[id];
      if (message) {
        el.textContent = message;
        el.hidden = false;
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          setDescribedBy(input, describedBy(input, el.id, true));
        }
      } else {
        el.textContent = '';
        el.hidden = true;
        if (input) {
          input.removeAttribute('aria-invalid');
          setDescribedBy(input, describedBy(input, el.id, false));
        }
      }
    });
  }

  function setDescribedBy(input, value) {
    if (value) {
      input.setAttribute('aria-describedby', value);
    } else {
      input.removeAttribute('aria-describedby');
    }
  }

  function describedBy(input, errorId, include) {
    var ids = (input.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter(function (id) {
        return id && id !== errorId;
      });
    if (include) ids.push(errorId);
    return ids.join(' ');
  }

  function firstErrorId() {
    for (var id in errors) {
      if (Object.prototype.hasOwnProperty.call(errors, id)) return id;
    }
    return null;
  }

  function announce(message) {
    var live = $('#form-status');
    if (live) live.textContent = message || '';
  }

  /** Shared numeric checks. Returns the value, or null when unusable. */
  function validateNumber(inputId, options) {
    var input = document.getElementById(inputId);
    var value = readNumber(input);
    if (value === null) {
      if (options.required) {
        setError(inputId, options.requiredMessage || t.errors.number);
        return null;
      }
      return null;
    }
    if (isNaN(value)) {
      setError(inputId, t.errors.number);
      return null;
    }
    if (value < 0) {
      setError(inputId, t.errors.negative);
      return null;
    }
    if (options.min != null && value < options.min) {
      setError(inputId, options.rangeMessage);
      return null;
    }
    if (options.max != null && value > options.max) {
      setError(inputId, options.rangeMessage);
      return null;
    }
    return value;
  }

  function validateStep1() {
    clearErrors();
    var input = $('#age');
    var value = readNumber(input);

    if (value === null) {
      setError('age', t.errors.ageRequired);
    } else if (isNaN(value)) {
      setError('age', t.errors.number);
    } else if (value < MIN_AGE || value > MAX_AGE) {
      setError('age', t.errors.ageRange);
    } else {
      state.age = value;
    }

    paintErrors();
    return !firstErrorId();
  }

  function validateStep2() {
    clearErrors();
    var age = state.age;

    var sleep = null;
    var sleepInput = $('#sleep-hours');
    var sleepValue = readNumber(sleepInput);
    if (sleepValue === null) {
      setError('sleep-hours', t.errors.sleepRequired);
    } else if (isNaN(sleepValue)) {
      setError('sleep-hours', t.errors.number);
    } else if (!(sleepValue > 0) || !(sleepValue < 24)) {
      setError('sleep-hours', t.errors.sleepRange);
    } else {
      sleep = sleepValue;
    }

    var workYears = validateNumber('work-years', { max: age, rangeMessage: t.errors.workYears });
    var workHoursWeek = validateNumber('work-hours', { max: 168, rangeMessage: t.errors.workHours });
    var workWeeks = validateNumber('work-weeks', { min: 1, max: 52, rangeMessage: t.errors.workWeeks });

    var commuteYears = validateNumber('commute-years', { max: age, rangeMessage: t.errors.commuteYears });
    var commuteMinutes = validateNumber('commute-minutes', { max: 1440, rangeMessage: t.errors.commuteMinutes });
    var commuteDays = validateNumber('commute-days', { max: 7, rangeMessage: t.errors.commuteDays });

    var phoneHours = validateNumber('phone-hours', { max: 24, rangeMessage: t.errors.hoursPerDay });
    var phoneYears = validateNumber('phone-years', { max: age, rangeMessage: t.errors.habitYears });

    var tvHours = validateNumber('tv-hours', { max: 24, rangeMessage: t.errors.hoursPerDay });
    var tvYears = validateNumber('tv-years', { max: age, rangeMessage: t.errors.habitYears });

    state.sleepHoursPerDay = sleep;
    state.work.years = workYears;
    state.work.hoursPerWeek = workHoursWeek;
    state.work.weeksPerYear = workWeeks == null ? DEFAULT_WORK_WEEKS_PER_YEAR : workWeeks;
    state.commute.years = commuteYears;
    state.commute.minutesRoundTrip = commuteMinutes;
    state.commute.daysPerWeek = commuteDays;
    state.phone.hoursPerDay = phoneHours;
    state.phone.years = phoneYears;
    state.tv.hoursPerDay = tvHours;
    state.tv.years = tvYears;

    state.activities.forEach(function (activity) {
      var nameInput = document.getElementById(activity.id + '-name');
      var name = nameInput ? nameInput.value.trim() : '';
      var amount = validateNumber(activity.id + '-amount', {
        max: activity.unit === 'week' ? 168 : 24,
        rangeMessage: activity.unit === 'week' ? t.errors.hoursPerWeek : t.errors.hoursPerDay
      });
      var years = validateNumber(activity.id + '-years', { max: age, rangeMessage: t.errors.habitYears });

      if (!name && (amount || years)) {
        setError(activity.id + '-name', t.errors.activityName);
      }
      activity.name = name;
      activity.amount = amount;
      activity.years = years;
    });

    paintErrors();

    var bad = firstErrorId();
    if (bad) {
      announce(t.errors.summary);
      openPanelForInput(bad);
      var el = document.getElementById(bad);
      if (el) {
        scrollToElement(el.closest('.panel') || el);
        el.focus();
      }
      return false;
    }
    announce('');
    return true;
  }

  /* ------------------------------------------------------------------ *
   * Step 1 + step 2 markup
   * ------------------------------------------------------------------ */

  function field(options) {
    var id = options.id;
    var help = options.help
      ? '<p class="field-help" id="' + id + '-help">' + esc(options.help) + '</p>'
      : '';
    var describedBy = options.help ? ' aria-describedby="' + id + '-help"' : '';
    return (
      '<div class="field' + (options.wide ? ' field-wide' : '') + '">' +
      '<label for="' + id + '">' + esc(options.label) + '</label>' +
      '<input id="' + id + '" name="' + id + '" type="number" inputmode="decimal"' +
      (options.min != null ? ' min="' + options.min + '"' : '') +
      (options.max != null ? ' max="' + options.max + '"' : '') +
      (options.step != null ? ' step="' + options.step + '"' : ' step="any"') +
      (options.value != null ? ' value="' + esc(options.value) + '"' : '') +
      (options.placeholder != null ? ' placeholder="' + esc(options.placeholder) + '"' : '') +
      describedBy +
      '>' +
      help +
      '<p class="field-error" data-error="' + id + '" id="' + id + '-error" hidden></p>' +
      '</div>'
    );
  }

  function panel(key, title, question, bodyHtml, isFirst) {
    var meta = CATEGORY_META[key];
    return (
      '<section class="panel' + (isFirst ? ' is-open' : '') + '" data-panel="' + key + '">' +
      '<h3 class="panel-heading">' +
      '<button type="button" class="panel-head" id="panel-' + key + '-head" ' +
      'aria-expanded="' + (isFirst ? 'true' : 'false') + '" aria-controls="panel-' + key + '-body">' +
      '<span class="panel-emoji" aria-hidden="true">' + meta.emoji + '</span>' +
      '<span class="panel-title">' + esc(title) + '</span>' +
      '<span class="panel-summary" data-summary="' + key + '"></span>' +
      '<span class="panel-chevron" aria-hidden="true"></span>' +
      '</button></h3>' +
      '<div class="panel-body" id="panel-' + key + '-body" role="region" ' +
      'aria-labelledby="panel-' + key + '-head"' + (isFirst ? '' : ' hidden') + '>' +
      '<p class="panel-question">' + esc(question) + '</p>' +
      bodyHtml +
      '<button type="button" class="btn btn-quiet panel-next">' + esc(t.panelDone) + '</button>' +
      '</div>' +
      '</section>'
    );
  }

  function renderCalculator() {
    var root = $('#calculator');
    if (!root) return;

    var stepNav =
      '<ol class="stepnav" aria-label="' + esc(template(t.stepOf, { n: 1 })) + '">' +
      t.steps
        .map(function (label, index) {
          return (
            '<li class="stepnav-item" data-step="' + (index + 1) + '">' +
            '<span class="stepnav-num">' + (index + 1) + '</span>' +
            '<span class="stepnav-label">' + esc(label) + '</span>' +
            '</li>'
          );
        })
        .join('') +
      '</ol>';

    var step1 =
      '<section class="step" data-step="1" aria-labelledby="step1-title">' +
      '<h2 class="step-title" id="step1-title">' + esc(t.step1Title) + '</h2>' +
      '<p class="step-help">' + esc(t.step1Help) + '</p>' +
      '<div class="age-field">' +
      field({
        id: 'age',
        label: t.ageLabel,
        min: MIN_AGE,
        max: MAX_AGE,
        step: 1,
        placeholder: '46'
      }) +
      '</div>' +
      '<div class="step-actions">' +
      '<button type="button" class="btn btn-primary" data-action="to-step-2">' + esc(t.continue) + '</button>' +
      '</div>' +
      '</section>';

    var sleepBody =
      '<div class="field-grid">' +
      field({ id: 'sleep-hours', label: t.sleepHours, min: 0, max: 24, step: 0.5, placeholder: '8' }) +
      '</div>' +
      '<p class="panel-note">' + esc(t.sleepHelp) + '</p>';

    var workBody =
      '<div class="field-grid">' +
      field({ id: 'work-years', label: t.workYears, min: 0, max: MAX_AGE, step: 1, placeholder: '25' }) +
      field({ id: 'work-hours', label: t.workHours, min: 0, max: 168, step: 1, placeholder: '40' }) +
      field({
        id: 'work-weeks',
        label: t.workWeeks,
        min: 1,
        max: 52,
        step: 1,
        value: DEFAULT_WORK_WEEKS_PER_YEAR,
        help: t.workWeeksHelp,
        wide: true
      }) +
      '</div>';

    var commuteBody =
      '<div class="field-grid">' +
      field({ id: 'commute-years', label: t.commuteYears, min: 0, max: MAX_AGE, step: 1, placeholder: '20' }) +
      field({ id: 'commute-minutes', label: t.commuteMinutes, min: 0, max: 1440, step: 5, placeholder: '60' }) +
      field({ id: 'commute-days', label: t.commuteDays, min: 0, max: 7, step: 1, value: 5 }) +
      '</div>' +
      '<p class="panel-note">' + esc(t.commuteHelp) + '</p>';

    var phoneBody =
      '<div class="field-grid">' +
      field({ id: 'phone-hours', label: t.phoneHours, min: 0, max: 24, step: 0.5, placeholder: '3' }) +
      field({ id: 'phone-years', label: t.phoneYears, min: 0, max: MAX_AGE, step: 1, placeholder: '12' }) +
      '</div>' +
      '<p class="panel-note">' + esc(t.phoneHelp) + '</p>';

    var tvBody =
      '<div class="field-grid">' +
      field({ id: 'tv-hours', label: t.tvHours, min: 0, max: 24, step: 0.5, placeholder: '2' }) +
      field({ id: 'tv-years', label: t.tvYears, min: 0, max: MAX_AGE, step: 1, placeholder: '20' }) +
      '</div>' +
      '<p class="panel-note">' + esc(t.tvHelp) + '</p>';

    var extras =
      '<section class="extras">' +
      '<h3 class="extras-title">' + esc(t.extrasTitle) + '</h3>' +
      '<div class="activities" id="activities"></div>' +
      '<button type="button" class="btn btn-ghost" id="add-activity" aria-expanded="false" ' +
      'aria-controls="activity-picker">' + esc(t.addActivity) + '</button>' +
      '<div class="activity-picker" id="activity-picker" hidden>' +
      '<p class="activity-picker-hint">' + esc(t.addActivityHint) + '</p>' +
      '<div class="chips">' +
      ACTIVITY_PRESETS.map(function (preset) {
        var label = preset.key === 'custom'
          ? (lang === 'pt-BR' ? 'Personalizado' : 'Custom')
          : t.activityNames[preset.key];
        return (
          '<button type="button" class="chip" data-preset="' + preset.key + '">' +
          '<span aria-hidden="true">' + preset.emoji + '</span> ' + esc(label) +
          '</button>'
        );
      }).join('') +
      '</div></div>' +
      '</section>';

    var step2 =
      '<section class="step" data-step="2" hidden aria-labelledby="step2-title">' +
      '<h2 class="step-title" id="step2-title">' + esc(t.step2Title) + '</h2>' +
      '<p class="step-help">' + esc(t.step2Help) + '</p>' +
      '<div class="panels">' +
      panel('sleep', t.categories.sleep, t.sleepQuestion, sleepBody, true) +
      panel('work', t.categories.work, t.workQuestion, workBody, false) +
      panel('commute', t.categories.commute, t.commuteQuestion, commuteBody, false) +
      panel('phone', t.categories.phone, t.phoneQuestion, phoneBody, false) +
      panel('tv', t.categories.tv, t.tvQuestion, tvBody, false) +
      '</div>' +
      extras +
      '<p class="form-status" id="form-status" role="status" aria-live="polite"></p>' +
      '<div class="step-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="to-step-1">' + esc(t.back) + '</button>' +
      '<button type="button" class="btn btn-primary" data-action="submit">' + esc(t.submit) + '</button>' +
      '</div>' +
      '</section>';

    root.innerHTML = '<form class="calc-form" novalidate>' + stepNav + step1 + step2 + '</form>';

    root.addEventListener('submit', function (event) {
      event.preventDefault();
    });

    wireCalculator(root);
  }

  /* ------------------------------------------------------------------ *
   * Step behaviour
   * ------------------------------------------------------------------ */

  var currentStep = 1;

  function setStep(step) {
    currentStep = step;
    $$('#calculator .step').forEach(function (el) {
      el.hidden = Number(el.getAttribute('data-step')) !== step;
    });
    $$('.stepnav-item').forEach(function (el) {
      var n = Number(el.getAttribute('data-step'));
      el.classList.toggle('is-current', n === step);
      el.classList.toggle('is-done', n < step);
      if (n === step) {
        el.setAttribute('aria-current', 'step');
      } else {
        el.removeAttribute('aria-current');
      }
    });
    var active = $('#calculator .step[data-step="' + step + '"]');
    if (active) focusHeading($('.step-title', active));
  }

  function openPanel(key) {
    $$('.panel').forEach(function (el) {
      var isTarget = el.getAttribute('data-panel') === key;
      el.classList.toggle('is-open', isTarget);
      var head = $('.panel-head', el);
      var body = $('.panel-body', el);
      if (head) head.setAttribute('aria-expanded', isTarget ? 'true' : 'false');
      if (body) body.hidden = !isTarget;
    });
    updatePanelSummaries();
  }

  function togglePanel(key) {
    var el = $('.panel[data-panel="' + key + '"]');
    if (el && el.classList.contains('is-open')) {
      el.classList.remove('is-open');
      $('.panel-head', el).setAttribute('aria-expanded', 'false');
      $('.panel-body', el).hidden = true;
      updatePanelSummaries();
    } else {
      openPanel(key);
    }
  }

  function openPanelForInput(inputId) {
    var input = document.getElementById(inputId);
    if (!input) return;
    var panelEl = input.closest ? input.closest('.panel') : null;
    if (panelEl) openPanel(panelEl.getAttribute('data-panel'));
  }

  /** The one-line recap shown on a collapsed panel header. */
  function summaryFor(key) {
    var value;
    var unitHours = 'h';
    var unitYears = lang === 'pt-BR' ? 'anos' : 'yrs';
    var perDay = lang === 'pt-BR' ? 'dia' : 'day';
    var perWeek = lang === 'pt-BR' ? 'sem' : 'wk';

    function n(id) {
      var v = readNumber(document.getElementById(id));
      return v === null || isNaN(v) ? null : v;
    }

    if (key === 'sleep') {
      value = n('sleep-hours');
      return value == null ? '' : fmtDec(value, value % 1 ? 1 : 0) + unitHours + '/' + perDay;
    }
    if (key === 'work') {
      var wy = n('work-years');
      var wh = n('work-hours');
      if (wy == null && wh == null) return '';
      return [
        wy == null ? null : fmtInt(wy) + ' ' + unitYears,
        wh == null ? null : fmtInt(wh) + unitHours + '/' + perWeek
      ].filter(Boolean).join(' · ');
    }
    if (key === 'commute') {
      var cy = n('commute-years');
      var cm = n('commute-minutes');
      if (cy == null && cm == null) return '';
      return [
        cy == null ? null : fmtInt(cy) + ' ' + unitYears,
        cm == null ? null : fmtInt(cm) + ' min'
      ].filter(Boolean).join(' · ');
    }
    if (key === 'phone' || key === 'tv') {
      var h = n(key + '-hours');
      var y = n(key + '-years');
      if (h == null && y == null) return '';
      return [
        h == null ? null : fmtDec(h, h % 1 ? 1 : 0) + unitHours + '/' + perDay,
        y == null ? null : fmtInt(y) + ' ' + unitYears
      ].filter(Boolean).join(' · ');
    }
    return '';
  }

  function updatePanelSummaries() {
    $$('[data-summary]').forEach(function (el) {
      el.textContent = summaryFor(el.getAttribute('data-summary'));
    });
  }

  var PANEL_ORDER = ['sleep', 'work', 'commute', 'phone', 'tv'];

  function wireCalculator(root) {
    root.addEventListener('click', function (event) {
      var target = event.target;
      var head = target.closest ? target.closest('.panel-head') : null;
      if (head) {
        togglePanel(head.closest('.panel').getAttribute('data-panel'));
        return;
      }

      var next = target.closest ? target.closest('.panel-next') : null;
      if (next) {
        var key = next.closest('.panel').getAttribute('data-panel');
        var index = PANEL_ORDER.indexOf(key);
        if (index > -1 && index < PANEL_ORDER.length - 1) {
          openPanel(PANEL_ORDER[index + 1]);
          var opened = $('.panel[data-panel="' + PANEL_ORDER[index + 1] + '"]');
          scrollToElement(opened);
          var firstInput = $('input', opened);
          if (firstInput) firstInput.focus();
        } else {
          openPanel(null);
          scrollToElement($('.extras'));
        }
        return;
      }

      var action = target.closest ? target.closest('[data-action]') : null;
      if (!action) return;

      var name = action.getAttribute('data-action');
      if (name === 'to-step-2') {
        if (validateStep1()) {
          setStep(2);
          scrollToElement($('#calculator'));
        } else {
          var ageInput = $('#age');
          if (ageInput) ageInput.focus();
        }
      } else if (name === 'to-step-1') {
        setStep(1);
        scrollToElement($('#calculator'));
      } else if (name === 'submit') {
        if (validateStep2()) showResults();
      }
    });

    root.addEventListener('input', function (event) {
      var input = event.target;
      if (input && input.id && errors[input.id]) {
        delete errors[input.id];
        paintErrors();
      }
      updatePanelSummaries();
    });

    // Enter should move forward rather than reload the page.
    root.addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      var target = event.target;
      if (!target || target.tagName !== 'INPUT') return;
      event.preventDefault();
      if (currentStep === 1) {
        if (validateStep1()) setStep(2);
      } else {
        var panelEl = target.closest('.panel');
        if (panelEl) {
          var nextBtn = $('.panel-next', panelEl);
          if (nextBtn) nextBtn.click();
        }
      }
    });

    var addBtn = $('#add-activity');
    var picker = $('#activity-picker');
    if (addBtn && picker) {
      addBtn.addEventListener('click', function () {
        var open = !picker.hidden;
        picker.hidden = open;
        addBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
        if (!open) {
          var chip = $('.chip', picker);
          if (chip) chip.focus();
        }
      });
      picker.addEventListener('click', function (event) {
        var chip = event.target.closest ? event.target.closest('.chip') : null;
        if (!chip) return;
        addActivity(chip.getAttribute('data-preset'));
        picker.hidden = true;
        addBtn.setAttribute('aria-expanded', 'false');
      });
    }

    updatePanelSummaries();
  }

  /* ------------------------------------------------------------------ *
   * Optional activities
   * ------------------------------------------------------------------ */

  function activityMarkup(activity) {
    var name = activity.name || '';
    var removeLabel = template(t.removeActivity, { name: name || t.thisActivity });
    return (
      '<div class="activity" data-activity="' + activity.id + '">' +
      '<div class="activity-head">' +
      '<span class="activity-emoji" aria-hidden="true">' + activity.emoji + '</span>' +
      '<div class="field field-name">' +
      '<label for="' + activity.id + '-name">' + esc(t.activityNameLabel) + '</label>' +
      '<input id="' + activity.id + '-name" type="text" value="' + esc(name) + '" ' +
      'placeholder="' + esc(t.activityNamePlaceholder) + '" autocomplete="off">' +
      '<p class="field-error" data-error="' + activity.id + '-name" id="' + activity.id + '-name-error" hidden></p>' +
      '</div>' +
      '<button type="button" class="activity-remove" data-remove="' + activity.id + '" ' +
      'aria-label="' + esc(removeLabel) + '">&times;</button>' +
      '</div>' +
      '<div class="field-grid">' +
      field({ id: activity.id + '-amount', label: t.activityAmount, min: 0, max: 168, step: 0.5, placeholder: '1' }) +
      '<div class="field">' +
      '<label for="' + activity.id + '-unit">' + esc(t.activityUnit) + '</label>' +
      '<select id="' + activity.id + '-unit" data-unit="' + activity.id + '">' +
      '<option value="day"' + (activity.unit === 'day' ? ' selected' : '') + '>' + esc(t.activityPerDay) + '</option>' +
      '<option value="week"' + (activity.unit === 'week' ? ' selected' : '') + '>' + esc(t.activityPerWeek) + '</option>' +
      '</select>' +
      '</div>' +
      field({ id: activity.id + '-years', label: t.activityYears, min: 0, max: MAX_AGE, step: 1, placeholder: '10' }) +
      '</div>' +
      '</div>'
    );
  }

  function addActivity(presetKey) {
    var preset = null;
    for (var i = 0; i < ACTIVITY_PRESETS.length; i++) {
      if (ACTIVITY_PRESETS[i].key === presetKey) preset = ACTIVITY_PRESETS[i];
    }
    if (!preset) preset = ACTIVITY_PRESETS[ACTIVITY_PRESETS.length - 1];

    activitySeq += 1;
    var activity = {
      id: 'activity-' + activitySeq,
      preset: preset.key,
      emoji: preset.emoji,
      name: t.activityNames[preset.key] || '',
      unit: 'day',
      amount: null,
      years: null
    };
    state.activities.push(activity);

    var container = $('#activities');
    container.insertAdjacentHTML('beforeend', activityMarkup(activity));

    var node = $('.activity[data-activity="' + activity.id + '"]');
    $('[data-remove]', node).addEventListener('click', function () {
      removeActivity(activity.id);
    });
    $('[data-unit]', node).addEventListener('change', function (event) {
      activity.unit = event.target.value;
    });

    var focusTarget = activity.name
      ? document.getElementById(activity.id + '-amount')
      : document.getElementById(activity.id + '-name');
    if (focusTarget) focusTarget.focus();
    scrollToElement(node);
  }

  function removeActivity(id) {
    state.activities = state.activities.filter(function (activity) {
      return activity.id !== id;
    });
    var node = $('.activity[data-activity="' + id + '"]');
    if (node && node.parentNode) node.parentNode.removeChild(node);
    var addBtn = $('#add-activity');
    if (addBtn) addBtn.focus();
  }

  /* ------------------------------------------------------------------ *
   * Reveal animation
   * ------------------------------------------------------------------ */

  function countUp(el, to, formatter) {
    if (prefersReducedMotion()) {
      el.textContent = formatter(to);
      return;
    }
    var duration = 900;
    var start = null;
    function frame(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = formatter(to * eased);
      if (progress < 1) window.requestAnimationFrame(frame);
    }
    window.requestAnimationFrame(frame);
  }

  function revealIn(root) {
    if (prefersReducedMotion()) return;
    $$('[data-reveal]', root).forEach(function (el, index) {
      el.style.animationDelay = index * 70 + 'ms';
      el.classList.add('reveal');
    });
  }

  /* ------------------------------------------------------------------ *
   * Results
   * ------------------------------------------------------------------ */

  var results = null;

  function detailText(segment) {
    return (
      segment.label + ' — ' +
      fmtYears(segment.calendarYears) + ' ' + yearsWord(segment.calendarYears) + ' · ' +
      fmtInt(segment.days) + ' ' + t.days + ' · ' +
      fmtInt(segment.hours) + ' ' + t.hours + ' · ' +
      fmtPct(segment.percent) + ' ' + t.ofYourLife
    );
  }

  function lifeBarMarkup(data) {
    var segments = data.categories.slice();
    if (data.unaccounted && data.unaccounted.hours > 0) segments.push(data.unaccounted);

    var scale = data.overlap ? data.accountedHours : data.lifetimeHours;

    var bar = segments
      .map(function (segment) {
        var width = scale > 0 ? (segment.hours / scale) * 100 : 0;
        return (
          '<li class="lifebar-item" style="--w:' + width.toFixed(4) + '%;--c:' + segment.color + '">' +
          '<button type="button" class="lifebar-seg pattern-' + segment.pattern + '" ' +
          'data-segment="' + esc(segment.id) + '" aria-label="' + esc(detailText(segment)) + '">' +
          '<span class="sr-only">' + esc(segment.label) + '</span>' +
          '</button></li>'
        );
      })
      .join('');

    var legend = segments
      .map(function (segment) {
        return (
          '<button type="button" class="legend-item" data-segment="' + esc(segment.id) + '" ' +
          'style="--c:' + segment.color + '">' +
          '<span class="legend-swatch pattern-' + segment.pattern + '" aria-hidden="true"></span>' +
          '<span class="legend-label">' +
          (segment.emoji ? '<span aria-hidden="true">' + segment.emoji + '</span> ' : '') +
          esc(segment.label) + '</span>' +
          '<span class="legend-value">' + esc(fmtPct(segment.percent)) + '</span>' +
          '</button>'
        );
      })
      .join('');

    return (
      '<section class="lifebar-block" data-reveal>' +
      '<h3 class="section-kicker">' + esc(t.lifeBarTitle) + '</h3>' +
      '<p class="section-note">' + esc(t.lifeBarHelp) + '</p>' +
      (data.overlap ? '<p class="section-note section-note-warn">' + esc(t.lifeBarOverlapNote) + '</p>' : '') +
      '<ul class="lifebar" id="lifebar">' + bar + '</ul>' +
      '<p class="lifebar-detail" id="lifebar-detail" role="status" aria-live="polite">' +
      esc(t.lifeBarHint) + '</p>' +
      '<div class="legend">' + legend + '</div>' +
      '</section>'
    );
  }

  function cardsMarkup(data) {
    var cards = data.categories
      .slice()
      .sort(function (a, b) {
        return b.hours - a.hours;
      })
      .map(function (segment) {
        return (
          '<article class="result-card" style="--c:' + segment.color + '" data-reveal>' +
          '<h4 class="result-card-title">' +
          (segment.emoji ? '<span class="result-card-emoji" aria-hidden="true">' + segment.emoji + '</span>' : '') +
          esc(segment.label) + '</h4>' +
          '<p class="result-card-years"><strong>' + esc(fmtYears(segment.calendarYears)) + '</strong> ' +
          '<span>' + esc(yearsWord(segment.calendarYears)) + '</span></p>' +
          '<p class="result-card-percent">' + esc(fmtPct(segment.percent)) + ' ' + esc(t.ofYourLife) + '</p>' +
          '<dl class="result-card-meta">' +
          '<div><dt>' + esc(t.days) + '</dt><dd>' + esc(fmtInt(segment.days)) + '</dd></div>' +
          '<div><dt>' + esc(t.hours) + '</dt><dd>' + esc(fmtInt(segment.hours)) + '</dd></div>' +
          '</dl>' +
          '</article>'
        );
      })
      .join('');

    return (
      '<section class="result-cards-block" data-reveal>' +
      '<h3 class="section-kicker">' + esc(t.cardsTitle) + '</h3>' +
      '<div class="result-cards">' + cards + '</div>' +
      '</section>'
    );
  }

  function unaccountedMarkup(data) {
    if (data.overlap) {
      return (
        '<section class="overlap" role="note" data-reveal>' +
        '<h3 class="overlap-title">' + esc(t.overlapTitle) + '</h3>' +
        t.overlapBody
          .split('\n')
          .map(function (line) {
            return '<p>' + esc(line) + '</p>';
          })
          .join('') +
        '<p class="overlap-unknown"><strong>' + esc(t.unaccountedTitle) + ':</strong> ' +
        esc(t.unaccountedUnknown) + '</p>' +
        '<button type="button" class="btn btn-ghost" data-action="edit">' + esc(t.overlapFix) + '</button>' +
        '</section>'
      );
    }

    var u = data.unaccounted;
    return (
      '<section class="unaccounted" data-reveal>' +
      '<h3 class="unaccounted-title">' + esc(t.unaccountedTitle) + '</h3>' +
      '<p class="unaccounted-years"><strong>' + esc(fmtYears(u.calendarYears)) + '</strong> ' +
      esc(yearsWord(u.calendarYears)) + '</p>' +
      '<p class="unaccounted-percent">' + esc(fmtPct(u.percent)) + ' ' + esc(t.ofYourLife) + '</p>' +
      '<p class="unaccounted-body">' + esc(t.unaccountedBody) + '</p>' +
      '</section>'
    );
  }

  function renderResults(data) {
    var root = $('#result');

    root.innerHTML =
      '<div class="result-inner">' +
      '<section class="result-hero" data-reveal>' +
      '<h2 class="result-hero-title" id="result-title">' +
      esc(template(t.resultTitle, { age: fmtInt(data.age) })) + '</h2>' +
      '<p class="result-hero-sub">' + esc(t.resultSub) + '</p>' +
      '<dl class="bignums">' +
      '<div class="bignum"><dd class="bignum-value" id="bignum-days">0</dd>' +
      '<dt class="bignum-label">' + esc(t.resultDays) + '</dt></div>' +
      '<div class="bignum"><dd class="bignum-value" id="bignum-hours">0</dd>' +
      '<dt class="bignum-label">' + esc(t.resultHours) + '</dt></div>' +
      '</dl>' +
      '</section>' +
      lifeBarMarkup(data) +
      cardsMarkup(data) +
      unaccountedMarkup(data) +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-ghost" data-action="edit">' + esc(t.editAnswers) + '</button>' +
      '<button type="button" class="btn btn-ghost" data-action="restart">' + esc(t.startOver) + '</button>' +
      '</div>' +
      '</div>';

    root.hidden = false;

    countUp($('#bignum-days'), data.lifetimeDays, fmtInt);
    countUp($('#bignum-hours'), data.lifetimeHours, fmtInt);
    revealIn(root);
    wireLifeBar(data);

    // #result survives every re-render, so its delegated handler is bound once.
    // Binding per render would stack duplicates each time answers are edited.
    if (!root.getAttribute('data-wired')) {
      root.setAttribute('data-wired', 'true');
      root.addEventListener('click', function (event) {
        var action = event.target.closest ? event.target.closest('[data-action]') : null;
        if (!action) return;
        if (action.getAttribute('data-action') === 'edit') {
          setStep(2);
          scrollToElement($('#calculator'));
        } else if (action.getAttribute('data-action') === 'restart') {
          window.location.reload();
        }
      });
    }
  }

  function wireLifeBar(data) {
    var detail = $('#lifebar-detail');
    var all = {};
    data.categories.forEach(function (segment) {
      all[segment.id] = segment;
    });
    if (data.unaccounted) all[data.unaccounted.id] = data.unaccounted;

    function show(id) {
      var segment = all[id];
      if (!segment || !detail) return;
      detail.textContent = detailText(segment);
      $$('#result [data-segment]').forEach(function (el) {
        el.classList.toggle('is-active', el.getAttribute('data-segment') === id);
      });
    }

    function reset() {
      if (detail) detail.textContent = t.lifeBarHint;
      $$('#result [data-segment]').forEach(function (el) {
        el.classList.remove('is-active');
      });
    }

    // While a segment holds keyboard focus it owns the detail region: a stray
    // hover (the page scrolling under a stationary pointer, for instance) must
    // not silently replace what a keyboard user just selected.
    function segmentHasFocus() {
      var active = document.activeElement;
      return !!(active && active.getAttribute && active.getAttribute('data-segment'));
    }

    $$('#result [data-segment]').forEach(function (el) {
      var id = el.getAttribute('data-segment');
      el.addEventListener('mouseenter', function () {
        if (!segmentHasFocus()) show(id);
      });
      el.addEventListener('focus', function () {
        show(id);
      });
      el.addEventListener('click', function () {
        show(id);
      });
    });

    var bar = $('#lifebar');
    if (bar) {
      bar.addEventListener('mouseleave', function () {
        if (!segmentHasFocus()) reset();
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Reclaim
   * ------------------------------------------------------------------ */

  var REDUCTION_OPTIONS = [15, 30, 45, 60, 90, 120];
  var reclaimUpdate = null;

  function reductionLabel(minutes) {
    if (minutes % 60 === 0) {
      var hours = minutes / 60;
      if (hours === 1) return t.oneHourPerDay;
      return template(t.hoursPerDay, { n: fmtInt(hours) });
    }
    return template(t.minutesPerDay, { n: fmtInt(minutes) });
  }

  /** "ONE HOUR LESS", "30 MINUTES LESS" — also used on the share card. */
  function reductionAmountPhrase(minutes) {
    if (lang === 'pt-BR') {
      if (minutes === 60) return 'uma hora';
      if (minutes === 120) return 'duas horas';
      if (minutes % 60 === 0) return fmtInt(minutes / 60) + ' horas';
      return fmtInt(minutes) + ' minutos';
    }
    if (minutes === 60) return 'one hour';
    if (minutes === 120) return 'two hours';
    if (minutes % 60 === 0) return fmtInt(minutes / 60) + ' hours';
    return fmtInt(minutes) + ' minutes';
  }

  W.reductionAmountPhrase = reductionAmountPhrase;

  function reclaimCategoryOptions(data) {
    var options = data.categories
      .filter(function (segment) {
        return segment.hoursPerDay && segment.hoursPerDay > 0;
      })
      .map(function (segment) {
        return { value: segment.id, label: segment.label, emoji: segment.emoji };
      });
    options.push({ value: 'other', label: t.reclaimSomethingElse, emoji: '⏳' });
    return options;
  }

  function renderReclaim(data) {
    var root = $('#reclaim');
    var options = reclaimCategoryOptions(data);

    var preferred = null;
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === 'phone') preferred = 'phone';
    }
    state.reclaim.categoryId = preferred || options[0].value;

    var minTarget = Math.min(Math.ceil(data.age) + 1, MAX_AGE);
    if (state.reclaim.targetAge <= data.age) state.reclaim.targetAge = minTarget;

    root.innerHTML =
      '<div class="reclaim-inner">' +
      '<h2 class="section-title" id="reclaim-title">' + esc(t.reclaimTitle) + '</h2>' +
      '<p class="section-lead">' + esc(t.reclaimLead) + '</p>' +
      '<div class="reclaim-controls">' +
      '<div class="field">' +
      '<label for="reclaim-category">' + esc(t.reclaimCategory) + '</label>' +
      '<select id="reclaim-category">' +
      options
        .map(function (option) {
          return (
            '<option value="' + esc(option.value) + '"' +
            (option.value === state.reclaim.categoryId ? ' selected' : '') + '>' +
            (option.emoji ? option.emoji + ' ' : '') + esc(option.label) + '</option>'
          );
        })
        .join('') +
      '</select>' +
      '</div>' +
      '<fieldset class="reclaim-amounts">' +
      '<legend>' + esc(t.reclaimAmount) + '</legend>' +
      '<div class="chips chips-radio">' +
      REDUCTION_OPTIONS.map(function (minutes) {
        var id = 'reduce-' + minutes;
        return (
          '<span class="chip-radio">' +
          '<input type="radio" name="reduction" id="' + id + '" value="' + minutes + '"' +
          (minutes === state.reclaim.minutesPerDay ? ' checked' : '') + '>' +
          '<label for="' + id + '">' + esc(reductionLabel(minutes)) + '</label>' +
          '</span>'
        );
      }).join('') +
      '<span class="chip-radio">' +
      '<input type="radio" name="reduction" id="reduce-custom" value="custom">' +
      '<label for="reduce-custom">' + esc(t.reclaimCustom) + '</label>' +
      '</span>' +
      '</div>' +
      '<div class="field field-inline" id="reclaim-custom-wrap" hidden>' +
      '<label for="reclaim-custom">' + esc(t.reclaimCustomLabel) + '</label>' +
      '<input id="reclaim-custom" type="number" inputmode="numeric" min="1" max="1440" step="5" value="75">' +
      '</div>' +
      '</fieldset>' +
      '<div class="field">' +
      '<label for="reclaim-age">' + esc(t.reclaimTargetAge) + '</label>' +
      '<input id="reclaim-age" type="number" inputmode="numeric" min="' + minTarget + '" max="' + MAX_AGE + '" ' +
      'step="1" value="' + Math.max(state.reclaim.targetAge, minTarget) + '">' +
      '<p class="field-error" data-error="reclaim-age" id="reclaim-age-error" hidden></p>' +
      '</div>' +
      '</div>' +
      '<div class="reclaim-output" id="reclaim-output" aria-live="polite"></div>' +
      '<details class="tip">' +
      '<summary>' + esc(t.wakingTipTitle) + '</summary>' +
      '<p id="waking-tip-body"></p>' +
      '</details>' +
      '<p class="reclaim-note">' + esc(t.reclaimNote) + '</p>' +
      '</div>';

    root.hidden = false;

    var customWrap = $('#reclaim-custom-wrap');
    var customInput = $('#reclaim-custom');

    function readMinutes() {
      var checked = $('input[name="reduction"]:checked');
      if (!checked) return state.reclaim.minutesPerDay;
      if (checked.value === 'custom') {
        var value = readNumber(customInput);
        if (value === null || isNaN(value) || value <= 0) return 0;
        return Math.min(value, 1440);
      }
      return Number(checked.value);
    }

    function update(fromInteraction) {
      var checked = $('input[name="reduction"]:checked');
      var isCustom = checked && checked.value === 'custom';
      customWrap.hidden = !isCustom;

      state.reclaim.minutesPerDay = readMinutes();

      clearErrors();
      var ageInput = $('#reclaim-age');
      var targetAge = readNumber(ageInput);
      var minAllowed = minTarget;
      if (targetAge === null || isNaN(targetAge) || targetAge <= data.age || targetAge > MAX_AGE) {
        setError('reclaim-age', template(t.errors.targetAge, { min: fmtInt(minAllowed) }));
        paintErrors();
        $('#reclaim-output').innerHTML = '';
        W.reclaim = null;
        emit('wdmtg:reclaim', null);
        return;
      }
      paintErrors();
      state.reclaim.targetAge = targetAge;

      var reclaim = computeReclaim(data);
      W.reclaim = reclaim;
      renderReclaimOutput(reclaim, data);
      emit('wdmtg:reclaim', reclaim);

      if (fromInteraction) {
        trackEvent('reclaim_simulated', {
          minutesPerDay: state.reclaim.minutesPerDay,
          targetAge: targetAge,
          category: state.reclaim.categoryId
        });
      }
    }

    // Same as #result: bind once, and let the handlers call whichever update
    // closure belongs to the latest render.
    reclaimUpdate = update;
    if (!root.getAttribute('data-wired')) {
      root.setAttribute('data-wired', 'true');
      root.addEventListener('change', function (event) {
        if (event.target.id === 'reclaim-category') {
          state.reclaim.categoryId = event.target.value;
        }
        if (reclaimUpdate) reclaimUpdate(true);
      });
      root.addEventListener('input', function (event) {
        if (event.target.id !== 'reclaim-custom' && event.target.id !== 'reclaim-age') return;
        if (reclaimUpdate) reclaimUpdate(true);
      });
    }

    update(false);
  }

  function renderReclaimOutput(reclaim, data) {
    var out = $('#reclaim-output');
    if (!reclaim) {
      out.innerHTML = '';
      return;
    }

    var headline = template(t.reclaimHeadline, {
      amount: reductionAmountPhrase(reclaim.minutesPerDay),
      age: fmtInt(reclaim.targetAge)
    });

    var overNote = '';
    if (reclaim.categoryHoursPerDay && reclaim.minutesPerDay / 60 > reclaim.categoryHoursPerDay) {
      var current = fmtInt(reclaim.categoryHoursPerDay * 60) + ' min/' + (lang === 'pt-BR' ? 'dia' : 'day');
      overNote = '<p class="reclaim-warn">' + esc(template(t.reclaimOverAmount, { current: current })) + '</p>';
    }

    var calendarWord = isSingular(reclaim.calendarYears, 2) ? t.reclaimYearsSingular : t.reclaimYears;
    var wakingWord = isSingular(reclaim.wakingYears, 1) ? t.reclaimWakingYear : t.reclaimWakingYears;

    out.innerHTML =
      '<p class="reclaim-headline">' + esc(headline) + '</p>' +
      '<dl class="reclaim-numbers">' +
      '<div><dd>' + esc(fmtInt(reclaim.hours)) + '</dd><dt>' + esc(t.reclaimHours) + '</dt></div>' +
      '<div><dd>' + esc(fmtInt(reclaim.days)) + '</dd><dt>' + esc(t.reclaimDays) + '</dt></div>' +
      '<div><dd>' + esc(fmtDec(reclaim.calendarYears, 2)) + '</dd><dt>' + esc(calendarWord) + '</dt></div>' +
      '</dl>' +
      overNote +
      '<p class="reclaim-another">' + esc(t.reclaimAnother) + '</p>' +
      '<p class="reclaim-waking"><strong>' + esc(fmtYears(reclaim.wakingYears)) + ' ' + esc(wakingWord) + '</strong> ' +
      esc(t.reclaimWaking) + '</p>';

    var tip = $('#waking-tip-body');
    if (tip) {
      tip.textContent = template(t.wakingTipBody, {
        sleep: fmtDec(data.sleepHoursPerDay, data.sleepHoursPerDay % 1 ? 1 : 0),
        hours: fmtInt(reclaim.wakingYearHours)
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Flow
   * ------------------------------------------------------------------ */

  function showResults() {
    results = computeResults();
    W.results = results;

    setStep(3);
    renderResults(results);
    renderReclaim(results);

    var share = $('#share');
    if (share) share.hidden = false;

    emit('wdmtg:results', results);

    trackEvent('calculator_completed', {
      age: results.age,
      categories: results.categories.length,
      overlap: results.overlap
    });

    scrollToElement($('#result'));
  }

  function start() {
    var calculator = $('#calculator');
    if (!calculator) return;
    calculator.hidden = false;
    trackEvent('calculator_started', {});
    scrollToElement(calculator);
    var age = $('#age');
    if (age) age.focus();
  }

  function init() {
    renderCalculator();
    setStep(1);

    var cta = $('#start-cta');
    if (cta) {
      cta.addEventListener('click', function (event) {
        event.preventDefault();
        start();
      });
    }

    // Deep link for testing: /en/?demo=46 fills a 46-year-old example.
    var demo = /[?&]demo=(\d+)/.exec(window.location.search);
    if (demo) {
      calculatorDemo(Number(demo[1]));
    }
  }

  /** Fills the form with a plausible example. Used by ?demo=46 while testing. */
  function calculatorDemo(age) {
    start();
    $('#age').value = age;
    if (!validateStep1()) return;
    setStep(2);
    $('#sleep-hours').value = 8;
    $('#work-years').value = Math.max(0, age - 22);
    $('#work-hours').value = 40;
    $('#commute-years').value = Math.max(0, age - 24);
    $('#commute-minutes').value = 60;
    $('#phone-hours').value = 3;
    $('#phone-years').value = Math.min(age, 12);
    $('#tv-hours').value = 2;
    $('#tv-years').value = Math.min(age, 25);
    updatePanelSummaries();
    if (validateStep2()) showResults();
  }

  W.demo = calculatorDemo;
  W.state = state;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
