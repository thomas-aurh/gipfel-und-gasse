// Native Brücke der Android-App nachgebildet (wie native-bridge.js von Capacitor): Plugin-Köpfe, nativePromise,
// nativeCallback. Darauf läuft der echte @capacitor/core aus der App-Datei, wie auf dem Handy.
// Gebrauch: await ctx.addInitScript(require('./bruecke')); danach im nächsten Init-Skript window.__bruecke({ Name: { methode: async o => … } }).
module.exports = function bruecke() {
  window.__bruecke = plugins => {
    window.androidBridge = { postMessage() {} };
    window.Capacitor = {
      PluginHeaders: Object.keys(plugins).map(name => ({ name, methods: Object.keys(plugins[name]).filter(m => m !== 'addListener')
        .map(m => ({ name: m, rtype: 'promise' })).concat([{ name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }]) })),
      nativePromise: (p, m, o) => { try { return Promise.resolve(plugins[p][m] ? plugins[p][m](o) : undefined); } catch (e) { return Promise.reject(e); } },
      nativeCallback: (p, m, o, cb) => { if (m === 'addListener' && plugins[p].addListener) plugins[p].addListener(o.eventName, cb); return Promise.resolve('cb' + Math.random()); }
    };
  };
};
