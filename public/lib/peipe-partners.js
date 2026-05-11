'use strict';

(function () {
  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function api(url, options) {
    options = options || {};
    options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    return fetch(url, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          throw data;
        }
        return data;
      });
    });
  }

  function getMode() {
    var page = $('.peipe-partners-page');
    return page && page.getAttribute('data-mode') || 'recommend';
  }

  function text(value, fallback) {
    value = String(value == null ? '' : value).trim();
    return value || fallback || '';
  }

  function card(user) {
    var pic = user.picture || '/assets/uploads/system/default-avatar.png';
    var tags = Array.isArray(user.tags) ? user.tags : [];
    var tagHtml = tags.slice(0, 4).map(function (tag) {
      return '<span class="peipe-tag">' + escapeHtml(tag) + '</span>';
    }).join('');

    return '' +
      '<article class="peipe-partner-card" data-uid="' + Number(user.uid || 0) + '">' +
        '<a class="peipe-avatar-link" href="' + escapeHtml(user.profileLink || '#') + '">' +
          '<img class="peipe-avatar" src="' + escapeHtml(pic) + '" alt="">' +
        '</a>' +
        '<div class="peipe-partner-main">' +
          '<div class="peipe-partner-row">' +
            '<a class="peipe-name" href="' + escapeHtml(user.profileLink || '#') + '">' + escapeHtml(user.displayName || user.username || 'User') + '</a>' +
            (user.flagEmoji ? '<span class="peipe-flag">' + escapeHtml(user.flagEmoji) + '</span>' : '') +
            (user.ageText ? '<span class="peipe-age">' + escapeHtml(user.ageText) + '</span>' : '') +
          '</div>' +
          '<div class="peipe-langs">' + escapeHtml(text(user.nativeCode, '-')) + ' ⇄ ' + escapeHtml(text(user.learnCode, '-')) + '</div>' +
          '<p class="peipe-bio">' + escapeHtml(text(user.bio, '这个人还没有写简介')) + '</p>' +
          (tagHtml ? '<div class="peipe-tags">' + tagHtml + '</div>' : '') +
        '</div>' +
        '<button class="peipe-greet-btn" data-uid="' + Number(user.uid || 0) + '" type="button">打招呼</button>' +
      '</article>';
  }

  function showMessage(message, type) {
    if (window.app && window.app.alert) {
      window.app.alert({ type: type || 'info', message: message });
      return;
    }
    alert(message);
  }

  function renderLoading() {
    var list = $('.peipe-partners-list');
    if (list) {
      list.innerHTML = '<div class="peipe-loading">加载中...</div>';
    }
  }

  function renderEmpty() {
    var list = $('.peipe-partners-list');
    if (list) {
      list.innerHTML = '<div class="peipe-empty">暂时没有找到语伴，晚点再来看看。</div>';
    }
  }

  function load() {
    var list = $('.peipe-partners-list');
    if (!list) {
      return;
    }
    renderLoading();
    api('/api/peipe-partners?mode=' + encodeURIComponent(getMode()) + '&limit=30')
      .then(function (payload) {
        var users = payload && Array.isArray(payload.users) ? payload.users : [];
        if (!users.length) {
          renderEmpty();
          return;
        }
        list.innerHTML = users.map(card).join('');
      })
      .catch(function () {
        renderEmpty();
      });
  }

  function greet(uid, button) {
    if (!uid) {
      return;
    }
    if (button) {
      button.disabled = true;
      button.textContent = '已发送';
    }
    api('/api/peipe-partners/me/greet', {
      method: 'POST',
      body: JSON.stringify({ uid: uid })
    }).then(function (payload) {
      if (payload && payload.ok === false) {
        throw payload;
      }
      showMessage('已打招呼', 'success');
    }).catch(function (err) {
      var message = err && err.error === 'daily-limit' ? '今天打招呼次数已用完' : '发送失败，请先登录或稍后再试';
      showMessage(message, 'danger');
      if (button) {
        button.disabled = false;
        button.textContent = '打招呼';
      }
    });
  }

  function bind() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest && event.target.closest('.peipe-greet-btn');
      if (!button) {
        return;
      }
      event.preventDefault();
      greet(Number(button.getAttribute('data-uid') || 0), button);
    });

    var swipeLink = $('.peipe-open-swipe');
    if (swipeLink) {
      swipeLink.addEventListener('click', function () {
        window.location.href = '/partners/swipe';
      });
    }
  }

  function init() {
    if (!$('.peipe-partners-page')) {
      return;
    }
    bind();
    load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  if (window.ajaxify && window.ajaxify.on) {
    window.ajaxify.on('action:ajaxify.end', init);
  }
}());
