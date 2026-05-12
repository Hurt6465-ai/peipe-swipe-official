'use strict';

const routeHelpers = require.main.require('./src/routes/helpers');
const partner = require('./lib/partner');
const swipe = require('./swipe');
const partnerReviews = require('./swipe/comments');

const plugin = {};

function asyncRoute(fn) {
  return function routeHandler(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function json(res, payload) {
  res.set('Cache-Control', 'no-store, max-age=0');
  res.json(payload);
}

plugin.init = async ({ router, middleware }) => {
  routeHelpers.setupPageRoute(router, '/partners', [], (req, res) => {
    res.render('peipe-partners', { uid: req.uid || 0 });
  });

  routeHelpers.setupPageRoute(router, '/nearby', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'nearby' });
  });

  routeHelpers.setupPageRoute(router, '/nearby/list', [], (req, res) => {
    res.render('peipe-nearby', { uid: req.uid || 0 });
  });

  routeHelpers.setupPageRoute(router, '/partners/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'recommend' });
  });

  routeHelpers.setupPageRoute(router, '/nearby/swipe', [], (req, res) => {
    res.render('peipe-partners-swipe', { uid: req.uid || 0, mode: 'nearby' });
  });

  router.get('/api/peipe-partners', asyncRoute(async (req, res) => {
    json(res, await partner.list(req));
  }));

  router.get('/api/peipe-partners/options', asyncRoute(async (req, res) => {
    json(res, await partner.options(req));
  }));

  router.get('/api/peipe-partners/me/profile-status', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.profileStatus(req.uid));
  }));

  router.put('/api/peipe-partners/me/profile', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.saveProfile(req.uid, req.body || {}));
  }));

  router.put('/api/peipe-partners/location', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.saveLocation(req.uid, req.body || {}));
  }));

  router.post('/api/peipe-partners/me/chatted', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.markChatted(req.uid, req.body || {}));
  }));

  router.post('/api/peipe-partners/me/greet', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partner.greet(req.uid, req.body || {}));
  }));

  router.get('/api/peipe-partners/swipe/feed', asyncRoute(async (req, res) => {
    json(res, await swipe.feed(req));
  }));

  router.get('/api/peipe-partners/swipe/tags', asyncRoute(async (req, res) => {
    json(res, swipe.tags(req));
  }));

  router.get('/api/peipe-partners/swipe/me', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.getMe(req.uid));
  }));

  router.put('/api/peipe-partners/swipe/me', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await swipe.saveMe(req.uid, req.body || {}));
  }));

  router.get('/api/peipe-partners/comments/:uid', asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get('/api/peipe-partners/profile/:uid/comments', asyncRoute(async (req, res) => {
    json(res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  }));

  router.get('/api/peipe-partners/comments/:uid/eligibility', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.eligibility(req.uid, req.params.uid));
  }));

  router.post('/api/peipe-partners/comments/:uid', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.post('/api/peipe-partners/profile/:uid/comments', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.upsert(req));
  }));

  router.put('/api/peipe-partners/comments/item/:id', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.update(req));
  }));

  router.delete('/api/peipe-partners/comments/item/:id', middleware.ensureLoggedIn, asyncRoute(async (req, res) => {
    json(res, await partnerReviews.remove(req));
  }));
};

plugin.addRoutes = async ({ router, middleware, helpers }) => {
  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.list(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/options', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.options(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/me/profile-status', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.profileStatus(req.uid));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/me/profile', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.saveProfile(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/location', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.saveLocation(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/me/chatted', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.markChatted(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/me/greet', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partner.greet(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/feed', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.feed(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/tags', [], async (req, res) => {
    helpers.formatApiResponse(200, res, swipe.tags(req));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/swipe/me', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.getMe(req.uid));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/swipe/me', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await swipe.saveMe(req.uid, req.body || {}));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/comments/:uid', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/profile/:uid/comments', [], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.listForTarget(req.params.uid, req.uid, req.query.limit));
  });

  routeHelpers.setupApiRoute(router, 'get', '/peipe-partners/comments/:uid/eligibility', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.eligibility(req.uid, req.params.uid));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/comments/:uid', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'post', '/peipe-partners/profile/:uid/comments', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.upsert(req));
  });

  routeHelpers.setupApiRoute(router, 'put', '/peipe-partners/comments/item/:id', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.update(req));
  });

  routeHelpers.setupApiRoute(router, 'delete', '/peipe-partners/comments/item/:id', [middleware.ensureLoggedIn], async (req, res) => {
    helpers.formatApiResponse(200, res, await partnerReviews.remove(req));
  });
};

module.exports = plugin;

