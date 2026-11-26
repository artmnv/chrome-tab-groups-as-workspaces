const GROUP_COLORS = {
  grey: '#5f6368',
  blue: '#1a73e8',
  red: '#d93025',
  yellow: '#f9ab00',
  green: '#1e8e3e',
  pink: '#d01884',
  purple: '#9334e6',
  cyan: '#007b83',
  orange: '#fa903e',
};

function sendMessage(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

document.getElementById('group').addEventListener('click', () => {
  sendMessage('group-tabs');
  window.close();
});

document.getElementById('ungroup').addEventListener('click', () => {
  sendMessage('ungroup-tabs');
  window.close();
});

async function getCurrentWindowGroups() {
  const win = await chrome.windows.getLastFocused();
  if (win == null || win.id == null) return [];
  return chrome.tabGroups.query({ windowId: win.id });
}

function createGroupButton(group) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'group-button';
  button.title = group.title || '(untitled group)';

  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = GROUP_COLORS[group.color] ?? GROUP_COLORS.grey;

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = group.title || '(untitled group)';

  button.append(swatch, title);
  button.addEventListener('click', () => {
    sendMessage('group-tabs-to', { groupId: group.id });
    window.close();
  });
  return button;
}

function renderGroupList(container, groups) {
  container.replaceChildren();

  const title = document.createElement('p');
  title.className = 'groups-title';
  title.textContent = 'Group floating tabs into';
  container.append(title);

  if (groups.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'group-empty';
    empty.textContent = 'No tab groups in this window.';
    container.append(empty);
    return;
  }

  groups.forEach(group => container.append(createGroupButton(group)));
}

document.getElementById('group-to').addEventListener('click', async () => {
  const container = document.getElementById('groups');
  const groups = await getCurrentWindowGroups();
  renderGroupList(container, groups);
  container.hidden = false;
});
