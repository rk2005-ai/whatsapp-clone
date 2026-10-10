export const BG = ['#00a884', '#7e57c2', '#e91e63', '#ff7043', '#3949ab', '#455a64'];

// Clean default state for a real WhatsApp application without mock/fake data
export const seed = () => ({
  user: null,
  contacts: [],
  chats: {},
  statuses: [],
  myStatus: [],
  calls: [],
  settings: {
    theme: 'light',
    wallpaper: 'default',
    notifications: true,
    sounds: true,
    previews: true,
    readReceipts: true,
    lastSeen: 'everyone'
  }
});
