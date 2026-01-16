const background = require('../background');

describe('Background Service Worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Reset internal state
    background.setCurrentUrl(null);
    background.setCurrentTabId(null);
    background.setIsWindowFocused(true);
    background.setUnsavedData({});
    background.setSettings({ blacklist: [], limits: {}, categories: {} });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('init() should fetch active tab and update state', async () => {
    chrome.tabs.query.mockResolvedValue([{
      id: 123,
      url: 'https://startup.com',
      title: 'Startup'
    }]);

    await background.init();

    expect(chrome.tabs.query).toHaveBeenCalled();
  });

  test('tick() should accumulate time in unsavedData', () => {
    background.setCurrentUrl('https://example.com');
    background.setCurrentTabId(1);
    background.setIsWindowFocused(true);

    background.tick();

    const unsaved = background.getUnsavedData();
    expect(unsaved['https://example.com']).toBeDefined();
    expect(unsaved['https://example.com'].seconds).toBe(1);
  });

  test('tick() should not track if window is not focused', () => {
    background.setCurrentUrl('https://example.com');
    background.setCurrentTabId(1);
    background.setIsWindowFocused(false);

    background.tick();

    const unsaved = background.getUnsavedData();
    expect(unsaved['https://example.com']).toBeUndefined();
  });

  test('tick() should not track blacklisted domains', () => {
    background.setSettings({
      blacklist: ['example.com'],
      limits: {},
      categories: {}
    });
    background.setCurrentUrl('https://example.com');
    background.setCurrentTabId(1);
    background.setIsWindowFocused(true);

    background.tick();

    const unsaved = background.getUnsavedData();
    expect(unsaved['https://example.com']).toBeUndefined();
  });

  test('saveData() should persist data to storage', async () => {
    background.setUnsavedData({
      'https://example.com': { seconds: 10, title: 'Example', lastVisit: Date.now() }
    });

    // Mock storage get to return empty
    chrome.storage.local.get.mockResolvedValue({});

    await background.saveData();

    expect(chrome.storage.local.set).toHaveBeenCalled();
    const callArg = chrome.storage.local.set.mock.calls[0][0];
    const dateKey = background.getDateKey();
    expect(callArg[dateKey]['https://example.com'].seconds).toBe(10);

    // Unsaved data should be cleared
    expect(Object.keys(background.getUnsavedData()).length).toBe(0);
  });

  test('Data Loss Scenario Fixed: New data added while saving should be preserved', async () => {
    jest.useRealTimers();
    background.setUnsavedData({
      'https://a.com': { seconds: 10, title: 'A', lastVisit: Date.now() }
    });

    let resolveSet;
    const setPromise = new Promise(r => resolveSet = r);
    chrome.storage.local.set.mockReturnValue(setPromise);
    chrome.storage.local.get.mockResolvedValue({});

    // Start Save
    const savePromise = background.saveData();

    // Wait for the save logic to reach "set" (it awaits get first, which is resolved immediately)
    // We need to wait a tiny bit for the promise chain
    await new Promise(r => setTimeout(r, 0));

    // Now SaveData has iterated over 'a.com' (from the copied buffer) and called set.
    // It is waiting for setPromise.
    // Meanwhile, unsavedData was cleared at the start of saveData.

    // Simulate Tick adding a NEW URL to the NEW unsavedData object
    const unsaved = background.getUnsavedData();
    // Verify unsavedData is indeed empty/new
    expect(unsaved['https://a.com']).toBeUndefined();

    // Add new data
    unsaved['https://b.com'] = { seconds: 1, title: 'B', lastVisit: Date.now() };

    // Resume Save
    resolveSet();
    await savePromise;

    // After save completes, unsavedData should still contain B
    const finalUnsaved = background.getUnsavedData();
    expect(finalUnsaved['https://b.com']).toBeDefined();
    expect(finalUnsaved['https://b.com'].seconds).toBe(1);

    // Check Storage: Should contain A.
    expect(chrome.storage.local.set).toHaveBeenCalled();
    const storageData = chrome.storage.local.set.mock.calls[0][0];
    const dateKey = background.getDateKey();
    expect(storageData[dateKey]['https://a.com']).toBeDefined();

    // Check Storage: Should NOT contain B (because it is in the new buffer)
    expect(storageData[dateKey]['https://b.com']).toBeUndefined();

    // Result: A is saved, B is preserved in buffer. NO DATA LOSS.
  });

});
