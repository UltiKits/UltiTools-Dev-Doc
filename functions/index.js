export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only redirect the bare root path
  if (url.pathname !== '/') {
    return context.next();
  }

  const acceptLang = context.request.headers.get('Accept-Language') || '';
  if (/zh/i.test(acceptLang)) {
    return Response.redirect(`${url.origin}/zh/`, 302);
  }

  // English is the root locale — serve normally
  return context.next();
}
