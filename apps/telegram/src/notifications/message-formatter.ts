import type { NotificationPayload } from '@app/contracts';

/**
 * Builds an HTML-formatted telegram message body from a notification payload.
 * Output is safe to send with `parse_mode=HTML` — every user-controlled
 * substring goes through `escapeHtml`.
 */
export function formatNotification(p: NotificationPayload): string {
  const lines: string[] = [];

  if (p.title) {
    lines.push(`<b>${escapeHtml(p.title)}</b>`);
    lines.push('');
  }

  lines.push(escapeHtml(p.message));

  if (p.metadata && Object.keys(p.metadata).length > 0) {
    lines.push('');
    lines.push('<i>details</i>');
    for (const [k, v] of Object.entries(p.metadata)) {
      lines.push(`• ${escapeHtml(k)}: <code>${escapeHtml(stringify(v))}</code>`);
    }
  }

  return lines.join('\n');
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
