async function safeGetGroups(windowId) {
  try {
    return await chrome.tabGroups.query({ windowId });
  } catch (error) {
    console.error('safeGetGroups: failed to query tab groups', { windowId, error });
    return [];
  }
}

async function collapseOtherGroups(windowId, activeGroupId) {
  const groups = await safeGetGroups(windowId);
  await Promise.all(groups.map(async group => {
    if (group.id !== activeGroupId && !group.collapsed) {
      try {
        await chrome.tabGroups.update(group.id, { collapsed: true });
      } catch (error) {
        console.error('collapseOtherGroups: failed to collapse group', { groupId: group.id, windowId, error });
      }
    }
  }));
}

async function getOnlyOpenGroupInWindow(windowId) {
  const groups = await safeGetGroups(windowId);
  const expanded = groups.filter(group => !group.collapsed);
  if (expanded.length !== 1) return null;
  return expanded[0].id;
}

async function addTabToGroup(tabId, groupId) {
  if (tabId == null || groupId == null) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    const group = await chrome.tabGroups.get(groupId);
    if (tab.windowId === group.windowId && tab.groupId !== groupId) {
      await chrome.tabs.group({ tabIds: [tabId], groupId });
    }
  } catch (error) {
    console.error('addTabToGroup: failed to add tab to group', { tabId, groupId, error });
  }
}

async function getCurrentWindowId() {
  try {
    const win = await chrome.windows.getLastFocused();
    return win != null && win.id != null ? win.id : null;
  } catch (error) {
    console.error('getCurrentWindowId: failed to get last focused window', error);
    return null;
  }
}

function isGroupable(tab) {
  return tab.id != null && !tab.pinned;
}

function isWithoutGroup(tab) {
  return tab.groupId == null || tab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE;
}

async function getFloatingTabIds(windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  return tabs.filter(tab => isGroupable(tab) && isWithoutGroup(tab)).map(t => t.id);
}

async function groupFloatingTabsToNew() {
  try {
    const windowId = await getCurrentWindowId();
    if (windowId == null) return;

    const tabIds = await getFloatingTabIds(windowId);
    if (tabIds.length === 0) return;

    await chrome.tabs.group({
      tabIds,
      createProperties: { windowId },
    });
  } catch (error) {
    console.error('groupIndependentTabs: failed to group tabs', error);
  }
}

async function groupFloatingTabsTo(groupId) {
  if (groupId == null) return;
  try {
    const windowId = await getCurrentWindowId();
    if (windowId == null) return;

    const group = await chrome.tabGroups.get(groupId);
    if (windowId !== group.windowId) return;

    const tabIds = await getFloatingTabIds(group.windowId);
    if (tabIds.length === 0) return;

    await chrome.tabs.group({ tabIds, groupId });
  } catch (error) {
    console.error('groupIndependentTabsTo: failed to group tabs', { groupId, error });
  }
}

async function ungroupActiveGroup() {
  try {
    const windowId = await getCurrentWindowId();
    if (windowId == null) return;

    const groupId = await getOnlyOpenGroupInWindow(windowId);
    if (groupId == null) return;

    const groupTabs = await chrome.tabs.query({ groupId });
    const tabIds = groupTabs.map(t => t.id);

    await chrome.tabs.ungroup(tabIds);
  } catch (error) {
    console.error('ungroupActiveGroup: failed to ungroup tabs', error);
  }
}

const POPUP_ACTIONS = {
  'group-tabs': groupFloatingTabsToNew,
  'ungroup-tabs': ungroupActiveGroup,
  'group-tabs-to': message => groupFloatingTabsTo(message.groupId),
};

chrome.runtime.onMessage.addListener(message => {
  if (message == null || typeof message !== 'object') return;
  const action = POPUP_ACTIONS[message.type];
  if (action == null) return;

  action(message).catch(error => {
    console.error('popup action failed', { type: message.type, error });
  });
});

// Collapse other groups on group opening
chrome.tabGroups.onUpdated.addListener(async group => {
  if (group.collapsed === false) {
    await chrome.tabGroups.update(group.id, { color: 'blue' });
    await collapseOtherGroups(group.windowId, group.id);
  } else if (group.targetColor !== 'grey') {
    await chrome.tabGroups.update(group.id, { color: 'grey' });
  }
});

// Add new tabs to open groups
chrome.tabs.onCreated.addListener(async tab => {
  if (tab.id == null || tab.windowId == null) return;

  const destinationGroupId = await getOnlyOpenGroupInWindow(tab.windowId);
  if (destinationGroupId != null) {
    await addTabToGroup(tab.id, destinationGroupId);
  }
});
