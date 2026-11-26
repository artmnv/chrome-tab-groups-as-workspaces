function sendMessage(type) {
  return chrome.runtime.sendMessage({ type });
}

document.getElementById('group').addEventListener('click', () => {
  sendMessage('group-tabs');
  window.close();
});

document.getElementById('ungroup').addEventListener('click', () => {
  sendMessage('ungroup-tabs');
  window.close();
});
