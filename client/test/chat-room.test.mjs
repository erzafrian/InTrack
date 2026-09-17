import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the actual async handlers with delayed HTTP responses, without a DOM.
const source = fs.readFileSync(new URL('../src/pages/mentor/AiChat.jsx', import.meta.url), 'utf8');
function handler(start, end, name, context) {
  const code = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
    .replace(`const ${name} =`, `globalThis.run =`);
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.run;
}

for (const fails of [false, true]) {
  test(`late AI ${fails ? 'failure' : 'answer'} does not modify another room`, async () => {
    let resolve, reject;
    const state = { messages: [{ content: 'A history' }], input: 'Question A' };
    const scope = { current: { id: 'A', version: 1 } };
    const context = {
      input: state.input, loading: false, roomScope: scope, messageRequest: { current: 0 },
      api: { post: () => new Promise((yes, no) => { resolve = yes; reject = no; }) },
      setMessages: fn => { state.messages = fn(state.messages); }, setInput: text => { state.input = text; },
      setChatError() {}, setLoading() {}, selectRoom() {}, loadRooms() {},
    };
    const send = handler('  const handleSend =', '  const handleKeyDown =', 'handleSend', context);
    const pending = send();
    scope.current = { id: 'B', version: 2 };
    state.messages = [{ content: 'B history' }]; state.input = 'Draft B';
    if (fails) reject(new Error('provider failed'));
    else resolve({ data: { data: { roomId: 'A', response: 'Answer A' } } });
    await pending;
    assert.equal(state.messages.length, 1); assert.equal(state.messages[0].content, 'B history');
    assert.equal(state.input, 'Draft B');
  });
}

test('late history response cannot overwrite a newly selected room', async () => {
  const pending = new Map(); let messages;
  const scope = { current: { id: 'A', version: 1 } };
  const context = {
    useCallback: fn => fn, roomScope: scope, messageRequest: { current: 0 }, greeting: {},
    api: { get: url => new Promise(resolve => pending.set(url, resolve)) },
    setMessages: value => { messages = value; }, setChatError() {},
  };
  const load = handler('  const loadMessages =', '  useEffect(() => { if (activeRoom)', 'loadMessages', context);
  const first = load('A'); scope.current = { id: 'B', version: 2 }; const second = load('B');
  pending.get('/admin/mentor/chat-rooms/B/messages')({ data: { data: [{ role: 'user', content: 'B' }] } }); await second;
  pending.get('/admin/mentor/chat-rooms/A/messages')({ data: { data: [{ role: 'user', content: 'A' }] } }); await first;
  assert.equal(messages[0].content, 'B');
});
