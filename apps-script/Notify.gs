/**
 * Notify.gs
 * --------------------------------------------------------------------------
 * Posts a message to a Google Chat space via an incoming webhook.
 * If CONFIG.CHAT_WEBHOOK_URL is empty, notifications are skipped (the pipeline
 * still runs) — so the project works before Chat is configured.
 * --------------------------------------------------------------------------
 */
function notifyChat_(text) {
  if (!CONFIG.CHAT_WEBHOOK_URL) {
    Logger.log('[Chat skipped, no webhook] ' + text);
    return;
  }
  try {
    UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: text }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    Logger.log('Chat error: ' + e.message);
  }
}
