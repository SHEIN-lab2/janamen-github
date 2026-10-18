const pages = {
  dashboard,
  requests,
  academy,
  learning: learningOverview,
  ai,
  notifications,
  profile,
  team,
  knowledge,
  integrations: integrationsPage,
};

call('/api/me')
  .then((d) => {
    user = d.user;
    navigate(requestedView(), { push: false });
  })
  .catch(() => authPage());
