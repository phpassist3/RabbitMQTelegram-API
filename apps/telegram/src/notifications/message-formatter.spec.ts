import { formatNotification } from './message-formatter';

describe('formatNotification', () => {
  it('renders a plain message without title or metadata', () => {
    const out = formatNotification({
      channel: 'telegram',
      recipient: '1',
      message: 'hello',
    });
    expect(out).toBe('hello');
  });

  it('renders title bold and separates from message', () => {
    const out = formatNotification({
      channel: 'telegram',
      recipient: '1',
      title: 'Order placed',
      message: 'Your order is on the way.',
    });
    expect(out).toContain('<b>Order placed</b>');
    expect(out).toContain('Your order is on the way.');
  });

  it('appends metadata as bullet list', () => {
    const out = formatNotification({
      channel: 'telegram',
      recipient: '1',
      message: 'msg',
      metadata: { id: 42, source: 'web' },
    });
    expect(out).toContain('• id: <code>42</code>');
    expect(out).toContain('• source: <code>web</code>');
  });

  it('escapes html special characters in user input', () => {
    const out = formatNotification({
      channel: 'telegram',
      recipient: '1',
      title: '<script>',
      message: 'A & B > C',
      metadata: { tag: '<em>' },
    });
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
    expect(out).toContain('A &amp; B &gt; C');
    expect(out).toContain('&lt;em&gt;');
  });

  it('serialises non-string metadata via JSON.stringify', () => {
    const out = formatNotification({
      channel: 'telegram',
      recipient: '1',
      message: 'msg',
      metadata: { items: ['a', 'b'] },
    });
    expect(out).toContain('• items: <code>["a","b"]</code>');
  });
});
