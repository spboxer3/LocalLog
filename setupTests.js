// Mock Chrome API
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
    onSuspend: {
      addListener: jest.fn(),
    },
    getManifest: jest.fn(() => ({ version: '1.0' })),
  },
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({}), // Default resolve to empty object
      set: jest.fn().mockResolvedValue(),
      remove: jest.fn().mockResolvedValue(),
      onChanged: {
        addListener: jest.fn(),
      },
    },
    onChanged: {
      addListener: jest.fn(),
    },
  },
  tabs: {
    query: jest.fn().mockResolvedValue([]),
    get: jest.fn().mockResolvedValue({}),
    onActivated: {
      addListener: jest.fn(),
    },
    onUpdated: {
      addListener: jest.fn(),
    },
  },
  windows: {
    onFocusChanged: {
      addListener: jest.fn(),
    },
    WINDOW_ID_NONE: -1,
  },
  action: {
    setBadgeText: jest.fn(),
    setBadgeBackgroundColor: jest.fn(),
  },
  notifications: {
    create: jest.fn(),
    clear: jest.fn(),
  },
  i18n: {
    getMessage: jest.fn((key) => key),
  },
  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
    clear: jest.fn(),
  }
};

// Mock console methods to avoid cluttering test output
global.console = {
  ...console,
  // log: jest.fn(),
  error: jest.fn(),
};
