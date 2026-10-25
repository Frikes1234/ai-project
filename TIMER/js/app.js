/**
 * Несколько таймеров сразу: праздники и свои события хранятся списком
 * и обновляются одним интервалом каждую секунду.
 * Код обёрнут в IIFE, чтобы не засорять глобальную область.
 */
(function (global) {
  "use strict";

  var DATA = global.EventTimerNS;
  if (!DATA) {
    return;
  }

  var STORAGE_KEY = "eventTimer.board";
  var OLD_STORAGE_KEY = "eventTimer.selected";
  var MAX_TIMERS = 20;
  var timerId = null;
  var pendingAction = null;
  var board = {
    timers: [],
    featuredId: null
  };

  var els = {
    title: document.getElementById("event-title"),
    date: document.getElementById("event-date"),
    days: document.getElementById("days"),
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    arrived: document.getElementById("arrived-message"),
    presets: document.getElementById("preset-events"),
    form: document.getElementById("custom-form"),
    customSubmit: document.getElementById("custom-submit"),
    customName: document.getElementById("custom-name"),
    customDate: document.getElementById("custom-date"),
    list: document.getElementById("timers-list"),
    empty: document.getElementById("timers-empty"),
    fact: document.getElementById("fact-of-day"),
    image: document.getElementById("image-of-day"),
    imageCaption: document.getElementById("image-caption"),
    quote: document.getElementById("quote-of-day"),
    modal: document.getElementById("confirm-modal"),
    confirmText: document.getElementById("confirm-text"),
    confirmYes: document.getElementById("confirm-yes"),
    confirmNo: document.getElementById("confirm-no")
  };

  /**
   * Православная Пасха: юлианская формула + 13 дней для XXI века.
   * Если праздник в этом году уже прошёл, берём следующий год.
   */
  function orthodoxEaster(year) {
    var a = year % 4;
    var b = year % 7;
    var c = year % 19;
    var d = (19 * c + 15) % 30;
    var e = (2 * a + 4 * b - d + 34) % 7;
    var month = Math.floor((d + e + 114) / 31);
    var day = ((d + e + 114) % 31) + 1;
    var date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + 13);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function nextEaster() {
    var year = new Date().getFullYear();
    var date = orthodoxEaster(year);
    if (date.getTime() < Date.now()) {
      date = orthodoxEaster(year + 1);
    }
    return date;
  }

  function nextHalloween() {
    var now = new Date();
    var date = new Date(now.getFullYear(), 9, 31, 0, 0, 0, 0);
    if (date.getTime() < Date.now()) {
      date = new Date(now.getFullYear() + 1, 9, 31, 0, 0, 0, 0);
    }
    return date;
  }

  function nextNewYear() {
    return new Date(new Date().getFullYear() + 1, 0, 1, 0, 0, 0, 0);
  }

  function createTimer(source, title, date) {
    return {
      id: "t-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      source: source,
      title: title,
      date: date
    };
  }

  function presetToTimer(id) {
    if (id === "easter") {
      return createTimer(id, "Пасха", nextEaster());
    }
    if (id === "halloween") {
      return createTimer(id, "Хэллоуин", nextHalloween());
    }
    return createTimer("newyear", "Новый год", nextNewYear());
  }

  function findById(id) {
    for (var i = 0; i < board.timers.length; i += 1) {
      if (board.timers[i].id === id) {
        return board.timers[i];
      }
    }
    return null;
  }

  function findBySource(source) {
    if (source === "custom") {
      return null;
    }
    for (var i = 0; i < board.timers.length; i += 1) {
      if (board.timers[i].source === source) {
        return board.timers[i];
      }
    }
    return null;
  }

  function featuredTimer() {
    return findById(board.featuredId) || board.timers[0] || null;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function formatDate(date) {
    return date.toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function remainingParts(target) {
    var diff = target.getTime() - Date.now();
    if (diff <= 0) {
      return { arrived: true, days: "00", hours: "00", minutes: "00", seconds: "00" };
    }
    var totalSeconds = Math.floor(diff / 1000);
    return {
      arrived: false,
      days: String(Math.floor(totalSeconds / 86400)),
      hours: pad(Math.floor((totalSeconds % 86400) / 3600)),
      minutes: pad(Math.floor((totalSeconds % 3600) / 60)),
      seconds: pad(totalSeconds % 60)
    };
  }

  function writeParts(nodes, parts, pulseSeconds) {
    if (pulseSeconds && nodes.seconds.textContent !== parts.seconds) {
      nodes.seconds.classList.remove("pulse");
      void nodes.seconds.offsetWidth;
      nodes.seconds.classList.add("pulse");
    }
    nodes.days.textContent = parts.days;
    nodes.hours.textContent = parts.hours;
    nodes.minutes.textContent = parts.minutes;
    nodes.seconds.textContent = parts.seconds;
    if (nodes.arrived) {
      nodes.arrived.hidden = !parts.arrived;
    }
  }

  function updateHero(timer) {
    if (!timer) {
      els.title.textContent = "Нет таймеров";
      els.date.textContent = "Добавьте событие, чтобы начать отсчёт";
      writeParts(
        { days: els.days, hours: els.hours, minutes: els.minutes, seconds: els.seconds, arrived: els.arrived },
        { arrived: false, days: "00", hours: "00", minutes: "00", seconds: "00" },
        false
      );
      return;
    }
    els.title.textContent = timer.title;
    els.date.textContent = formatDate(timer.date);
    writeParts(
      { days: els.days, hours: els.hours, minutes: els.minutes, seconds: els.seconds, arrived: els.arrived },
      remainingParts(timer.date),
      true
    );
  }

  function updateCard(timer) {
    var card = els.list.querySelector('[data-id="' + timer.id + '"]');
    if (!card) {
      return;
    }
    writeParts(
      {
        days: card.querySelector(".js-days"),
        hours: card.querySelector(".js-hours"),
        minutes: card.querySelector(".js-minutes"),
        seconds: card.querySelector(".js-seconds"),
        arrived: card.querySelector(".js-arrived")
      },
      remainingParts(timer.date),
      false
    );
    card.classList.toggle("is-featured", timer.id === board.featuredId);
  }

  // Один интервал двигает и главный таймер, и все карточки сразу.
  function tickAll() {
    updateHero(featuredTimer());
    for (var i = 0; i < board.timers.length; i += 1) {
      updateCard(board.timers[i]);
    }
  }

  function startClock() {
    if (timerId) {
      clearInterval(timerId);
    }
    tickAll();
    timerId = setInterval(tickAll, 1000);
  }

  function markActivePresets() {
    var buttons = els.presets.querySelectorAll(".event-btn");
    for (var i = 0; i < buttons.length; i += 1) {
      var source = buttons[i].getAttribute("data-id");
      buttons[i].classList.toggle("is-active", Boolean(findBySource(source)));
    }
  }

  function makeUnit(className, caption) {
    var unit = document.createElement("div");
    unit.className = "timer-unit";
    var value = document.createElement("span");
    value.className = "timer-value " + className;
    value.textContent = "00";
    var label = document.createElement("span");
    label.className = "timer-caption";
    label.textContent = caption;
    unit.appendChild(value);
    unit.appendChild(label);
    return unit;
  }

  function renderList() {
    els.list.textContent = "";
    els.empty.hidden = board.timers.length > 0;

    board.timers.forEach(function (timer) {
      var card = document.createElement("article");
      card.className = "mini-timer" + (timer.id === board.featuredId ? " is-featured" : "");
      card.setAttribute("data-id", timer.id);

      var heading = document.createElement("h3");
      heading.textContent = timer.title;
      var dateLine = document.createElement("p");
      dateLine.className = "event-date";
      dateLine.textContent = formatDate(timer.date);

      var row = document.createElement("div");
      row.className = "timer";
      row.setAttribute("aria-live", "polite");
      row.appendChild(makeUnit("js-days", "дней"));
      row.appendChild(makeUnit("js-hours", "часов"));
      row.appendChild(makeUnit("js-minutes", "минут"));
      row.appendChild(makeUnit("js-seconds", "секунд"));

      var arrived = document.createElement("p");
      arrived.className = "arrived-message js-arrived";
      arrived.hidden = true;
      arrived.textContent = "Событие уже наступило!";

      var actions = document.createElement("div");
      actions.className = "mini-actions";

      var featureBtn = document.createElement("button");
      featureBtn.type = "button";
      featureBtn.className = "btn btn-small";
      featureBtn.textContent = "На главный экран";
      featureBtn.addEventListener("click", function () {
        openModal({
          type: "feature",
          timer: timer,
          text: "Показать «" + timer.title + "» крупным таймером сверху?"
        });
      });

      var deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-ghost btn-small";
      deleteBtn.textContent = "Удалить";
      deleteBtn.addEventListener("click", function () {
        openModal({
          type: "remove",
          timer: timer,
          text: "Удалить таймер «" + timer.title + "»?"
        });
      });

      actions.appendChild(featureBtn);
      actions.appendChild(deleteBtn);
      card.appendChild(heading);
      card.appendChild(dateLine);
      card.appendChild(row);
      card.appendChild(arrived);
      card.appendChild(actions);
      els.list.appendChild(card);
    });

    markActivePresets();
    tickAll();
  }

  function persist() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        featuredId: board.featuredId,
        timers: board.timers.map(function (timer) {
          return {
            id: timer.id,
            source: timer.source,
            title: timer.title,
            date: timer.date.toISOString()
          };
        })
      }));
    } catch (error) {
      // Без localStorage таймеры живут только до перезагрузки страницы.
    }
  }

  function addTimer(timer, makeFeatured) {
    board.timers.push(timer);
    if (makeFeatured || !board.featuredId) {
      board.featuredId = timer.id;
    }
    persist();
    renderList();
  }

  function removeTimer(id) {
    board.timers = board.timers.filter(function (timer) {
      return timer.id !== id;
    });
    if (board.featuredId === id) {
      board.featuredId = board.timers[0] ? board.timers[0].id : null;
    }
    persist();
    renderList();
  }

  function setFeatured(id) {
    if (!findById(id)) {
      return;
    }
    board.featuredId = id;
    persist();
    renderList();
  }

  function restoreBoard() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.timers && parsed.timers.length) {
          board.timers = parsed.timers.map(function (item) {
            return {
              id: item.id,
              source: item.source || "custom",
              title: item.title,
              date: new Date(item.date)
            };
          }).filter(function (item) {
            return item.title && !isNaN(item.date.getTime());
          });
          board.featuredId = parsed.featuredId || (board.timers[0] && board.timers[0].id);
          return;
        }
      }

      // Старый формат: был только один выбранный таймер.
      var oldRaw = global.localStorage.getItem(OLD_STORAGE_KEY);
      if (oldRaw) {
        var old = JSON.parse(oldRaw);
        if (old && old.title && old.date) {
          var migrated = createTimer(old.id || "custom", old.title, new Date(old.date));
          if (!isNaN(migrated.date.getTime())) {
            board.timers = [migrated];
            board.featuredId = migrated.id;
            persist();
            return;
          }
        }
      }
    } catch (error) {
      board.timers = [];
    }

    var starter = presetToTimer("newyear");
    board.timers = [starter];
    board.featuredId = starter.id;
    persist();
  }

  function openModal(action) {
    pendingAction = action;
    els.confirmText.textContent = action.text;
    els.modal.classList.add("is-open");
    els.modal.setAttribute("aria-hidden", "false");
    els.confirmYes.focus();
  }

  function closeModal() {
    els.modal.classList.remove("is-open");
    els.modal.setAttribute("aria-hidden", "true");
    pendingAction = null;
  }

  function confirmPending() {
    if (!pendingAction) {
      return;
    }
    if (pendingAction.type === "add") {
      addTimer(pendingAction.timer, true);
    } else if (pendingAction.type === "feature") {
      setFeatured(pendingAction.timer.id);
    } else if (pendingAction.type === "remove") {
      removeTimer(pendingAction.timer.id);
    }
  }

  function requestPreset(id) {
    var existing = findBySource(id);
    if (existing) {
      openModal({
        type: "feature",
        timer: existing,
        text: "«" + existing.title + "» уже в списке. Показать этот таймер сверху?"
      });
      return;
    }
    if (board.timers.length >= MAX_TIMERS) {
      openModal({
        type: "info",
        text: "Слишком много таймеров. Удалите один, чтобы добавить новый."
      });
      return;
    }
    var timer = presetToTimer(id);
    openModal({
      type: "add",
      timer: timer,
      text: "Добавить таймер «" + timer.title + "»? Остальные продолжат идти."
    });
  }

  function readCustomEvent() {
    var name = els.customName.value.trim();
    var dateValue = els.customDate.value;
    if (!name) {
      els.customName.focus();
      return null;
    }
    if (!dateValue) {
      els.customDate.focus();
      return null;
    }
    return createTimer("custom", name, new Date(dateValue));
  }

  function requestCustomEvent() {
    if (board.timers.length >= MAX_TIMERS) {
      openModal({
        type: "info",
        text: "Слишком много таймеров. Удалите один, чтобы добавить новый."
      });
      return;
    }
    var custom = readCustomEvent();
    if (!custom) {
      return;
    }
    openModal({
      type: "add",
      timer: custom,
      text: "Добавить свой таймер «" + custom.title + "»? Он будет идти вместе с остальными."
    });
  }

  function dayIndex() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    return Math.floor((now - start) / 86400000);
  }

  function fillDailyBlocks() {
    var index = dayIndex();
    els.fact.textContent = DATA.FACTS[index % DATA.FACTS.length];
    els.quote.textContent = DATA.QUOTES[index % DATA.QUOTES.length];
    var picture = DATA.DAILY_IMAGES[index % DATA.DAILY_IMAGES.length];
    els.image.innerHTML = picture.svg;
    els.image.setAttribute("aria-label", picture.caption);
    els.imageCaption.textContent = picture.caption;
  }

  function renderPresets() {
    DATA.PRESETS.forEach(function (preset) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "event-btn";
      button.setAttribute("data-id", preset.id);
      var title = document.createElement("strong");
      title.textContent = preset.title;
      var hint = document.createElement("span");
      hint.textContent = preset.hint;
      button.appendChild(title);
      button.appendChild(hint);
      button.addEventListener("click", function () {
        requestPreset(preset.id);
      });
      els.presets.appendChild(button);
    });
  }

  function bindUi() {
    els.form.addEventListener("submit", function (event) {
      event.preventDefault();
      requestCustomEvent();
    });
    els.customSubmit.addEventListener("click", requestCustomEvent);

    els.confirmYes.addEventListener("click", function () {
      confirmPending();
      closeModal();
    });
    els.confirmNo.addEventListener("click", closeModal);
    els.modal.addEventListener("click", function (event) {
      if (event.target.getAttribute("data-close") === "true") {
        closeModal();
      }
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && els.modal.classList.contains("is-open")) {
        closeModal();
      }
    });
  }

  function init() {
    restoreBoard();
    renderPresets();
    bindUi();
    fillDailyBlocks();
    renderList();
    startClock();
  }

  init();
})(window);
